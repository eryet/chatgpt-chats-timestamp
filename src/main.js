// Global settings cache
let userSettings = {
  dateFormat: "locale",
  displayMode: "created",
  hoverEnabled: true,
};

// Listen for settings updates from bridge script (runs in isolated world)
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.data?.type === "TIMESTAMP_SETTINGS_UPDATE") {
    userSettings = { ...userSettings, ...event.data.settings };
    addSidebarTimestampsFiber(); // Refresh with new settings
  }
});

function getRelativeTime(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  if (diffWeek < 4) return `${diffWeek}w ago`;
  if (diffMonth < 12) return `${diffMonth}mo ago`;
  return `${diffYear}y ago`;
}

function formatTimestamp(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";

  switch (userSettings.dateFormat) {
    case "iso":
      return d.toISOString().slice(0, 19).replace("T", " ");

    case "us":
      return d.toLocaleString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });

    case "eu":
      return d.toLocaleString("en-GB", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });

    case "uk":
      return d.toLocaleString("en-GB", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });

    case "relative":
      return getRelativeTime(d);

    case "short":
      return d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });

    case "dateOnly":
      return d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

    case "timeOnly":
      return d.toLocaleString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });

    case "locale":
    default:
      return d.toLocaleString().replace(",", "");
  }
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
  }, 1500);
}

// Initialize
setTimeout(startRehydrationLoop, 2000);
