// #region Settings
const defaultI18n = {
  exportChatContainerMissing: "Could not find chat container",
  exportNoMessages: "No messages found in this chat",
  exportExtractFailed: "Could not extract message content",
  exportFailedTemplate: "Export failed: {{error}}",
  untitledChat: "Untitled Chat",
  sidebarBookmarksHeading: "Bookmarks",
  sidebarBookmarksEmpty: "No bookmarks yet",
  exportCreatedLabel: "Created",
  exportRoleYou: "You",
  exportRoleChatgpt: "ChatGPT",
  exportPlaceholderImage: "[Image]",
  exportPlaceholderFileTemplate: "[File: {{fileName}}]",
};

const defaultTimestampColors = {
  colorSidebarPrimaryLight: "#4b5563",
  colorSidebarPrimaryDark: "#e3e3e3",
  colorSidebarSecondaryLight: "#15803d",
  colorSidebarSecondaryDark: "#81c995",
  colorChatLight: "#4b5563",
  colorChatDark: "#afafaf",
};

let userSettings = {
  dateFormat: "locale",
  displayMode: "created",
  hoverMode: "swap",
  hoverDetailSource: "created",
  inlineDateFormat: "date",
  hoverDetailFormat: "fullDate",
  chatTimestampEnabled: true,
  chatTimestampPosition: "center",
  sidebarFilterMode: "all",
  boldSidebarTimestamp: false,
  boldChatTimestamp: true,
  starredIds: new Set(),
  // [{ id, kind, title, starredAt }] from the bridge
  bookmarks: [],
  ...defaultTimestampColors,
};

let userI18n = { ...defaultI18n };
// #endregion

function formatTemplate(template, values) {
  if (!template) return "";
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    if (values && values[key] != null) {
      return String(values[key]);
    }
    return "";
  });
}

function normalizeStarredIdSet(value) {
  if (value instanceof Set) return value;
  if (Array.isArray(value)) return new Set(value);
  return new Set();
}

function getConversationIdFromHref(href) {
  if (!href) return null;

  try {
    const url = new URL(href, window.location.origin);
    const segments = url.pathname.split("/").filter(Boolean);
    // Regular chats live under /c/<id>, group chats under /gg/<id>
    const chatIndex = segments.indexOf("c");
    if (chatIndex !== -1 && segments[chatIndex + 1]) {
      return decodeURIComponent(segments[chatIndex + 1]);
    }
    const groupIndex = segments.indexOf("gg");
    if (groupIndex !== -1 && segments[groupIndex + 1]) {
      return decodeURIComponent(segments[groupIndex + 1]);
    }
    return null;
  } catch {
    return null;
  }
}

// Group chat rooms and thread conversation objects expose reactive fields as
// `$`-suffixed getter functions (e.g. updatedAt$, name$, serverId$). Read one
// defensively.
function readSignal(obj, key) {
  const getter = obj?.[key];
  if (typeof getter !== "function") return null;
  try {
    return getter.call(obj);
  } catch {
    return null;
  }
}

function isGroupRoom(candidate) {
  return Boolean(candidate?.id && typeof candidate.updatedAt$ === "function");
}

// room.createdAt is the client-side instantiation time of the room object,
// not when the room was created. The earliest loaded message (the "X created
// the group chat" notice) is the real creation time, but only trust it once
// the beginning of history has been fetched.
function getGroupRoomCreatedAt(room) {
  if (readSignal(room, "hasFetchedBeginning$") !== true) return null;
  const messages = readSignal(room, "messages$");
  const first = Array.isArray(messages) ? messages[0] : null;
  return first?.createdAt || null;
}

// New chats (including ones created on the Work surface) first live at
// /c/WEB:<uuid> — a client-side draft id. The server then assigns an
// unrelated real id; the URL flips to it quickly, but the sidebar item's
// href and fiber props can keep the draft id for minutes.
const DRAFT_CONVERSATION_ID_PREFIX = "WEB:";

function isDraftConversationId(id) {
  return typeof id === "string" && id.startsWith(DRAFT_CONVERSATION_ID_PREFIX);
}

// Draft id -> real server id, observed via recordDraftIdMapping().
const draftIdMap = new Map();

// Older thread views attach a `conversation` object ({id, serverId$, ...});
// newer message components expose localConversationId and conversationId.
// Preserve the draft-to-server mapping for bookmark lookups in both layouts.
function findThreadConversation() {
  const div = getMessageElements()[0];
  if (!div) return null;
  for (const props of reactProps(div)) {
    const conversation = props.conversation;
    if (typeof conversation?.id === "string") return conversation;
    if (isDraftConversationId(props.localConversationId) &&
        typeof props.conversationId === "string" && !isDraftConversationId(props.conversationId)) {
      return { id: props.localConversationId, serverId$: () => props.conversationId };
    }
  }
  return null;
}

function recordDraftIdMapping() {
  const conversation = findThreadConversation();
  if (!conversation || !isDraftConversationId(conversation.id)) return;
  const serverId = readSignal(conversation, "serverId$");
  if (typeof serverId === "string" && !isDraftConversationId(serverId)) {
    draftIdMap.set(conversation.id, serverId);
  }
}

function resolveConversationId(id) {
  if (!isDraftConversationId(id)) return id;
  return draftIdMap.get(id) || id;
}

// Regular chat links (/c/...), project chat links (/g/g-p-.../c/...),
// project folders (/g/g-p-.../project), and group chats (/gg/...)
const SIDEBAR_LINK_SELECTOR = SIDEBAR_SELECTOR;

// ChatGPT's own sidebar links, leaving out the extension's Bookmarks section.
function getSidebarLinks() {
  return Array.from(document.querySelectorAll(SIDEBAR_LINK_SELECTOR))
    .filter((link) => !bookmarksSection.contains(link));
}

// Group chats (/gg/...) and dots (/dots/...) are messaging rooms that show
// their own message times; their messages carry no conversation message data.
function isGroupChatPath(pathname) {
  return ["gg", "dots"].includes(pathname.split("/").filter(Boolean)[0]);
}

// Locate the room object for the currently open group chat by walking the
// fiber of its sidebar link (rooms are not reachable from message fibers).
function findGroupRoomForCurrentPath() {
  const roomId = getConversationIdFromHref(window.location.href);
  const links = document.querySelectorAll('a[href^="/gg/"]');
  for (const link of links) {
    for (const props of reactProps(link)) {
      const room = props.room;
      if (isGroupRoom(room)) {
        if (!roomId || room.id === roomId) return room;
        break;
      }
    }
  }
  return null;
}

// Group chat message prop (internally "calpico") attached one fiber above
// each div[data-message-id] inside a room.
function extractGroupMessageFromDiv(div) {
  for (const props of reactProps(div)) {
    const calpicoMessage = props.calpicoMessage;
    if (calpicoMessage) return calpicoMessage;
  }
  return null;
}

