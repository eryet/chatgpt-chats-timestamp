// Global settings cache
let userSettings = {
  dateFormat: "locale",
  displayMode: "created",
  hoverEnabled: true,
  chatTimestampEnabled: true,
};

// Listen for settings updates from bridge script (runs in isolated world)
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.data?.type === "TIMESTAMP_SETTINGS_UPDATE") {
    userSettings = { ...userSettings, ...event.data.settings };

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
});

// formatDate and getRelativeTime are loaded from utils.js

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

function addSidebarTimestampsFiber() {
  const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const links = document.querySelectorAll('a[href^="/c/"]');

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
      container.style.cssText = `
        position: absolute;
        bottom: 4px;
        left: 10px;
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
      ":scope > .timestamp-secondary"
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

function addChatTimestamps() {
  const { chatTimestampEnabled, dateFormat } = userSettings;
  const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const timestampColor = isDark ? "#ccc" : "#555";

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
      k.startsWith("__reactFiber$")
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
      margin-right: 8px;
      margin-bottom: 4px;
      display: inline-flex;
      align-items: baseline;
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

function startRehydrationLoop() {
  let lastCount = 0;
  setInterval(() => {
    const chatLinks = document.querySelectorAll('a[href^="/c/"]');
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

// Initialize
setTimeout(startRehydrationLoop, 2000);
