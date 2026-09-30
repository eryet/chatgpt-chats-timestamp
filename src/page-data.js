// Keep ChatGPT's changing DOM and React data shapes behind one adapter.
const MESSAGE_SELECTOR =
  '[data-message-id], [data-chatgpt-search-message-ids]';
const SIDEBAR_SELECTOR =
  'a[href^="/c/"], a[href*="/c/"][data-sidebar-item], ' +
  'a[href*="/c/"][data-interactive-row-link], ' +
  'a[href$="/project"][data-sidebar-item], [data-app-action-sidebar-project-row], a[href^="/gg/"]';

function parseTimestamp(value) {
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }
  if (!["string", "number"].includes(typeof value) || value === "") return null;
  const numeric = typeof value === "number" || /^\d+(\.\d+)?$/.test(value);
  const number = numeric ? Number(value) : null;
  const date = new Date(numeric ? (number < 1e12 ? number * 1000 : number) : value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function* reactProps(element) {
  const key = Object.getOwnPropertyNames(element).find((name) =>
    name.startsWith("__reactFiber$") || name.startsWith("__reactInternalInstance$"),
  );
  let fiber = key && element[key];
  for (let depth = 0; fiber && depth < 100; depth++, fiber = fiber.return) {
    if (fiber.memoizedProps) yield fiber.memoizedProps;
  }
}

// Search only bounded, plain data. Never invoke getters, stores or React callbacks.
function findData(root, predicate) {
  const queue = [[root, 0]];
  const seen = new Set();
  for (let i = 0; i < queue.length && i < 500; i++) {
    const [value, depth] = queue[i];
    if (!value || typeof value !== "object" || seen.has(value)) continue;
    seen.add(value);
    if (predicate(value)) return value;
    if (depth >= 6 || value.nodeType || value.$$typeof) continue;
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
      if (["children", "_owner", "return", "alternate", "stateNode"].includes(key)) continue;
      const child = descriptor.value;
      if (child && typeof child === "object") queue.push([child, depth + 1]);
    }
  }
  return null;
}

function getMessageElements() {
  const elements = Array.from(document.querySelectorAll(`main ${MESSAGE_SELECTOR.split(", ").join(", main ")}`));
  // Some layouts attach both selectors to nested wrappers for the same message.
  return elements.filter((element) => !element.parentElement?.closest(MESSAGE_SELECTOR));
}

function itemMessageIds(item) {
  return [item?.serverMessageId, item?.messageId, item?.latestMessageId,
    ...(Array.isArray(item?.sourceMessageIds) ? item.sourceMessageIds : [])].filter(Boolean);
}

function normalizeItem(item) {
  if (!item || !["user-message", "assistant-message"].includes(item.type)) return null;
  const user = item.type === "user-message";
  const parts = [user ? item.message : item.content].filter(part => typeof part === "string");
  if (user) {
    // The new renderer keeps attachments outside the message text.
    for (const attachment of item.chatGptImageAttachments || []) {
      parts.push({ content_type: "image_asset_pointer" });
    }
    for (const attachment of item.chatGptFileAttachments || []) {
      parts.push({ content_type: "file", name: attachment.name || "File" });
    }
  }
  const ids = itemMessageIds(item);
  const capturedTime = ids.map(id => window.chatgptTimestampResponseData?.getTime(id))
    .find(value => value != null);
  return {
    id: ids[0],
    author: { role: user ? "user" : "assistant" },
    content: { parts },
    create_time: capturedTime ?? (typeof item.sentAtMs === "number" ? item.sentAtMs / 1000 : null),
    metadata: { content_references: Array.isArray(item.contentReferences) ? item.contentReferences : [] },
  };
}

function getMessageRecord(element, index) {
  const ids = (element.getAttribute("data-message-id") ||
    element.getAttribute("data-chatgpt-search-message-ids") || "").split(/\s+/).filter(Boolean);
  let message = null;
  let legacyTurn = null;
  const modern = element.hasAttribute("data-chatgpt-search-message-ids");
  for (const props of reactProps(element)) {
    if (legacyTurn == null && Number.isInteger(props.turnIndex)) legacyTurn = props.turnIndex;
    if (modern && itemMessageIds(props.item).some(id => ids.includes(id))) {
      message = normalizeItem(props.item);
    }
    message ||= findData(props, (value) =>
      ids.includes(value.id) && value.content && value.author?.role,
    );
    if (message && (modern || legacyTurn != null)) break;
  }
  return { element, message, turnIndex: modern ? index + 1 : (legacyTurn ?? index + 1) };
}

function getMessageRecords() {
  const records = getMessageElements().map(getMessageRecord);
  const entries = getConversationEntries(records[0]?.element);
  if (!entries) return records;
  const indices = new Map();
  let index = 0;
  for (const entry of entries) {
    for (const item of entry.turn.items) {
      if (!["user-message", "assistant-message"].includes(item.type)) continue;
      index++;
      for (const id of itemMessageIds(item)) indices.set(id, index);
    }
  }
  for (const record of records) {
    const ids = (record.element.getAttribute("data-chatgpt-search-message-ids") || "").split(/\s+/);
    const index = ids.map(id => indices.get(id)).find(index => index != null);
    if (index != null) record.turnIndex = index;
  }
  return records;
}

function getConversationEntries(element) {
  if (!element?.hasAttribute("data-chatgpt-search-message-ids")) return null;
  for (const props of reactProps(element)) {
    if (Array.isArray(props.entries) && props.entries.length &&
        props.entries.every(entry => Array.isArray(entry?.turn?.items))) return props.entries;
  }
  return null;
}

function getExportRecords() {
  const elements = getMessageElements();
  const entries = getConversationEntries(elements[0]);
  if (!entries) return elements.map(getMessageRecord);
  // The new timeline virtualizes turns. Export its loaded entries, including turns
  // currently outside the DOM, rather than silently exporting only the viewport.
  const records = [];
  for (const entry of entries) {
    for (const item of entry.turn.items) {
      const message = normalizeItem(item);
      if (message) records.push({ message, turnIndex: records.length + 1 });
    }
  }
  return records;
}

function getSidebarMetadata(element) {
  const href = element.getAttribute("href") || "";
  const id = element.getAttribute("data-app-action-sidebar-project-id") ||
    href.match(/\/c\/([^/?#]+)/)?.[1] || href.match(/\/g\/(g-p-[a-f0-9]+)/)?.[1];
  for (const props of reactProps(element)) {
    const data = [props.conversation, props.historyItem, props.project?.gizmo, props.gizmo?.gizmo]
      .find((value) => value && id && value.id === id);
    if (data) return {
      id: data.id,
      title: data.title ?? data.display?.name,
      create_time: data.create_time ?? data.created_at,
      update_time: data.update_time ?? data.updated_at,
    };
  }
  return null;
}

function isDarkTheme() {
  const root = document.documentElement;
  if (root.classList.contains("dark") || root.getAttribute("data-theme") === "dark") return true;
  if (root.classList.contains("light") || root.getAttribute("data-theme") === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}