// Map a group message's accountUserId to a member display name, if the
// room's member profile snapshots expose one.
function resolveGroupSenderName(calpicoMessage, memberSnapshots) {
  const accountUserId = calpicoMessage?.accountUserId;
  if (!accountUserId || !memberSnapshots) return null;
  let entries;
  if (memberSnapshots instanceof Map) {
    entries = [...memberSnapshots.values()];
  } else if (Array.isArray(memberSnapshots)) {
    entries = memberSnapshots;
  } else if (typeof memberSnapshots === "object") {
    entries = Object.values(memberSnapshots);
  } else {
    return null;
  }
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const id =
      entry.accountUserId ||
      entry.account_user_id ||
      entry.userId ||
      entry.user_id ||
      entry.id;
    if (id !== accountUserId) continue;
    const name = entry.name || entry.displayName || entry.display_name;
    if (typeof name === "string" && name.trim()) return name.trim();
    break;
  }
  return null;
}

// First non-empty text inside a sidebar link, skipping the injected
// timestamp container. Suffix badges ("Work") are separate spans after the
// title, so the first text node is the title.
function findFirstTitleText(el) {
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent.trim();
      if (text) return text;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.classList?.contains("timestamp-stack-container")) continue;
      const text = findFirstTitleText(node);
      if (text) return text;
    }
  }
  return null;
}

// Title as rendered in the sidebar for a conversation id. Fiber titles lag
// for freshly created chats (null / "New chat"); the DOM shows the real one.
function getSidebarTitleForConversationId(conversationId) {
  if (!conversationId) return null;
  for (const el of getSidebarLinks()) {
    const linkId = resolveConversationId(
      getConversationIdFromHref(el.getAttribute("href")),
    );
    if (linkId !== conversationId) continue;
    return findFirstTitleText(el);
  }
  return null;
}

// Chat context for the popup. Resolves WEB: draft ids to the real
// conversation id so bookmarks are never keyed by a temporary id, and reads
// the title from the sidebar DOM because document.title stays generic while
// a chat is being created.
function getChatContext() {
  recordDraftIdMapping();
  const conversationId = resolveConversationId(
    getConversationIdFromHref(window.location.href),
  );
  const isDraft = isDraftConversationId(conversationId);
  const title =
    (!isDraft && getSidebarTitleForConversationId(conversationId)) ||
    document.title ||
    "";
  return {
    success: true,
    href: window.location.href,
    title,
    conversationId: isDraft ? null : conversationId,
    isDraft,
  };
}

function findFirstTitleTextRect(el) {
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (!node.textContent.trim()) continue;
      const range = document.createRange();
      range.selectNode(node);
      return range.getClientRects()[0] || range.getBoundingClientRect();
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.classList?.contains("timestamp-stack-container")) continue;
      const rect = findFirstTitleTextRect(node);
      if (rect) return rect;
    }
  }
  return null;
}

// Sidebar row element -> whether its title is pushed right by a leading icon.
// Measuring needs layout, so each row is measured once, not on every refresh.
const leadingIconCache = new WeakMap();

function linkHasLeadingIcon(el) {
  // Pinned chats render an icon before the title, which pushes the title
  // text to the right. Detect by measuring the gap between the link's left
  // edge and where the title text actually starts. Subtree icon scans give
  // false positives because regular chats also contain hover-revealed action
  // icons (menu "...", etc.).
  if (leadingIconCache.has(el)) return leadingIconCache.get(el);
  try {
    // Rows without a layout box or title yet are measured again next time.
    const linkRect = el.getBoundingClientRect();
    if (!linkRect.width) return false;

    const titleRect = findFirstTitleTextRect(el);
    if (!titleRect || !titleRect.width) return false;

    const hasLeadingIcon = titleRect.left - linkRect.left >= 24;
    leadingIconCache.set(el, hasLeadingIcon);
    return hasLeadingIcon;
  } catch {
    return false;
  }
}

// Sidebar row element -> where its timestamp sits. Rows differ in height
// (pinned chats and projects are taller than recents), so anchoring to the
// row bottom leaves a wider gap under some titles; anchor to the title instead.
const sidebarStampLayout = new WeakMap();

function measureSidebarStamp(el) {
  try {
    // Rows without a layout box or title yet are measured again next time.
    const rowRect = el.getBoundingClientRect();
    const titleRect = findFirstTitleTextRect(el);
    if (!rowRect.height || !titleRect?.height) return;

    // Row height without the bottom padding added for the timestamp.
    const contentBottom =
      rowRect.height - parseFloat(getComputedStyle(el).paddingBottom);
    const top = Math.ceil(titleRect.bottom - rowRect.top);
    sidebarStampLayout.set(el, {
      top,
      // Room for one 12px line plus the row's 4px bottom gap.
      paddingBottom: Math.max(0, Math.round(top + 16 - contentBottom)),
    });
  } catch {
    // Unmeasured rows keep the timestamp at the row bottom.
  }
}

function sidebarRowPadding(el) {
  return sidebarStampLayout.get(el)?.paddingBottom ?? 15;
}

// Injected timestamp element -> the state last written to it. The refresh
// loop skips unchanged rows and messages instead of rewriting their DOM.
const renderedState = new WeakMap();

const STAR_ICON_SVG =
  '<svg viewBox="0 0 16 16" aria-hidden="true" style="display:block;width:100%;height:100%;fill:currentColor"><path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Zm0 2.445L6.615 5.5a.75.75 0 0 1-.564.41l-3.097.45 2.24 2.184a.75.75 0 0 1 .216.664l-.528 3.084 2.769-1.456a.75.75 0 0 1 .698 0l2.77 1.456-.53-3.084a.75.75 0 0 1 .216-.664l2.24-2.183-3.096-.45a.75.75 0 0 1-.564-.41L8 2.694Z"></path></svg>';

// #region Event Listeners
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.data?.type === "TIMESTAMP_SETTINGS_UPDATE") {
    userSettings = { ...userSettings, ...event.data.settings };
    userSettings.starredIds = normalizeStarredIdSet(userSettings.starredIds);
    if (!Array.isArray(userSettings.bookmarks)) userSettings.bookmarks = [];
    if (event.data?.i18n) {
      const nextI18n = { ...defaultI18n };
      Object.entries(event.data.i18n).forEach(([key, value]) => {
        if (value) nextI18n[key] = value;
      });
      userI18n = nextI18n;
    }

    // Clear chat timestamp marks when settings change to force re-render
    getMessageElements().forEach((div) => {
      if (div.dataset.timestampAdded) {
        locateChatStamp(div).stamps.forEach((el) => el.remove());
        delete div.dataset.timestampAdded;
      }
    });

    addSidebarTimestampsFiber(); // Refresh sidebar with new settings
    addChatTimestamps(); // Refresh chat messages with new settings
  }

  if (event.data?.type === "GET_CHAT_CONTEXT") {
    window.postMessage(
      {
        type: "GET_CHAT_CONTEXT_RESULT",
        result: getChatContext(),
      },
      window.location.origin,
    );
  }

  if (event.data?.type === "EXPORT_CHAT") {
    const result = exportCurrentChat(event.data.format);
    window.postMessage(
      {
        type: "EXPORT_CHAT_RESULT",
        result: result,
      },
      window.location.origin,
    );
  }

});
// #endregion

