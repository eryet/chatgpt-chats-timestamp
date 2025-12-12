function formatTimestamp(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString().replace(",", "");
}

function setHoverExpanded(el, expanded) {
  const container = el.querySelector(":scope > .timestamp-stack-container");
  if (!container) return;

  const updatedEl = container.querySelector(":scope > .timestamp-updated");
  if (!updatedEl) return;

  const hasUpdated = !!updatedEl.textContent;
  const shouldExpand = expanded && hasUpdated;
  updatedEl.style.display = shouldExpand ? "block" : "none";
  el.style.paddingBottom = shouldExpand ? "28px" : "15px";
}

function addSidebarTimestampsFiber() {
  const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const links = document.querySelectorAll('a[href^="/c/"]');

  const createdColor = isDark ? "#e3e3e3" : "#4B5563";
  const updatedColor = isDark ? "#81c995" : "#15803D";

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

      const updatedLine = document.createElement("div");
      updatedLine.className = "timestamp-updated";
      updatedLine.style.display = "none";
      updatedLine.style.color = updatedColor;

      const createdLine = document.createElement("div");
      createdLine.className = "timestamp-created";
      createdLine.style.color = createdColor;

      container.appendChild(updatedLine);
      container.appendChild(createdLine);

      el.style.position = "relative";
      el.appendChild(container);
    }

    const createdLine = container.querySelector(":scope > .timestamp-created");
    const updatedLine = container.querySelector(":scope > .timestamp-updated");
    if (!createdLine || !updatedLine) return;

    createdLine.style.color = createdColor;
    updatedLine.style.color = updatedColor;

    createdLine.textContent = createdText;
    updatedLine.textContent = updatedText ? `${updatedText}` : "";

    // Bind hover/focus handlers once per element.
    if (!el.dataset.timestampHoverBound) {
      const expand = () => setHoverExpanded(el, true);
      const collapse = () => setHoverExpanded(el, false);
      el.addEventListener("mouseenter", expand);
      el.addEventListener("mouseleave", collapse);
      el.addEventListener("focusin", expand);
      el.addEventListener("focusout", collapse);
      el.dataset.timestampHoverBound = "true";
    }

    // Keep the right state if the loop runs while hovered.
    const isHovered = el.matches(":hover");
    const isFocused = el.contains(document.activeElement);
    setHoverExpanded(el, isHovered || isFocused);

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

setTimeout(startRehydrationLoop, 2000);
