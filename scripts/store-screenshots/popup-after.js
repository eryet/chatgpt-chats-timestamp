// Puts the popup in the state a slide asks for (#id=…&tab=…&theme=…&bm=…)
// and reports its size to the slide.
(() => {
  const p = new URLSearchParams(location.hash.slice(1));
  const theme = p.get("theme") || "light";
  for (const sheet of document.styleSheets) {
    for (const rule of sheet.cssRules) {
      if (rule instanceof CSSMediaRule && /prefers-color-scheme:\s*dark/.test(rule.conditionText)) {
        rule.media.mediaText = theme === "dark" ? "all" : "not all";
      }
    }
  }
  document.documentElement.style.colorScheme = theme;

  setTimeout(() => {
    const tab = p.get("tab");
    if (tab) setActiveTab(tab + "Panel");
    const bm = p.get("bm");
    if (bm) {
      const key = Object.keys(bmBookmarks).find((k) => (bmBookmarks[k].titleSnapshot || "").startsWith(bm));
      navTo("detail", { bookmarkId: key, returnFolderId: "__all__" });
    }
    document.activeElement?.blur();
    // Repeat: the slide's listener may not exist yet on a cold load.
    let sent = 0;
    const report = () => {
      const w = Math.ceil(document.body.getBoundingClientRect().width);
      parent.postMessage({ id: p.get("id"), w, h: document.documentElement.scrollHeight }, "*");
      if (++sent < 20) setTimeout(report, 500);
    };
    setTimeout(report, 300);
  }, 500);
})();