// #region Export
function exportCurrentChat(format = "markdown") {
  try {
    // Find the conversation data from React fiber
    const mainElement = document.querySelector("main");
    if (!mainElement) {
      return { success: false, message: userI18n.exportChatContainerMissing };
    }

    const isGroupChat = isGroupChatPath(window.location.pathname);

    // Get conversation metadata from sidebar first (needed for title)
    let conversationMeta = null;
    let groupRoom = null;
    let title;

    if (isGroupChat) {
      groupRoom = findGroupRoomForCurrentPath();
      if (groupRoom) {
        conversationMeta = {
          create_time: getGroupRoomCreatedAt(groupRoom),
          update_time: readSignal(groupRoom, "updatedAt$"),
        };
      }
      const roomName = readSignal(groupRoom, "name$");
      title =
        (typeof roomName === "string" && roomName.trim()) ||
        document.title.replace(/\s+-\s+ChatGPT$/i, "").trim() ||
        userI18n.untitledChat;
    } else {
      // Select both regular chat links and project chat links
      const sidebarLinks = getSidebarLinks();
      const currentPath = window.location.pathname;
      // Match on resolved ids too: for freshly created chats the sidebar
      // href can still hold the WEB: draft id while the URL has the real id.
      const canonicalId = resolveConversationId(
        getConversationIdFromHref(window.location.href),
      );

      for (const link of sidebarLinks) {
        const linkId = resolveConversationId(
          getConversationIdFromHref(link.getAttribute("href")),
        );
        if (
          (canonicalId && linkId === canonicalId) ||
          link.getAttribute("href") === currentPath
        ) {
          conversationMeta = getSidebarMetadata(link);
          if (conversationMeta) break;
        }
      }

      // Get conversation title from sidebar metadata; freshly created chats
      // carry a stale fiber title (null / "New chat"), so fall back to the
      // rendered sidebar text.
      title =
        conversationMeta?.title?.trim() ||
        getSidebarTitleForConversationId(canonicalId) ||
        document.title?.replace(/\s*[-|]\s*ChatGPT$/, "").trim() ||
        userI18n.untitledChat;
    }

    // Collect all messages
    const messageDivs = getMessageElements();
    if (messageDivs.length === 0) {
      return { success: false, message: userI18n.exportNoMessages };
    }

    const messages = [];
    const imagePlaceholder =
      userI18n.exportPlaceholderImage || defaultI18n.exportPlaceholderImage;
    const filePlaceholderTemplate =
      userI18n.exportPlaceholderFileTemplate ||
      defaultI18n.exportPlaceholderFileTemplate;

    if (isGroupChat) {
      // members$ is the live member directory ({accountUserId, name, ...});
      // memberProfileSnapshots$ stays empty even in populated rooms, so only
      // use it as a fallback.
      const members = readSignal(groupRoom, "members$");
      const memberSnapshots =
        Array.isArray(members) && members.length > 0
          ? members
          : readSignal(groupRoom, "memberProfileSnapshots$");
      messageDivs.forEach((div) => {
        // Assistant bubbles nest per-segment divs with their own
        // data-message-id — only the outermost div is one message.
        if (div.parentElement?.closest("div[data-message-id]")) return;
        const calpicoMessage = extractGroupMessageFromDiv(div);
        // Skip room notices ("X created the group chat")
        if (!calpicoMessage || calpicoMessage.role === "system") return;

        let contentReferences = [];
        const chunks = [];
        const rawMessages = Array.isArray(calpicoMessage.rawMessages)
          ? calpicoMessage.rawMessages
          : [];
        rawMessages.forEach((raw) => {
          const parts = raw?.content?.parts;
          if (Array.isArray(parts)) {
            parts.forEach((part) => {
              if (typeof part === "string" && part.trim()) chunks.push(part);
            });
          }
          const refs = raw?.metadata?.content_references;
          if (Array.isArray(refs) && refs.length > 0) {
            contentReferences = contentReferences.concat(refs);
          }
        });

        let content = chunks.join("\n");
        if (!content && typeof calpicoMessage.content?.text === "string") {
          content = calpicoMessage.content.text;
        }
        if (!content && typeof calpicoMessage.preview === "string") {
          content = calpicoMessage.preview;
        }
        if (!content.trim()) return;

        let timestamp = calpicoMessage.createdAt
          ? new Date(calpicoMessage.createdAt)
          : null;
        if (timestamp && Number.isNaN(timestamp.getTime())) timestamp = null;

        messages.push({
          turnIndex: null,
          role: calpicoMessage.role || "unknown",
          senderName: resolveGroupSenderName(calpicoMessage, memberSnapshots),
          content: content.trim(),
          timestamp,
          contentReferences,
        });
      });
    } else {
      getExportRecords().forEach(({ message: messageData, turnIndex }) => {
        if (!messageData) return;
        const contentReferences = messageData.metadata?.content_references || [];

        const role = messageData.author?.role || "unknown";
        // Handle parts that can be strings or objects (like images)
        const parts = messageData.content?.parts || [];
        const contentParts = parts.map((part) => {
          if (typeof part === "string") {
            return part;
          }
          // Handle image/file objects
          if (part && typeof part === "object") {
            // Image asset pointer
            // Note: Image URLs from ChatGPT are not directly viewable (they prompt download)
            // and require authentication, so we just mark them as [Image] placeholder
            if (
              part.asset_pointer ||
              part.content_type === "image_asset_pointer"
            ) {
              return imagePlaceholder;
            }
            // File attachment
            if (part.name && part.content_type) {
              return formatTemplate(filePlaceholderTemplate, {
                fileName: part.name,
              });
            }
            // Generic object - skip
            return "";
          }
          return "";
        });
        const content = contentParts.filter(Boolean).join("\n");
        const timestamp = parseTimestamp(messageData.create_time);

        if (content.trim()) {
          messages.push({
            turnIndex,
            role,
            content: content.trim(),
            timestamp,
            contentReferences,
          });
        }
      });
    }

    if (messages.length === 0) {
      return { success: false, message: userI18n.exportExtractFailed };
    }

    // Helper function to process citations in content
    function processCitations(content, contentReferences, format) {
      if (!contentReferences || contentReferences.length === 0) {
        // Remove orphan citation markers
        return content.replace(
          /\s*citeturn\d+search\d+(?:turn\d+search\d+)*/gi,
          "",
        );
      }

      let processedContent = content;
      const citationMap = new Map();

      // Build citation map from content_references
      contentReferences.forEach((ref) => {
        if (!ref || typeof ref !== "object") return;

        const matchedText = ref.matched_text;
        const alt = ref.alt; // Pre-formatted markdown like "([Title](url))"
        const safeUrls = ref.safe_urls || [];
        const type = ref.type;

        // Skip non-citation types
        if (type === "sources_footnote" || !matchedText || matchedText === " ")
          return;

        if (matchedText && (safeUrls.length > 0 || alt)) {
          // Get the first non-utm URL or the first URL
          const url =
            safeUrls.find((u) => !u.includes("utm_source")) ||
            safeUrls[0] ||
            "";

          // Map the matched_text to citation info
          citationMap.set(matchedText.toLowerCase(), { url, alt });
        }
      });

      if (citationMap.size === 0) {
        // No valid citations, just clean up markers
        return processedContent.replace(
          /\s*citeturn\d+search\d+(?:turn\d+search\d+)*/gi,
          "",
        );
      }

      // Replace citation markers with proper formatted links
      // Sort by length descending to match longer patterns first
      const sortedMarkers = [...citationMap.keys()].sort(
        (a, b) => b.length - a.length,
      );

      for (const marker of sortedMarkers) {
        const cite = citationMap.get(marker);
        // Create case-insensitive regex for this marker
        const regex = new RegExp(
          marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          "gi",
        );

        processedContent = processedContent.replace(regex, () => {
          if (format === "markdown" && cite.alt) {
            return ` ${cite.alt}`;
          } else if (format === "plain" && cite.url) {
            try {
              const domain = new URL(cite.url).hostname.replace("www.", "");
              return ` [${domain}]`;
            } catch {
              return "";
            }
          }
          return "";
        });
      }

      // Clean up any remaining unmatched citation markers
      return processedContent.replace(
        /\s*citeturn\d+search\d+(?:turn\d+search\d+)*/gi,
        "",
      );
    }

    // Format output based on requested format
    let output = "";
    const dateFormat = userSettings.dateFormat || "locale";
    const createdLabel =
      userI18n.exportCreatedLabel || defaultI18n.exportCreatedLabel;
    const roleYou = userI18n.exportRoleYou || defaultI18n.exportRoleYou;
    const roleChatgpt =
      userI18n.exportRoleChatgpt || defaultI18n.exportRoleChatgpt;

    if (format === "markdown") {
      output = `# ${title}\n\n`;
      if (conversationMeta?.create_time) {
        const created = parseTimestamp(conversationMeta.create_time);
        if (created) output += `**${createdLabel}:** ${formatDate(created, dateFormat)}\n\n`;
      }
      output += `---\n\n`;

      messages.forEach((msg) => {
        const senderLabel =
          msg.senderName || (msg.role === "user" ? roleYou : roleChatgpt);
        const roleLabel = `**${senderLabel}**`;
        const turnStr = msg.turnIndex != null ? `#${msg.turnIndex} ` : "";
        const timeStr = msg.timestamp
          ? ` *(${formatDate(msg.timestamp, dateFormat)})*`
          : "";

        const processedContent = processCitations(
          msg.content,
          msg.contentReferences,
          "markdown",
        );
        output += `### ${turnStr}${roleLabel}${timeStr}\n\n${processedContent}\n\n---\n\n`;
      });
    } else if (format === "plain") {
      output = `${title}\n${"=".repeat(title.length)}\n\n`;
      if (conversationMeta?.create_time) {
        const created = parseTimestamp(conversationMeta.create_time);
        if (created) output += `${createdLabel}: ${formatDate(created, dateFormat)}\n\n`;
      }

      messages.forEach((msg) => {
        const roleLabel =
          msg.senderName || (msg.role === "user" ? roleYou : roleChatgpt);
        const turnStr = msg.turnIndex != null ? `#${msg.turnIndex} ` : "";
        const timeStr = msg.timestamp
          ? ` (${formatDate(msg.timestamp, dateFormat)})`
          : "";

        const processedContent = processCitations(
          msg.content,
          msg.contentReferences,
          "plain",
        );
        output += `[${turnStr}${roleLabel}]${timeStr}:\n${processedContent}\n\n`;
      });
    } else if (format === "json") {
      const exportData = {
        title,
        created: parseTimestamp(conversationMeta?.create_time)?.toISOString() || null,
        updated: parseTimestamp(conversationMeta?.update_time)?.toISOString() || null,
        messageCount: messages.length,
        messages: messages.map((msg) => ({
          turn: msg.turnIndex,
          role: msg.role,
          sender: msg.senderName || null,
          content: processCitations(msg.content, msg.contentReferences, "json"),
          timestamp: msg.timestamp ? msg.timestamp.toISOString() : null,
        })),
      };
      output = JSON.stringify(exportData, null, 2);
    }

    return {
      success: true,
      content: output,
      messageCount: messages.length,
      title: title,
    };
  } catch (error) {
    return {
      success: false,
      message: formatTemplate(userI18n.exportFailedTemplate, {
        error: error.message,
      }),
    };
  }
}
// #endregion

