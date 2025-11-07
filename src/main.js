function addSidebarTimestampsFiber() {
  const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  document.querySelectorAll('a[href^="/c/"]').forEach((el) => {
    if (el.dataset.timestampAdded) return;

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

    const formatted = new Date(conversation.create_time)
      .toLocaleString()
      .replace(",", "");

    /**
     * dont move or wrap React-owned nodes
     * @summary docs/note.md
     */
    const titleEl = el.querySelector(".truncate");
    if (!titleEl) return;

    const container = document.createElement("div");
    container.className = "timestamp-stack-container";
    container.style.cssText = `
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      line-height: 1.2;
      width: 100%;
      pointer-events: none;
    `;

    const timestampEl = document.createElement("div");
    timestampEl.textContent = formatted;
    timestampEl.title = new Date(conversation.update_time).toLocaleString();
    timestampEl.style.cssText = `
      font-size: 10px;
      color: ${isDark ? "#e3e3e3" : "#555"};
      margin-top: 2px;
      font-family: ui-monospace,'SF Mono',Monaco,monospace;
      opacity: 0.75;
    `;

    el.appendChild(container);
    container.appendChild(timestampEl);

    el.style.paddingBottom = "15px";
    container.style.position = "absolute";
    container.style.bottom = "4px";
    container.style.left = "10px";

    el.dataset.timestampAdded = "true";
  });
}

function observeSidebar() {
  const ready = document.querySelector('a[href^="/c/"]');
  if (!ready) return setTimeout(observeSidebar, 800);

  addSidebarTimestampsFiber();

  const root = document.querySelector("#history") || document.body;
  let t;
  const debounced = () => {
    clearTimeout(t);
    t = setTimeout(addSidebarTimestampsFiber, 300);
  };
  new MutationObserver(debounced).observe(root, { childList: true, subtree: true });
}

setTimeout(observeSidebar, 2000);

