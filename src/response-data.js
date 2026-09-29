// Runs at document_start. Keep only message IDs and creation dates from responses
// the page already requests; never fetch conversations or retain their contents.
(() => {
  if (window.chatgptTimestampResponseData) return;
  const times = new Map();
  window.chatgptTimestampResponseData = {
    getTime: (id) => times.get(id) ?? null,
  };

  function collect(data) {
    const queue = [data];
    for (let i = 0; i < queue.length; i++) {
      const value = queue[i];
      if (!value || typeof value !== "object") continue;
      if (typeof value.id === "string" && value.author?.role &&
          ["number", "string"].includes(typeof value.create_time)) {
        times.delete(value.id);
        times.set(value.id, value.create_time);
        if (times.size > 10000) times.delete(times.keys().next().value);
      }
      // JSON payloads are acyclic. Inspect objects, not potentially large text parts.
      for (const child of Object.values(value)) {
        if (child && typeof child === "object") queue.push(child);
      }
    }
  }

  async function readEvents(response) {
    const reader = response.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer = (buffer + decoder.decode(value, { stream: true })).replace(/\r\n/g, "\n");
        let end;
        while ((end = buffer.indexOf("\n\n")) !== -1) {
          const event = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          const data = event.split("\n").filter(line => line.startsWith("data:"))
            .map(line => line.slice(5).trimStart()).join("\n");
          try { collect(JSON.parse(data)); } catch { /* Keep-alives and [DONE]. */ }
        }
        // Do not keep an unbounded event containing generated media or content.
        if (buffer.length > 2 * 1024 * 1024) {
          void reader.cancel().catch(() => {});
          break;
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  const originalFetch = window.fetch;
  if (typeof originalFetch !== "function") return;
  window.fetch = function (...args) {
    const result = Reflect.apply(originalFetch, this, args);
    // Return the original promise and response; observation must not affect the app.
    result.then(async response => {
      const requestUrl = typeof args[0] === "string" ? args[0] : args[0]?.url;
      const url = new URL(response.url || requestUrl, window.location.href);
      if (url.origin !== window.location.origin || !url.pathname.startsWith("/backend-api/")) return;
      if (!response.ok) return;
      const type = response.headers.get("content-type") || "";
      if (type.includes("application/json")) collect(await response.clone().json());
      else if (type.includes("text/event-stream")) await readEvents(response.clone());
    }).catch(() => { /* Failed/aborted/unsupported responses must not affect ChatGPT. */ });
    return result;
  };
})();