// #region Utils
// Stored colors come from the popup's color pickers (#rrggbb); anything else
// (missing key, corrupted storage) falls back to the built-in default.
function getSettingColor(key) {
  const value = userSettings[key];
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value)
    ? value
    : defaultTimestampColors[key];
}

function formatTimestamp(value) {
  const d = parseTimestamp(value);
  if (!d) return "";
  return formatDate(d, userSettings.dateFormat);
}

function setHoverExpanded(el, expanded) {
  const container = el.querySelector(":scope > .timestamp-stack-container");
  if (!container) return;

  const secondaryEl = container.querySelector(":scope > .timestamp-secondary");
  if (!secondaryEl) return;

  // Only expand if hover mode is classic and there's secondary content
  const hasSecondary = !!secondaryEl.textContent;
  const shouldExpand =
    expanded && hasSecondary && userSettings.hoverMode === "classic";
  secondaryEl.style.display = shouldExpand ? "block" : "none";
  el.style.paddingBottom = `${sidebarRowPadding(el) + (shouldExpand ? 13 : 0)}px`;
}
// #endregion

// #region Sidebar
function addSidebarTimestampsFiber() {
  if (userSettings.hoverMode === "inline") {
    document.querySelectorAll(".timestamp-stack-container").forEach(stamp => {
      const el = stamp.parentElement;
      const link = el.matches("a") ? el : el.querySelector('a[href*="/c/"],a[href*="/gg/"]');
      if (!link) { stamp.remove(); restoreNativeRow(el); }
    });
  }
  const isDark = isDarkTheme();
  const starredIds = normalizeStarredIdSet(userSettings.starredIds);
  const links = getSidebarLinks();
  const { hoverMode, sidebarFilterMode } = userSettings;
  const recents = document.querySelector(CHAT_RECENTS_SELECTOR);
  const showBookmarks = sidebarFilterMode === "starred" && Boolean(recents);
  // Bookmarked chat id -> title and dates, for the Bookmarks section.
  const knownChats = new Map();

  const style = {
    primaryColor: getSettingColor(
      isDark ? "colorSidebarPrimaryDark" : "colorSidebarPrimaryLight",
    ),
    secondaryColor: getSettingColor(
      isDark ? "colorSidebarSecondaryDark" : "colorSidebarSecondaryLight",
    ),
    starColor: isDark ? "#fbbf24" : "#b45309",
    fontWeight: userSettings.boldSidebarTimestamp ? "600" : "400",
    hoverMode,
  };

  // Read every row before writing to any of them: measuring a row right after
  // writing to another forces a synchronous layout per row.
  const rows = [];
  links.forEach((link) => {
    const el = link.closest(".sidebar-item") || link;
    const conversation = getSidebarMetadata(link);
    let room = null;
    if (isGroupChatPath(link.getAttribute("href") || "")) {
      for (const props of reactProps(link)) {
        if (isGroupRoom(props.room)) { room = props.room; break; }
      }
    }

    const conversationId = resolveConversationId(
      room?.id || getConversationIdFromHref(link.getAttribute("href")),
    );
    const isStarred = Boolean(conversationId && starredIds.has(conversationId));

    // Get timestamps from conversation, gizmo, or group chat room
    let createdText, updatedText;
    const dates = { created: conversation?.create_time, updated: conversation?.update_time };
    if (conversation?.create_time) {
      createdText = formatTimestamp(conversation.create_time);
      updatedText = formatTimestamp(conversation.update_time);
    } else if (room) {
      // Rooms whose history isn't loaded expose no creation time; fall back
      // to last activity rather than showing nothing (or a bogus date).
      dates.created = getGroupRoomCreatedAt(room);
      dates.updated = readSignal(room, "updatedAt$");
      updatedText = formatTimestamp(dates.updated);
      createdText = formatTimestamp(getGroupRoomCreatedAt(room)) || updatedText;
    }
    if (showBookmarks && isStarred) {
      knownChats.set(conversationId, {
        // Fiber titles lag for new chats; the rendered title doesn't.
        title: findFirstTitleText(link) || conversation?.title,
        createdText,
        updatedText,
        dates,
      });
    }
    // Recents is hidden while the Bookmarks section stands in for it.
    if (!createdText && !(userSettings.hoverMode === "inline" && dates.updated)) {
      if (userSettings.hoverMode === "inline") removeInlineTimestamp(el);
      return;
    }
    if (showBookmarks && recents.contains(link)) return;
    // Keep project folders native in compact mode.
    if (userSettings.hoverMode === "inline" && !getConversationIdFromHref(link.getAttribute("href"))) return;

    const row = { el, isStarred, dates };
    rows.push(row);
    setSidebarRowText(row, createdText, updatedText);

    // Project chats have ps-9 class which adds extra left padding (36px).
    // Project folders have an icon, so use same offset.
    // Pinned chats (new sidebar section) have a leading icon inside the link
    // that pushes the title right without using ps-9 — match the title offset.
    const isProjectChat = link.classList.contains("ps-9");
    const isProjectFolder = link.getAttribute("href")?.endsWith("/project") ||
      link.hasAttribute("data-app-action-sidebar-project-row");
    const hasLeadingIcon =
      !isProjectChat && !isProjectFolder && linkHasLeadingIcon(el);
    row.leftOffset =
      isProjectChat || isProjectFolder || hasLeadingIcon ? "36px" : "10px";
  });

  // Spaces, pages and sites aren't chats: they can't be bookmarked, and the
  // Spaces sidebar has no Bookmarks section. Every row has an icon before its
  // title (an emoji icon is text, so it can't be measured like pinned chats).
  document.querySelectorAll(SPACES_ROW_SELECTOR).forEach((el) => {
    const record = getSpacesRowMetadata(el);
    const createdText = formatTimestamp(record?.create_time);
    if (!createdText) return;
    if (userSettings.hoverMode === "inline") return;
    const row = { el, isStarred: false, leftOffset: "36px" };
    setSidebarRowText(row, createdText, formatTimestamp(record.update_time));
    rows.push(row);
  });

  rows.push(...updateBookmarksSection(showBookmarks, recents, knownChats));
  rows.forEach((row) => renderSidebarTimestamp(row, style));
  // Finish all text writes before measuring the inline columns. Read widths
  // as one batch, then reserve their space without a layout per changed row.
  const widths = [...inlineWidthQueue].filter(stamp => stamp.isConnected)
    .map(stamp => [stamp.closest(".timestamp-inline-row"), Math.ceil(stamp.getBoundingClientRect().width)]);
  inlineWidthQueue.clear();
  widths.forEach(([el, width]) => {
    const value = `${width}px`;
    if (el.style.getPropertyValue("--timestamp-inline-width") !== value) {
      el.style.setProperty("--timestamp-inline-width", value);
    }
  });

  // Titles only settle once the writes above make rows height: auto, so new
  // rows are measured afterwards (one layout for the batch) and re-anchored
  // before the browser paints.
  const unmeasured = rows.filter((row) => userSettings.hoverMode !== "inline" && !sidebarStampLayout.has(row.el));
  unmeasured.forEach((row) => measureSidebarStamp(row.el));
  unmeasured.forEach((row) => {
    if (sidebarStampLayout.has(row.el)) renderSidebarTimestamp(row, style);
  });
}

