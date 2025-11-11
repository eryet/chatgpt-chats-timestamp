function addSidebarTimestampsFiber() {
  const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const links = document.querySelectorAll('a[href^="/c/"]');

  links.forEach((el) => {
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

    const container = document.createElement("div");
    container.className = "timestamp-stack-container";
    container.style.cssText = `
      position: absolute;
      bottom: 4px;
      left: 10px;
      font-size: 10px;
      color: ${isDark ? "#e3e3e3" : "#555"};
      font-family: ui-monospace,'SF Mono',Monaco,monospace;
      opacity: 0.75;
      pointer-events: none;
    `;
    container.textContent = formatted;

    el.style.position = "relative";
    el.style.paddingBottom = "15px";
    el.appendChild(container);

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
