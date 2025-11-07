function addSidebarTimestampsFiber() {
  const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  let added = 0;

  document.querySelectorAll('a[href^="/c/"]').forEach((el) => {
    if (el.dataset.timestampAdded) return;

    const fiberKey = Object.keys(el).find((k) => k.startsWith("__reactFiber$"));
    if (!fiberKey) return;

    let fiber = el[fiberKey];
    let depth = 0;
    let conversation = null;

    while (fiber && depth < 25) {
      const props = fiber.memoizedProps;
      if (props?.conversation && props.conversation?.create_time) {
        conversation = props.conversation;
        break;
      }
      fiber = fiber.return;
      depth++;
    }

    if (!conversation?.create_time) return;

    const formatted = new Date(conversation.create_time).toLocaleString();

    // --- create a container for stacked layout ---
    const wrapper = document.createElement("div");
    wrapper.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      line-height: 1.2;
    `;

    // move existing title inside wrapper
    const titleEl = el.querySelector(".truncate");
    if (!titleEl) return;

    // clone to avoid breaking fiber references (React can re-render otherwise)
    const clonedTitle = titleEl.cloneNode(true);

    // create timestamp element
    const timestampEl = document.createElement("div");
    timestampEl.textContent = formatted.replace(',', '');
    timestampEl.title = new Date(conversation.update_time).toLocaleString();
    timestampEl.style.cssText = `
      font-size: 10px;
      color: ${isDark ? "#e3e3e3" : "#555"};
      margin-top: 2px;
      font-family: ui-monospace,'SF Mono',Monaco,monospace;
      opacity: 0.75;
    `;

    // append both elements to wrapper
    wrapper.appendChild(clonedTitle);
    wrapper.appendChild(timestampEl);

    // replace original title container with our stacked wrapper
    titleEl.replaceWith(wrapper);

    el.dataset.timestampAdded = "true";
    added++;
  });
}

function waitForSidebarAndApplyFiber() {
  const ready = document.querySelector('a[href^="/c/"]');
  if (ready) {
    addSidebarTimestampsFiber();

    const historyRoot = document.querySelector("#history") || document.body;
    const observer = new MutationObserver(() => addSidebarTimestampsFiber());
    observer.observe(historyRoot, { childList: true, subtree: true });
  } else {
    setTimeout(waitForSidebarAndApplyFiber, 800);
  }
}

// Wait 2s for initial hydration, then check every 4s for re-mounts
setTimeout(() => {
  waitForSidebarAndApplyFiber();
  setInterval(waitForSidebarAndApplyFiber, 4000);
}, 2000);