// With the bookmark filter on, this section takes the place of ChatGPT's
// Recents. Hiding Recents as a whole, rather than its unbookmarked rows, also
// stops ChatGPT loading older chats into it.
const bookmarksSection = document.createElement("section");
bookmarksSection.addEventListener("click", openBookmarkInPlace);
// Bookmark id -> its row in the section.
const bookmarkRows = new Map();
// Class names read from ChatGPT's sidebar, so the section matches it.
let bookmarksTemplate = null;

// Returns the rows that have dates to stamp.
function updateBookmarksSection(show, recents, knownChats) {
  bookmarksTemplate ||= readBookmarksTemplate(recents);
  if (!show || !bookmarksTemplate) {
    if (bookmarksSection.isConnected) bookmarksSection.remove();
    if (recents?.style.display === "none") recents.style.display = "";
    return [];
  }
  if (recents.previousElementSibling !== bookmarksSection) {
    recents.before(bookmarksSection);
  }
  if (recents.style.display !== "none") recents.style.display = "none";

  const currentId = resolveConversationId(
    getConversationIdFromHref(window.location.href),
  );
  const items = [...userSettings.bookmarks]
    .sort((a, b) => (b.starredAt || "").localeCompare(a.starredAt || ""))
    .map((bookmark) => {
      const known = knownChats.get(bookmark.id);
      return {
        id: bookmark.id,
        href: `/${bookmark.kind === "group" ? "gg" : "c"}/${encodeURIComponent(bookmark.id)}`,
        title: known?.title || bookmark.title || userI18n.untitledChat,
        active: bookmark.id === currentId,
        createdText: known?.createdText,
        updatedText: known?.updatedText,
        dates: known?.dates,
      };
    });
  const state = JSON.stringify([
    userI18n.sidebarBookmarksHeading,
    userI18n.sidebarBookmarksEmpty,
    items,
  ]);
  if (renderedState.get(bookmarksSection) !== state) {
    buildBookmarksSection(items);
    renderedState.set(bookmarksSection, state);
  }

  return items
    .filter((item) => item.createdText || (userSettings.hoverMode === "inline" && item.dates?.updated))
    .map((item) => {
      const row = { el: bookmarkRows.get(item.id), isStarred: false, leftOffset: "10px", dates: item.dates };
      setSidebarRowText(row, item.createdText, item.updatedText);
      return row;
    });
}

