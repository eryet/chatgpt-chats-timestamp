// Render each slide with headless Chrome over the DevTools protocol.
// Run through generate.py, which prepares .build/ first.
// Usage: node render.mjs [slide-prefix ...]
import { spawn } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9333;
const slidesDir = join(here, "slides");
const rawDir = join(here, ".build", "raw");
mkdirSync(rawDir, { recursive: true });
const wanted = process.argv.slice(2);
const slides = readdirSync(slidesDir).filter((f) => /^\d-.*\.html$/.test(f))
  .filter((f) => !wanted.length || wanted.some((w) => f.startsWith(w)));

const profile = join(here, ".build", "chrome-profile");
try { rmSync(profile, { recursive: true, force: true }); } catch {}
const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  "--lang=zh-TW", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
  "--disable-extensions", "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 50 && !targets; i++) {
  await sleep(200);
  try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); } catch {}
}
const page = targets.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let nextId = 1;
const waiting = new Map();
const errors = [];
ws.addEventListener("message", ({ data }) => {
  const msg = JSON.parse(data);
  if (msg.id && waiting.has(msg.id)) {
    const { resolve, reject } = waiting.get(msg.id);
    waiting.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  } else if (msg.method === "Runtime.exceptionThrown") {
    const details = msg.params.exceptionDetails;
    errors.push(details.exception?.description || details.text);
  }
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++;
  waiting.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) =>
  (await send("Runtime.evaluate", { expression, returnByValue: true })).result.value;

let failed = false;
try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 2, mobile: false });
  await send("Emulation.setTimezoneOverride", { timezoneId: "Asia/Taipei" });
  await send("Emulation.setLocaleOverride", { locale: "zh-TW" });

  for (const file of slides) {
    await send("Page.navigate", { url: pathToFileURL(join(slidesDir, file)).href });
    // Slides set window.__ready once fonts have loaded and every popup reported its size.
    let ready = false;
    for (let i = 0; i < 150 && !ready; i++) {
      await sleep(200);
      ready = await evaluate("window.__ready === true").catch(() => false);
    }
    const shot = await send("Page.captureScreenshot", { format: "png" });
    writeFileSync(join(rawDir, file.replace(/\.html$/, ".png")), Buffer.from(shot.data, "base64"));
    console.log(`${file}: ${ready ? "ok" : "TIMED OUT"}${errors.length ? " errors: " + errors.join("; ") : ""}`);
    failed ||= !ready || errors.length > 0;
    errors.length = 0;
  }
} finally {
  ws.close();
  // Kill the whole tree; chrome.kill() alone leaves the child processes running.
  spawn("taskkill", ["/PID", String(chrome.pid), "/T", "/F"], { stdio: "ignore" });
}
process.exitCode = failed ? 1 : 0;
