// Minimal chrome.* stub so the real popup renders outside the extension.
(() => {
  // Pin "now" so the previews match the other slides and renders repeat exactly.
  const NOW = new Date("2026-10-01T10:15:25+08:00").getTime();
  const RealDate = Date;
  window.Date = class extends RealDate {
    constructor(...args) { super(...(args.length ? args : [NOW])); }
    static now() { return NOW; }
  };

  const MESSAGES = __MESSAGES__;
  const UI_LANG = "zh-TW";

  function getMessage(key, subs) {
    const entry = MESSAGES[key];
    if (!entry) return "";
    let text = entry.message;
    const list = subs == null ? [] : Array.isArray(subs) ? subs : [subs];
    for (const [name, ph] of Object.entries(entry.placeholders || {})) {
      text = text.split("$" + name + "$").join(ph.content);
      text = text.split("$" + name.toUpperCase() + "$").join(ph.content);
    }
    return text.replace(/\$(\d)/g, (_, n) => list[n - 1] ?? "");
  }

  const at = (s) => new Date(s).toISOString();
  const folders = {
    fld_work: { id: "fld_work", name: "工作", parentId: null, order: 0, createdAt: at("2026-08-01T09:00:00+08:00") },
    fld_q4: { id: "fld_q4", name: "Q4 規劃", parentId: "fld_work", order: 0, createdAt: at("2026-08-02T09:00:00+08:00") },
    fld_travel: { id: "fld_travel", name: "旅遊", parentId: null, order: 1, createdAt: at("2026-08-03T09:00:00+08:00") },
    fld_learn: { id: "fld_learn", name: "學習", parentId: null, order: 2, createdAt: at("2026-08-04T09:00:00+08:00") },
  };
  const bookmarks = [
    ["c-osaka", "東京 → 大阪 JR Pass 划算嗎", "fld_travel", "2026-09-16T18:15:00+08:00", "日本五天行程買 JR Pass 不划算"],
    ["c-maple", "京都楓葉季住宿推薦", "fld_travel", "2026-09-12T21:40:00+08:00", ""],
    ["c-q3", "Q3 營運報告摘要", "fld_work", "2026-09-25T10:05:00+08:00", ""],
    ["c-deck", "新品發表會簡報大綱", "fld_work", "2026-09-22T15:30:00+08:00", ""],
    ["c-okr", "Q4 OKR 草稿", "fld_q4", "2026-09-29T11:20:00+08:00", ""],
    ["c-rr7", "React Router v7 入門", "fld_learn", "2026-09-18T20:10:00+08:00", ""],
    ["c-n3", "日文 N3 文法整理", "fld_learn", "2026-09-08T22:00:00+08:00", ""],
    ["c-recipe", "週末料理食譜", null, "2026-09-27T12:45:00+08:00", ""],
    ["c-scraper", "Python 爬蟲除錯", null, "2026-09-20T16:25:00+08:00", ""],
  ];

  const store = {
    dateFormat: "locale",
    displayMode: "created",
    hoverMode: "swap",
    chatTimestampEnabled: true,
    chatTimestampPosition: "center",
    sidebarFilterMode: "all",
    boldSidebarTimestamp: false,
    boldChatTimestamp: true,
    bookmarkSchemaVersion: 2,
    bookmarkFolders: folders,
  };
  for (const [id, title, folderId, when, note] of bookmarks) {
    store["bm_" + id] = {
      id, kind: "chat", starredAt: at(when), titleSnapshot: title,
      folderId, note, updatedAt: at(when),
    };
  }

  const listeners = [];
  const later = (fn, ...args) => fn && setTimeout(() => fn(...args), 0);
  const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

  const sync = {
    get(keys, cb) {
      let out = {};
      if (keys == null) out = clone(store);
      else if (typeof keys === "string") { if (keys in store) out[keys] = clone(store[keys]); }
      else if (Array.isArray(keys)) { for (const k of keys) if (k in store) out[k] = clone(store[k]); }
      else for (const [k, d] of Object.entries(keys)) out[k] = k in store ? clone(store[k]) : d;
      later(cb, out);
    },
    set(patch, cb) {
      const changes = {};
      for (const [k, v] of Object.entries(patch)) {
        changes[k] = { oldValue: clone(store[k]), newValue: clone(v) };
        store[k] = clone(v);
      }
      later(cb);
      for (const l of listeners) later(l, changes, "sync");
    },
    remove(keys, cb) {
      for (const k of [].concat(keys)) delete store[k];
      later(cb);
    },
  };

  const tab = { id: 1, url: "https://chatgpt.com/c/6a1b2c3d-kyoto", title: "京都五日行程 - ChatGPT" };

  window.chrome = {
    i18n: { getMessage, getUILanguage: () => UI_LANG },
    storage: { sync, onChanged: { addListener: (fn) => listeners.push(fn) } },
    tabs: {
      query: (q, cb) => later(cb, [tab]),
      sendMessage: (id, msg, cb) => {
        if (msg?.type === "GET_CHAT_CONTEXT") later(cb, { href: tab.url, title: tab.title, conversationId: "6a1b2c3d-kyoto" });
        else later(cb, undefined);
      },
      create: () => {},
    },
    runtime: { lastError: undefined, id: "store-shot", getManifest: () => ({ version: "2.3" }) },
  };
})();