// Recents' heading and list, and the element path from a chat row down to
// its link. Recents keeps its heading while collapsed, but not its rows.
function readBookmarksTemplate(recents) {
  const heading = recents?.firstElementChild?.firstElementChild;
  const list = recents?.querySelector("[data-appearance]");
  const link =
    recents?.querySelector("a[data-interactive-row-link]") ||
    getSidebarLinks().find((el) => el.hasAttribute("data-interactive-row-link"));
  const row = link?.closest(".sidebar-item");
  if (!heading?.firstElementChild || !list || !row) return null;
  const rowPath = [];
  for (let node = link; node !== row.parentElement; node = node.parentElement) {
    rowPath.unshift({ tag: node.tagName, className: node.className });
  }
  return {
    section: recents.className,
    navSection: recents.firstElementChild.className,
    heading: heading.className,
    headingText: heading.firstElementChild.className,
    list: list.className,
    rowPath,
  };
}

function buildBookmarksSection(items) {
  const template = bookmarksTemplate;
  const shell = (tag, className) =>
    Object.assign(document.createElement(tag), { className });
  const headingRow = (text) => {
    const row = shell("div", template.heading);
    row.append(Object.assign(shell("div", template.headingText), { textContent: text }));
    return row;
  };

  const list = shell("div", template.list);
  bookmarkRows.clear();
  for (const item of items) {
    const path = template.rowPath.map(({ tag, className }) => shell(tag, className));
    path.reduce((parent, child) => parent.appendChild(child));
    const row = path[0];
    const link = path[path.length - 1];
    link.setAttribute("href", item.href);
    link.append(Object.assign(shell("span", "truncate"), { textContent: item.title }));
    // ChatGPT's row classes highlight a selected thread.
    if (item.active) row.setAttribute("data-app-action-sidebar-thread-selected", "true");
    list.append(row);
    bookmarkRows.set(item.id, row);
  }
  if (!items.length) list.append(headingRow(userI18n.sidebarBookmarksEmpty));

  const navSection = shell("div", template.navSection);
  navSection.append(headingRow(userI18n.sidebarBookmarksHeading), list);
  bookmarksSection.className = template.section;
  bookmarksSection.replaceChildren(navSection);
}

// Open a bookmark without reloading the page, the way ChatGPT's links do.
// Modified clicks keep the browser's behavior (new tab, new window).
function openBookmarkInPlace(event) {
  const link = event.target.closest("a[href]");
  const router = window.__reactRouterDataRouter;
  if (!link || typeof router?.navigate !== "function") return;
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return;
  }
  event.preventDefault();
  router.navigate(link.getAttribute("href"));
}

// Preserve native sizing when switching from the existing two-line modes.
const nativeSidebarStyles = new WeakMap();
const inlineWidthQueue = new Set();
function rememberNativeRow(el) {
  if (!nativeSidebarStyles.has(el)) nativeSidebarStyles.set(el, el.getAttribute("style"));
}
function restoreNativeRow(el) {
  const style = nativeSidebarStyles.get(el);
  if (style == null) el.removeAttribute("style");
  else el.setAttribute("style", style);
}
function removeInlineTimestamp(el) {
  if (!el.classList.contains("timestamp-inline-row")) return;
  el.querySelectorAll(".timestamp-inline-container").forEach(node => node.remove());
  el.querySelectorAll(".timestamp-inline-link").forEach(node => node.classList.remove("timestamp-inline-link"));
  el.classList.remove("timestamp-inline-row");
  restoreNativeRow(el);
}
const inlineSidebarStyle = document.createElement("style");
inlineSidebarStyle.textContent = `
.timestamp-inline-link {
  display: flex !important;
  align-items: center;
  gap: 8px;
  min-width: 0 !important;
}
.timestamp-inline-link [data-thread-title] {
  min-width: 0 !important;
  overflow: hidden !important;
  flex: 1;
}
.timestamp-inline-link [data-thread-title] > * > *,
.timestamp-inline-link [data-thread-title] [data-marquee-content] {
  transform: none !important;
  animation: none !important;
  max-width: 100%;
  width: 100%;
}
.timestamp-inline-link [data-thread-title] [data-marquee-content] {
  display: block !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  white-space: nowrap !important;
}
.timestamp-inline-link [data-thread-title]:not(:has([data-marquee-content])) {
  text-overflow: ellipsis;
  white-space: nowrap;
}
.timestamp-inline-row {
  padding-inline-end: calc(var(--timestamp-inline-width,32px) + 12px) !important;
}
.timestamp-inline-row > .contents > :has(button) {
  inset-inline-end: calc(var(--timestamp-inline-width,32px) + 10px) !important;
}
.timestamp-inline-container {
  position: absolute;
  inset-inline-end: 10px;
  top: 50%;
  transform: translateY(-50%);
  display: grid;
  align-items: center;
  text-align: end;
  gap: 3px;
  pointer-events: none;
  white-space: nowrap;
  font: 10px/1.2 system-ui;
  color: inherit;
}
.timestamp-inline-primary,.timestamp-inline-secondary {
  grid-area: 1/1;
}
.timestamp-inline-primary {
  opacity: .35;
}
.timestamp-inline-secondary {
  visibility: hidden;
  opacity: .48;
  font-size: 9px;
}
.timestamp-inline-secondary[data-different-source="true"] {
  opacity: .75;
}
.timestamp-inline-row:is(:hover,:focus-within) .timestamp-inline-primary {
  visibility: hidden;
}
.timestamp-inline-row:is(:hover,:focus-within) .timestamp-inline-secondary {
  visibility: visible;
}
.timestamp-inline-star {
  grid-area: 1/2;
  width: 10px;
  height: 10px;
  color: #b8860b;
  display: inline-flex;
}
.timestamp-inline-star svg {
  width: 100%;
  height: 100%;
}
`;
document.head.append(inlineSidebarStyle);
function renderInlineTimestamp({el, primaryText, secondaryText, isStarred}, style) {
  const link = el.matches("a") ? el : el.querySelector('a[href*="/c/"],a[href*="/gg/"]');
  if (!link) return;
  let container = link.querySelector(":scope > .timestamp-inline-container");
  const differentSource = userSettings.displayMode !== userSettings.hoverDetailSource;
  const detailColor = differentSource ? style.secondaryColor : "inherit";
  const state = JSON.stringify([primaryText, secondaryText, isStarred, detailColor, differentSource]);
  if (container && renderedState.get(container) === state) return;
  if (!container) {
    el.querySelector(":scope > .timestamp-stack-container")?.remove();
    restoreNativeRow(el);
    sidebarStampLayout.delete(el);
    el.classList.add("timestamp-inline-row");
    link.classList.add("timestamp-inline-link");
    container = document.createElement("span");
    container.className = "timestamp-inline-container";
    container.setAttribute("aria-hidden", "true");
    const primary = document.createElement("span");
    primary.className = "timestamp-inline-primary";
    const secondary = document.createElement("span");
    secondary.className = "timestamp-inline-secondary";
    const star = document.createElement("span");
    star.className = "timestamp-inline-star";
    star.innerHTML = STAR_ICON_SVG;
    container.append(primary, secondary, star);
    link.append(container);
  }
  container.querySelector(".timestamp-inline-primary").textContent = primaryText || "";
  const detail = container.querySelector(".timestamp-inline-secondary");
  detail.textContent = secondaryText || "";
  detail.style.color = detailColor;
  detail.dataset.differentSource = String(differentSource);
  container.querySelector(".timestamp-inline-star").style.display = isStarred ? "" : "none";
  el.dataset.timestampAdded = "true";
  inlineWidthQueue.add(container);
  renderedState.set(container, state);
}

