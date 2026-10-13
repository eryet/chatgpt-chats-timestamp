// Paint over the English text in the original sidebar screenshot and draw the
// zh-TW text centered on the same lines. Each line: [y0, y1, coverX0, coverX1,
// bg, textX, color, kind, text], with y0/y1 the measured ink rows.
function drawSidebar(cfg) {
  document.body.style.background = `url(../.build/assets/${cfg.image}) 0 0 / 1280px 800px no-repeat`;
  for (const [y0, y1, cx0, cx1, bg, x, color, kind, text] of cfg.lines) {
    const pad = kind === "stamp" ? 5 : 7;
    const cover = document.createElement("div");
    Object.assign(cover.style, {
      position: "absolute", left: cx0 + "px", width: cx1 - cx0 + "px",
      top: y0 - pad + "px", height: y1 - y0 + 1 + pad * 2 + "px", background: bg,
    });
    document.body.append(cover);
    const label = document.createElement("div");
    label.textContent = text;
    Object.assign(label.style, {
      position: "absolute", left: x + "px", top: y0 - 20 + "px", height: y1 - y0 + 41 + "px",
      display: "flex", alignItems: "center", whiteSpace: "nowrap", color, lineHeight: "1",
      fontFamily: kind === "stamp" ? cfg.stampFont : cfg.textFont,
      fontSize: (kind === "stamp" ? cfg.stampSize : cfg.textSize) + "px",
      fontWeight: kind === "stamp" ? cfg.stampWeight : 400,
      transform: `translateY(${kind === "stamp" ? cfg.stampNudge : cfg.textNudge}px)`,
    });
    document.body.append(label);
  }
  document.fonts.ready.then(() => setTimeout(() => (window.__ready = true), 300));
}
