// Size each popup card from the size its iframe reports, then flag the slide
// as ready once every card has reported and the fonts have loaded.
(() => {
  const CHECK = '<svg viewBox="0 0 16 16"><path d="M3.5 8.4l2.9 2.9 6.1-6.6"/></svg>';
  document.querySelectorAll(".check").forEach((el) => (el.innerHTML = CHECK));

  const cards = [...document.querySelectorAll(".card[data-id]")];
  const pending = new Set(cards.map((c) => c.dataset.id));
  window.__sizes = {};
  window.addEventListener("message", async (event) => {
    const { id, w, h } = event.data || {};
    const card = cards.find((c) => c.dataset.id === id);
    if (!card || !pending.has(id)) return;
    const scale = Number(card.dataset.scale || 1);
    const frame = card.querySelector("iframe");
    const height = Number(card.dataset.height || h);
    frame.style.width = w + "px";
    frame.style.height = height + "px";
    frame.style.transform = `scale(${scale})`;
    card.style.width = w * scale + "px";
    card.style.height = height * scale + "px";
    window.__sizes[id] = { w, h, scale };
    pending.delete(id);
    if (!pending.size) {
      await document.fonts.ready;
      setTimeout(() => (window.__ready = true), 400);
    }
  });
  if (!cards.length) document.fonts.ready.then(() => setTimeout(() => (window.__ready = true), 400));
})();