function setSidebarRowText(row, createdText, updatedText) {
  if (userSettings.hoverMode === "inline") {
    row.primaryText = formatCompactDate(row.dates?.[userSettings.displayMode], userSettings.inlineDateFormat, userSettings.dateFormat);
    row.secondaryText = formatCompactDate(row.dates?.[userSettings.hoverDetailSource], userSettings.hoverDetailFormat, userSettings.dateFormat);
    return;
  }
  const hoverActive = userSettings.hoverMode !== "disabled";
  if (userSettings.displayMode === "updated") {
    // Show updated time by default, created on hover
    row.primaryText = updatedText || createdText;
    row.secondaryText = hoverActive && updatedText ? createdText : "";
  } else {
    // Show created time by default, updated on hover
    row.primaryText = createdText;
    row.secondaryText = hoverActive ? updatedText : "";
  }
}

function renderSidebarTimestamp(row, style) {
  rememberNativeRow(row.el);
  if (style.hoverMode === "inline") {
    renderInlineTimestamp(row, style);
    return;
  }
  removeInlineTimestamp(row.el);
  const { el, primaryText, secondaryText, isStarred, leftOffset } = row;
  const { primaryColor, secondaryColor, starColor, fontWeight, hoverMode } =
    style;

  let container = el.querySelector(":scope > .timestamp-stack-container");
  const layout = sidebarStampLayout.get(el);
  const state = [
    primaryText,
    secondaryText,
    isStarred,
    leftOffset,
    layout?.top,
    layout?.paddingBottom,
    primaryColor,
    secondaryColor,
    starColor,
    fontWeight,
    hoverMode,
  ].join("|");
  if (container && renderedState.get(container) === state) return;

  if (!container) {
    container = document.createElement("div");
    container.className = "timestamp-stack-container";
    container.style.cssText = `
      position: absolute;
      left: ${leftOffset};
      right: 10px;
      overflow: hidden;
      font-size: 10px;
      font-family: ui-monospace,'SF Mono',Monaco,monospace;
      opacity: 0.9;
      pointer-events: none;
      line-height: 12px;
      white-space: nowrap;
      padding-right: 14px;
    `;

    const secondaryLine = document.createElement("div");
    secondaryLine.className = "timestamp-secondary";
    secondaryLine.style.display = "none";

    const primaryLine = document.createElement("div");
    primaryLine.className = "timestamp-primary";

    container.appendChild(primaryLine);
    container.appendChild(secondaryLine);

    el.style.position = "relative";
    el.style.overflow = "hidden";
    if (el.classList.contains("sidebar-item")) el.style.height = "auto";
    el.appendChild(container);
  } else if (container.style.left !== leftOffset) {
    container.style.left = leftOffset;
  }
  container.style.top = layout ? `${layout.top}px` : "";
  container.style.bottom = layout ? "auto" : "4px";

  const primaryLine = container.querySelector(":scope > .timestamp-primary");
  const secondaryLine = container.querySelector(
    ":scope > .timestamp-secondary",
  );
  if (!primaryLine || !secondaryLine) return;

  let starBadge = container.querySelector(":scope > .timestamp-star");
  if (!starBadge) {
    starBadge = document.createElement("span");
    starBadge.className = "timestamp-star";
    starBadge.style.cssText = `
      position: absolute;
      top: 0;
      right: 0;
      width: 11px;
      height: 11px;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0.95;
    `;
    starBadge.innerHTML = STAR_ICON_SVG;
    container.appendChild(starBadge);
  }

  container.style.fontWeight = fontWeight;
  primaryLine.style.color = primaryColor;
  secondaryLine.style.color = secondaryColor;
  primaryLine.style.paddingRight = "14px";
  secondaryLine.style.paddingRight = "14px";

  primaryLine.textContent = primaryText;
  secondaryLine.textContent = secondaryText;
  starBadge.style.display = isStarred ? "flex" : "none";
  starBadge.style.color = starColor;

  // Handle display based on hover mode
  if (hoverMode === "disabled" || !secondaryText) {
    // No hover - hide secondary, reset swap styles
    secondaryLine.style.display = "none";
    el.style.paddingBottom = `${sidebarRowPadding(el)}px`;
    primaryLine.style.transition = "none";
    primaryLine.style.transform = "none";
    primaryLine.style.opacity = "";
    secondaryLine.style.opacity = "";
    container.classList.remove("timestamp-swap-mode");
  } else if (hoverMode === "swap") {
    // Swap mode - primary slides up & fades, secondary slides up from below
    el.style.paddingBottom = `${sidebarRowPadding(el)}px`;
    container.classList.add("timestamp-swap-mode");
    container.style.overflow = "hidden";

    // Keep the right state if this runs while hovered
    const swapped = el.matches(":hover") || el.contains(document.activeElement);

    // Primary line setup
    primaryLine.style.display = "block";
    primaryLine.style.transition =
      "transform .3s cubic-bezier(0.76, 0, 0.24, 1), opacity .3s ease";
    primaryLine.style.transform = swapped ? "translateY(-100%)" : "translateY(0)";
    primaryLine.style.opacity = swapped ? "0" : "1";

    // Secondary line: stacked on top, starts below
    secondaryLine.style.position = "absolute";
    secondaryLine.style.top = "0";
    secondaryLine.style.left = "0";
    secondaryLine.style.right = "0";
    secondaryLine.style.display = "block";
    secondaryLine.style.transition =
      "transform .3s cubic-bezier(0.76, 0, 0.24, 1), opacity .3s ease";
    secondaryLine.style.transform = swapped ? "translateY(0)" : "translateY(100%)";
    secondaryLine.style.opacity = swapped ? "1" : "0";

    if (!el.dataset.timestampSwapBound) {
      const swapIn = () => {
        if (userSettings.hoverMode !== "swap") return;
        const p = el.querySelector(".timestamp-primary");
        const s = el.querySelector(".timestamp-secondary");
        if (p) {
          p.style.transform = "translateY(-100%)";
          p.style.opacity = "0";
        }
        if (s) {
          s.style.transform = "translateY(0)";
          s.style.opacity = "1";
        }
      };
      const swapOut = () => {
        if (userSettings.hoverMode !== "swap") return;
        const p = el.querySelector(".timestamp-primary");
        const s = el.querySelector(".timestamp-secondary");
        if (p) {
          p.style.transform = "translateY(0)";
          p.style.opacity = "1";
        }
        if (s) {
          s.style.transform = "translateY(100%)";
          s.style.opacity = "0";
        }
      };
      el.addEventListener("mouseenter", swapIn);
      el.addEventListener("mouseleave", swapOut);
      el.addEventListener("focusin", swapIn);
      el.addEventListener("focusout", swapOut);
      el.dataset.timestampSwapBound = "true";
    }
  } else if (hoverMode === "classic") {
    // Classic mode - show secondary line below on hover
    container.classList.remove("timestamp-swap-mode");
    primaryLine.style.transition = "none";
    primaryLine.style.transform = "none";
    primaryLine.style.opacity = "";
    secondaryLine.style.position = "";
    secondaryLine.style.top = "";
    secondaryLine.style.left = "";
    secondaryLine.style.right = "";
    secondaryLine.style.transition = "";
    secondaryLine.style.transform = "";
    secondaryLine.style.transformOrigin = "";
    secondaryLine.style.opacity = "";

    if (!el.dataset.timestampHoverBound) {
      const expand = () => setHoverExpanded(el, true);
      const collapse = () => setHoverExpanded(el, false);
      el.addEventListener("mouseenter", expand);
      el.addEventListener("mouseleave", collapse);
      el.addEventListener("focusin", expand);
      el.addEventListener("focusout", collapse);
      el.dataset.timestampHoverBound = "true";
    }

    // Keep the right state if this runs while hovered
    const isHovered = el.matches(":hover");
    const isFocused = el.contains(document.activeElement);
    setHoverExpanded(el, isHovered || isFocused);
  }

  el.dataset.timestampAdded = "true";
  renderedState.set(container, state);
}
// #endregion

