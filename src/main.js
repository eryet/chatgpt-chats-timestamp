// #region Settings
const defaultI18n = {
  scrollToTurnSuccessTemplate: "Scrolled to turn #{{turnIndex}}",
  scrollToTurnNotFoundTemplate: "Turn #{{turnIndex}} not found",
  exportChatContainerMissing: "Could not find chat container",
  exportNoMessages: "No messages found in this chat",
  exportExtractFailed: "Could not extract message content",
  exportFailedTemplate: "Export failed: {{error}}",
  untitledChat: "Untitled Chat",
  exportCreatedLabel: "Created",
  exportRoleYou: "You",
  exportRoleChatgpt: "ChatGPT",
  exportPlaceholderImage: "[Image]",
  exportPlaceholderFileTemplate: "[File: {{fileName}}]",
};

let userSettings = {
  dateFormat: "locale",
  displayMode: "created",
  hoverEnabled: true,
  chatTimestampEnabled: true,
  chatTimestampPosition: "center",
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

// #region Event Listeners
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.data?.type === "TIMESTAMP_SETTINGS_UPDATE") {
    userSettings = { ...userSettings, ...event.data.settings };
    if (event.data?.i18n) {
      const nextI18n = { ...defaultI18n };
      Object.entries(event.data.i18n).forEach(([key, value]) => {
        if (value) nextI18n[key] = value;
      });
      userI18n = nextI18n;
    }

    // Clear chat timestamp marks when settings change to force re-render
    document.querySelectorAll("div[data-message-id]").forEach((div) => {
      if (div.dataset.timestampAdded) {
        const existingTimestamp = div.querySelector(".chatgpt-timestamp");
        if (existingTimestamp) {
          existingTimestamp.remove();
        }
        delete div.dataset.timestampAdded;
      }
    });

    addSidebarTimestampsFiber(); // Refresh sidebar with new settings
    addChatTimestamps(); // Refresh chat messages with new settings
  }

  if (event.data?.type === "SCROLL_TO_TURN") {
    const result = scrollToTurn(event.data.turnIndex);
    window.postMessage(
      {
        type: "SCROLL_TO_TURN_RESULT",
        result: result,
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

// #region Scroll
function scrollToTurn(targetTurnIndex) {
  const timestamps = document.querySelectorAll(".chatgpt-timestamp");

  for (const timestamp of timestamps) {
    const turnIndexEl = timestamp.querySelector(".chatgpt-turn-index");
    const turnText = turnIndexEl?.textContent?.trim();
    if (!turnText) continue;

    const turnIndex = parseInt(turnText.replace("#", ""), 10);
    if (turnIndex !== targetTurnIndex) continue;

    // Use the <article> element which has proper scroll-margin-top for the fixed header
    const articleEl = timestamp.closest(
      "article[data-testid^='conversation-turn-']",
    );
    if (articleEl) {
      articleEl.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      timestamp.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    return {
      success: true,
      message: formatTemplate(userI18n.scrollToTurnSuccessTemplate, {
        turnIndex: targetTurnIndex,
      }),
    };
  }

  return {
    success: false,
    message: formatTemplate(userI18n.scrollToTurnNotFoundTemplate, {
      turnIndex: targetTurnIndex,
    }),
  };
}
// #endregion

// #region Export
function exportCurrentChat(format = "markdown") {
  try {
    // Find the conversation data from React fiber
    const mainElement = document.querySelector("main");
    if (!mainElement) {
      return { success: false, message: userI18n.exportChatContainerMissing };
    }

    // Get conversation metadata from sidebar first (needed for title)
    let conversationMeta = null;
    // Select both regular chat links and project chat links
    const sidebarLinks = document.querySelectorAll(
      'a[href^="/c/"], a[href*="/c/"][data-sidebar-item="true"]',
    );
    const currentPath = window.location.pathname;

    for (const link of sidebarLinks) {
      if (
        link.getAttribute("href") === currentPath ||
        link.classList.contains("bg-token-sidebar-surface-secondary")
      ) {
        const fiberKey = Object.keys(link).find((k) =>
          k.startsWith("__reactFiber$"),
        );
        if (fiberKey) {
          let fiber = link[fiberKey];
          let depth = 0;
          while (fiber && depth < 25) {
            const props = fiber.memoizedProps;
            if (props?.conversation?.create_time) {
              conversationMeta = props.conversation;
              break;
            }
            fiber = fiber.return;
            depth++;
          }
        }
        if (conversationMeta) break;
      }
    }

    // Get conversation title from sidebar metadata
    const title = conversationMeta?.title?.trim() || userI18n.untitledChat;

    // Collect all messages
    const messageDivs = document.querySelectorAll("div[data-message-id]");
    if (messageDivs.length === 0) {
      return { success: false, message: userI18n.exportNoMessages };
    }

    const messages = [];
    const imagePlaceholder =
      userI18n.exportPlaceholderImage || defaultI18n.exportPlaceholderImage;
    const filePlaceholderTemplate =
      userI18n.exportPlaceholderFileTemplate ||
      defaultI18n.exportPlaceholderFileTemplate;
    messageDivs.forEach((div) => {
      const fiberKey = Object.keys(div).find((k) =>
        k.startsWith("__reactFiber$"),
      );
      if (!fiberKey) return;

      let fiber = div[fiberKey];
      let depth = 0;
      let messageData = null;
      let turnIndex = null;
      let contentReferences = [];

      while (fiber && depth < 150) {
        const props = fiber.memoizedProps;

        // Get turnIndex
        if (turnIndex == null && props?.turnIndex != null) {
          turnIndex = props.turnIndex;
        }

        // Get message data
        if (!messageData && props?.message?.content?.parts) {
          messageData = props.message;
        }

        // Get content_references for citations
        if (
          contentReferences.length === 0 &&
          props?.message?.metadata?.content_references?.length > 0
        ) {
          contentReferences = props.message.metadata.content_references;
        }

        if (messageData && turnIndex != null) break;
        fiber = fiber.return;
        depth++;
      }

      if (!messageData) return;

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
      const timestamp = messageData.create_time
        ? new Date(messageData.create_time * 1000)
        : null;

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
      if (conversationMeta) {
        const created = new Date(conversationMeta.create_time);
        output += `**${createdLabel}:** ${formatDate(created, dateFormat)}\n\n`;
      }
      output += `---\n\n`;

      messages.forEach((msg) => {
        const roleLabel =
          msg.role === "user" ? `**${roleYou}**` : `**${roleChatgpt}**`;
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
      if (conversationMeta) {
        const created = new Date(conversationMeta.create_time);
        output += `${createdLabel}: ${formatDate(created, dateFormat)}\n\n`;
      }

      messages.forEach((msg) => {
        const roleLabel = msg.role === "user" ? roleYou : roleChatgpt;
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
        created: conversationMeta?.create_time
          ? new Date(conversationMeta.create_time).toISOString()
          : null,
        updated: conversationMeta?.update_time
          ? new Date(conversationMeta.update_time).toISOString()
          : null,
        messageCount: messages.length,
        messages: messages.map((msg) => ({
          turn: msg.turnIndex,
          role: msg.role,
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
function formatTimestamp(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return formatDate(d, userSettings.dateFormat);
}

function setHoverExpanded(el, expanded) {
  const container = el.querySelector(":scope > .timestamp-stack-container");
  if (!container) return;

  const secondaryEl = container.querySelector(":scope > .timestamp-secondary");
  if (!secondaryEl) return;

  // Only expand if hover is enabled and there's secondary content
  const hasSecondary = !!secondaryEl.textContent;
  const shouldExpand = expanded && hasSecondary && userSettings.hoverEnabled;
  secondaryEl.style.display = shouldExpand ? "block" : "none";
  el.style.paddingBottom = shouldExpand ? "28px" : "15px";
}
// #endregion

// #region Sidebar
function addSidebarTimestampsFiber() {
  const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  // Select both regular chat links (/c/...) and project chat links (/g/g-p-.../c/...)
  const links = document.querySelectorAll(
    'a[href^="/c/"], a[href*="/c/"][data-sidebar-item="true"]',
  );

  const primaryColor = isDark ? "#e3e3e3" : "#4B5563";
  const secondaryColor = isDark ? "#81c995" : "#15803D";

  links.forEach((el) => {
    // find fiber and conversation
    const fiberKey = Object.keys(el).find((k) => k.startsWith("__reactFiber$"));
    if (!fiberKey) return;

    let fiber = el[fiberKey];
    let depth = 0;
    let conversation = null;
    while (fiber && depth < 25) {
      const props = fiber.memoizedProps;
      if (props?.conversation?.create_time) {
        conversation = props.conversation;
        break;
      }
      fiber = fiber.return;
      depth++;
    }
    if (!conversation?.create_time) return;

    const createdText = formatTimestamp(conversation.create_time);
    const updatedText = formatTimestamp(conversation.update_time);
    if (!createdText) return;

    // Determine what to show based on settings
    const { displayMode, hoverEnabled } = userSettings;

    let primaryText, secondaryText;
    if (displayMode === "updated") {
      // Show updated time by default, created on hover
      primaryText = updatedText || createdText;
      secondaryText = hoverEnabled && updatedText ? createdText : "";
    } else {
      // Show created time by default, updated on hover
      primaryText = createdText;
      secondaryText = hoverEnabled ? updatedText : "";
    }

    let container = el.querySelector(":scope > .timestamp-stack-container");
    if (!container) {
      container = document.createElement("div");
      container.className = "timestamp-stack-container";
      // Project chats have ps-9 class which adds extra left padding (36px)
      const isProjectChat = el.classList.contains("ps-9");
      const leftOffset = isProjectChat ? "36px" : "10px";
      container.style.cssText = `
        position: absolute;
        bottom: 4px;
        left: ${leftOffset};
        font-size: 10px;
        font-family: ui-monospace,'SF Mono',Monaco,monospace;
        opacity: 0.9;
        pointer-events: none;
        line-height: 12px;
        white-space: nowrap;
      `;

      const secondaryLine = document.createElement("div");
      secondaryLine.className = "timestamp-secondary";
      secondaryLine.style.display = "none";
      secondaryLine.style.color = secondaryColor;

      const primaryLine = document.createElement("div");
      primaryLine.className = "timestamp-primary";
      primaryLine.style.color = primaryColor;

      container.appendChild(primaryLine);
      container.appendChild(secondaryLine);

      el.style.position = "relative";
      el.appendChild(container);
    }

    const primaryLine = container.querySelector(":scope > .timestamp-primary");
    const secondaryLine = container.querySelector(
      ":scope > .timestamp-secondary",
    );
    if (!primaryLine || !secondaryLine) return;

    primaryLine.style.color = primaryColor;
    secondaryLine.style.color = secondaryColor;

    primaryLine.textContent = primaryText;
    secondaryLine.textContent = secondaryText;

    // Handle display based on settings
    if (!hoverEnabled || !secondaryText) {
      // No hover - hide secondary
      secondaryLine.style.display = "none";
      el.style.paddingBottom = "15px";
    } else {
      // Hover mode - bind handlers
      if (!el.dataset.timestampHoverBound) {
        const expand = () => setHoverExpanded(el, true);
        const collapse = () => setHoverExpanded(el, false);
        el.addEventListener("mouseenter", expand);
        el.addEventListener("mouseleave", collapse);
        el.addEventListener("focusin", expand);
        el.addEventListener("focusout", collapse);
        el.dataset.timestampHoverBound = "true";
      }

      // Keep the right state if the loop runs while hovered
      const isHovered = el.matches(":hover");
      const isFocused = el.contains(document.activeElement);
      setHoverExpanded(el, isHovered || isFocused);
    }

    el.dataset.timestampAdded = "true";
  });
}
// #endregion

// #region Chat
function addChatTimestamps() {
  const { chatTimestampEnabled, chatTimestampPosition, dateFormat } =
    userSettings;
  const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const timestampColor = isDark ? "#afafaf" : "#4B5563";

  const justifyContent =
    chatTimestampPosition === "left"
      ? "flex-start"
      : chatTimestampPosition === "right"
        ? "flex-end"
        : "center";

  document.querySelectorAll("div[data-message-id]").forEach((div) => {
    let timestampEl = div.querySelector(":scope > .chatgpt-timestamp");

    // If chat timestamps are disabled, remove any existing ones and clear marker.
    if (!chatTimestampEnabled) {
      if (timestampEl) timestampEl.remove();
      delete div.dataset.timestampAdded;
      return;
    }

    // Skip if already processed and has timestamp.
    if (div.dataset.timestampAdded && timestampEl) return;

    // Find fiber and traverse upwards to locate message timestamp.
    const fiberKey = Object.keys(div).find((k) =>
      k.startsWith("__reactFiber$"),
    );
    if (!fiberKey) return;

    let fiber = div[fiberKey];
    let depth = 0;
    let timestampSeconds = null;
    let turnIndex = null;
    while (fiber && depth < 150) {
      const props = fiber.memoizedProps;

      if (turnIndex == null) {
        const candidateTurnIndex = props?.turnIndex ?? null;
        if (candidateTurnIndex != null) turnIndex = candidateTurnIndex;
      }

      if (timestampSeconds == null) {
        const messages = props?.messages;
        const candidate = messages?.[0]?.create_time;
        if (candidate != null) timestampSeconds = candidate;
      }

      if (timestampSeconds != null && turnIndex != null) break;
      fiber = fiber.return;
      depth++;
    }
    if (!timestampSeconds) return;

    const timestampSecondsNumber = Number(timestampSeconds);
    if (!Number.isFinite(timestampSecondsNumber)) return;
    const date = new Date(timestampSecondsNumber * 1000);
    if (Number.isNaN(date.getTime())) return;

    const formatted = formatDate(date, dateFormat);
    if (!formatted) return;

    // Double-check that chat timestamps are still enabled before adding.
    if (!userSettings.chatTimestampEnabled) return;

    if (!timestampEl) {
      timestampEl = document.createElement("span");
      timestampEl.className = "chatgpt-timestamp";
      div.insertBefore(timestampEl, div.firstChild);
    }

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

    const indexText = turnIndex == null ? "" : `#${turnIndex}`;
    indexEl.textContent = indexText;
    indexEl.style.display = indexText ? "inline-block" : "none";
    timeEl.textContent = formatted;

    timestampEl.style.cssText = `
      font-size: 11px;
      color: ${timestampColor};
      font-weight: 600;
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
      font-weight: 700;
    `;

    // Mark as processed.
    div.dataset.timestampAdded = "true";
  });
}
// #endregion

// #region Init
function startRehydrationLoop() {
  let lastCount = 0;
  setInterval(() => {
    // Count both regular chat links and project chat links
    const chatLinks = document.querySelectorAll(
      'a[href^="/c/"], a[href*="/c/"][data-sidebar-item="true"]',
    );
    const currentCount = chatLinks.length;

    if (currentCount !== lastCount) {
      // console.log(
      //   `[Timestamp] sidebar count changed (${lastCount} → ${currentCount}) — refreshing`
      // );
      lastCount = currentCount;
      addSidebarTimestampsFiber();
    } else {
      addSidebarTimestampsFiber();
    }

    // Also update chat timestamps in the same loop
    addChatTimestamps();
  }, 1500);
}

setTimeout(startRehydrationLoop, 2000);
// #endregion