// #region Chat
// A stamp sits at the top of its message. Replies that worked first show a
// "Worked for 1m 39s" block between the turn's start marker and the message,
// so their stamp goes right after the marker, above that block.
function locateChatStamp(div) {
  const marker = getAgentTurnStart(div);
  let next = marker?.nextElementSibling;
  const markerStamp = next?.classList.contains("chatgpt-timestamp") ? next : null;
  if (markerStamp) next = markerStamp.nextElementSibling;
  const anchor = marker && next !== div ? marker : null;
  const ownStamp = div.querySelector(":scope > .chatgpt-timestamp");
  // The stamp already in the right place comes first.
  const stamps = anchor ? [markerStamp, ownStamp] : [ownStamp, markerStamp];
  return { anchor, stamps: stamps.filter(Boolean) };
}

function addChatTimestamps() {
  const { chatTimestampEnabled, chatTimestampPosition, dateFormat } =
    userSettings;
  const isDark = isDarkTheme();
  const timestampColor = getSettingColor(
    isDark ? "colorChatDark" : "colorChatLight",
  );
  // Chat stamps historically rendered bold, so bold stays the default when
  // the setting is missing.
  const chatBold = userSettings.boldChatTimestamp !== false;

  const justifyContent =
    chatTimestampPosition === "left"
      ? "flex-start"
      : chatTimestampPosition === "right"
        ? "flex-end"
        : "center";

  // Group chat rooms natively show message times, so no stamps are added
  // there — only clean up leftovers (e.g. added by an older version).
  const isGroupChat = isGroupChatPath(window.location.pathname);

  const records = !chatTimestampEnabled || isGroupChat
    ? getMessageElements().map(element => ({ element }))
    : getMessageRecords();
  records.forEach(({ element: div, message, turnIndex }) => {
    const { anchor, stamps } = locateChatStamp(div);

    // If chat timestamps are disabled, remove any existing ones and clear marker.
    if (!chatTimestampEnabled || isGroupChat) {
      div
        .querySelectorAll(".chatgpt-timestamp")
        .forEach((el) => el.remove());
      stamps.forEach((el) => el.remove());
      delete div.dataset.timestampAdded;
      return;
    }

    const date = parseTimestamp(message?.create_time);
    if (!date) {
      stamps.forEach((el) => el.remove());
      delete div.dataset.timestampAdded;
      return;
    }

    const formatted = formatDate(date, dateFormat);
    if (!formatted) return;

    // Double-check that chat timestamps are still enabled before adding.
    if (!userSettings.chatTimestampEnabled) return;

    let [timestampEl, ...extraStamps] = stamps;
    extraStamps.forEach((el) => el.remove());
    if (!timestampEl) {
      timestampEl = document.createElement("span");
      timestampEl.className = "chatgpt-timestamp";
    }
    // The "Worked for" block can appear after the stamp, so placement is
    // checked even when nothing else changed.
    if (anchor) {
      if (anchor.nextElementSibling !== timestampEl) anchor.after(timestampEl);
    } else if (timestampEl.parentElement !== div) {
      div.insertBefore(timestampEl, div.firstChild);
    }

    const indexText = turnIndex == null ? "" : `#${turnIndex}`;
    const state = [indexText, formatted, timestampColor, chatBold, justifyContent]
      .join("|");
    if (renderedState.get(timestampEl) === state) return;

    let indexEl = timestampEl.querySelector(":scope > .chatgpt-turn-index");
    let timeEl = timestampEl.querySelector(":scope > .chatgpt-turn-time");
    if (!indexEl || !timeEl) {
      timestampEl.textContent = "";
      indexEl = document.createElement("span");
      indexEl.className = "chatgpt-turn-index";
      timeEl = document.createElement("span");
      timeEl.className = "chatgpt-turn-time";
      timestampEl.append(indexEl, timeEl);
    }

    indexEl.textContent = indexText;
    indexEl.style.display = indexText ? "inline-block" : "none";
    timeEl.textContent = formatted;

    timestampEl.style.cssText = `
      font-size: 11px;
      color: ${timestampColor};
      font-weight: ${chatBold ? "600" : "400"};
      margin-bottom: 4px;
      display: flex;
      width: 100%;
      align-items: baseline;
      justify-content: ${justifyContent};
      gap: 6px;
      font-family: ui-monospace, 'SF Mono', Monaco, monospace;
    `;
    indexEl.style.cssText = `
      opacity: 0.85;
      font-weight: ${chatBold ? "700" : "500"};
    `;

    // Mark as processed.
    div.dataset.timestampAdded = "true";
    renderedState.set(timestampEl, state);
  });
}
// #endregion

// #region Init
function refreshTimestamps() {
  // Keep the WEB: draft id -> real id map fresh so sidebar star badges and
  // popup lookups match chats created this session.
  recordDraftIdMapping();
  addSidebarTimestampsFiber();
  addChatTimestamps();
}

function startRehydrationLoop() {
  // Background tabs show nothing, so skip them and catch up when shown.
  setInterval(() => {
    if (!document.hidden) refreshTimestamps();
  }, 1500);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshTimestamps();
  });
}

setTimeout(startRehydrationLoop, 2000);
// #endregion
