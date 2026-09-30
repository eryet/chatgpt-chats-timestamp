const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { runInContext } = require("node:vm");
const { JSDOM } = require("jsdom");

function setup(html, fetch) {
  const dom = new JSDOM(html, { url: "https://chatgpt.com/c/chat-1", runScripts: "outside-only" });
  const { window } = dom;
  window.matchMedia = () => ({ matches: false });
  window.setTimeout = () => 0;
  window.setInterval = () => 0;
  window.fetch = fetch;
  window.TextDecoder = TextDecoder;
  for (const file of ["response-data.js", "utils.js", "page-data.js", "main.js"]) {
    runInContext(readFileSync(`src/${file}`, "utf8"), dom.getInternalVMContext());
  }
  return window;
}

function attach(element, ...props) {
  element.__reactFiber$test = props.reverse().reduce((parent, memoizedProps) =>
    ({ memoizedProps, return: parent }), null);
}

function message(id, role, content, create_time = 1790683200) {
  return { id, author: { role }, content: { parts: [content] }, create_time };
}

function modernPage() {
  const window = setup(`<title>Fixture chat</title>
    <div class="sidebar-item"><div><a data-interactive-row-link href="/c/chat-1" aria-label="Fixture chat"><span data-thread-title>Fixture chat</span></a></div></div>
    <div class="sidebar-item" data-app-action-sidebar-project-row data-app-action-sidebar-project-id="g-p-abc"></div>
    <main><div data-turn-key="user-1">
      <div data-chatgpt-search-message-ids="user-1" data-chatgpt-search-unit-key="fallback-turn-0:0:user"></div>
      <div data-chatgpt-search-message-ids="assistant-1 assistant-1" data-chatgpt-search-unit-key="fallback-turn-0:2:assistant"></div>
    </div></main>`);
  const elements = window.document.querySelectorAll("[data-chatgpt-search-message-ids]");
  // Shape confirmed by consolelog.txt: raw message objects are no longer passed
  // to these components, and both sentAtMs fields can be null for saved chats.
  const user = { type: "user-message", message: "Hello", messageId: "user-1",
    serverMessageId: "user-1", sentAtMs: null, chatGptImageAttachments: [], chatGptFileAttachments: [] };
  const assistant = { type: "assistant-message", content: "**Answer**", messageId: "assistant-1",
    latestMessageId: "assistant-1", sourceMessageIds: ["assistant-1"], sentAtMs: null, contentReferences: [] };
  const items = [user, { type: "chatgpt-reasoning-group", items: [], reasoningRecap: { content: "hidden" } }, assistant];
  attach(elements[0], {}, { item: user, items, index: 0 });
  attach(elements[1], {}, { item: assistant, items, index: 2 });
  window.chatgptTimestampResponseData = { getTime: id => ({ "user-1": 1790683200, "assistant-1": 1790683205 })[id] ?? null };
  // Live September layout: conversation data is 27 ancestors above the link.
  attach(window.document.querySelector("a"), ...Array.from({ length: 27 }, () => ({})), { conversation: {
    id: "chat-1", title: "Fixture chat", create_time: 1790683200, update_time: "2026-09-30T00:00:00Z",
  } });
  attach(window.document.querySelector("[data-app-action-sidebar-project-row]"),
    ...Array.from({ length: 23 }, () => ({})), { project: { gizmo: {
    id: "g-p-abc", created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-02T00:00:00Z",
  } } });
  return window;
}

test("updated layout renders each message with its own timestamp and no duplicates", () => {
  const window = modernPage();
  window.eval('userSettings.dateFormat = "iso"');
  window.addChatTimestamps();
  window.addChatTimestamps();
  const timestamps = window.document.querySelectorAll(".chatgpt-timestamp");
  assert.equal(timestamps.length, 2);
  assert.match(timestamps[0].textContent, /^#1/);
  assert.match(timestamps[1].textContent, /^#2/);
  assert.notEqual(timestamps[0].lastChild.textContent, timestamps[1].lastChild.textContent);
  window.close();
});

test("sidebar chat and project dates render on the row and honor settings", () => {
  const window = modernPage();
  window.eval('userSettings.dateFormat = "iso"; userSettings.hoverMode = "classic"');
  window.addSidebarTimestampsFiber();
  const row = window.document.querySelector(".sidebar-item");
  assert.ok(row.querySelector(":scope > .timestamp-stack-container"));
  assert.equal(window.document.querySelectorAll(".timestamp-stack-container").length, 2);
  assert.equal(row.style.height, "auto");
  window.setHoverExpanded(row, true);
  assert.equal(row.querySelector(".timestamp-secondary").style.display, "block");
  window.eval('userSettings.displayMode = "updated"; userSettings.hoverMode = "disabled"');
  window.addSidebarTimestampsFiber();
  assert.equal(row.querySelector(".timestamp-primary").textContent, "2026-09-30 00:00:00");
  assert.equal(row.querySelector(".timestamp-secondary").style.display, "none");
  window.close();
});

test("bookmark context works without timestamps or message React data", () => {
  const window = modernPage();
  window.eval("userSettings.chatTimestampEnabled = false");
  const elements = window.document.querySelectorAll("[data-chatgpt-search-message-ids]");
  delete elements[1].__reactFiber$test;
  const context = window.getChatContext();
  assert.equal(context.conversationId, "chat-1");
  assert.equal(context.title, "Fixture chat");
  assert.equal(context.isDraft, false);
  // This feature was intentionally removed upstream in v2.1.
  assert.equal(typeof window.scrollToTurn, "undefined");
  window.close();
});

test("all export formats preserve ordered content and normalize dates", () => {
  const window = modernPage();
  for (const format of ["markdown", "plain", "json"]) {
    const result = window.exportCurrentChat(format);
    assert.equal(result.success, true, result.message);
    assert.equal(result.messageCount, 2);
    assert.ok(result.content.includes("Hello"));
    assert.ok(result.content.includes("**Answer**"));
    assert.ok(!result.content.includes("hidden"));
  }
  const data = JSON.parse(window.exportCurrentChat("json").content);
  assert.equal(data.title, "Fixture chat");
  assert.equal(data.created, new Date(1790683200000).toISOString());
  assert.equal(data.messages[1].timestamp, new Date(1790683205000).toISOString());
  assert.deepEqual(data.messages.map(m => m.turn), [1, 2]);
  window.close();
});

test("legacy message and project layouts remain supported", () => {
  const window = setup('<a href="/g/g-p-abc-name/project" data-sidebar-item="true"></a><main><article data-testid="conversation-turn-8"><div data-message-id="old"></div></article></main>');
  const element = window.document.querySelector("[data-message-id]");
  attach(element, { message: message("old", "user", "Legacy") }, { turnIndex: 8 });
  attach(window.document.querySelector("a"), { gizmo: { gizmo: { id: "g-p-abc", created_at: "2025-01-01T00:00:00Z" } } });
  window.addChatTimestamps();
  window.addSidebarTimestampsFiber();
  assert.equal(element.querySelector(".chatgpt-turn-index").textContent, "#8");
  assert.equal(window.document.querySelectorAll(".timestamp-stack-container").length, 1);
  assert.equal(window.exportCurrentChat().success, true);
  window.close();
});

test("reused message elements refresh dates and settings remove timestamps", () => {
  const window = modernPage();
  window.addChatTimestamps();
  const element = window.document.querySelector("[data-chatgpt-search-message-ids]");
  const before = element.querySelector(".chatgpt-turn-time").textContent;
  attach(element, { message: message("user-1", "user", "Edited", "2026-10-01T00:00:00Z") });
  window.addChatTimestamps();
  assert.notEqual(element.querySelector(".chatgpt-turn-time").textContent, before);
  window.eval('userSettings.chatTimestampPosition = "right"');
  window.addChatTimestamps();
  assert.equal(element.firstChild.style.justifyContent, "flex-end");
  window.eval("userSettings.chatTimestampEnabled = false");
  window.addChatTimestamps();
  assert.equal(window.document.querySelectorAll(".chatgpt-timestamp").length, 0);
  window.close();
});

test("invalid dates do not break ISO export and theme follows ChatGPT", () => {
  const window = modernPage();
  const element = window.document.querySelector("[data-chatgpt-search-message-ids]");
  attach(element, { message: message("user-1", "user", "Hello", "invalid") });
  window.document.documentElement.className = "dark";
  assert.equal(window.isDarkTheme(), true);
  window.document.documentElement.className = "chatgpt-theme";
  window.document.documentElement.setAttribute("data-theme", "dark");
  assert.equal(window.isDarkTheme(), true);
  window.eval('userSettings.dateFormat = "iso"');
  window.addChatTimestamps();
  assert.equal(window.document.querySelectorAll(".chatgpt-timestamp").length, 1);
  assert.equal(window.exportCurrentChat("json").success, true);
  for (const value of [1790683200, 1790683200000, "1790683200", "2026-09-29T12:00:00Z"]) {
    assert.equal(window.parseTimestamp(value).toISOString(), "2026-09-29T12:00:00.000Z");
  }
  for (const value of [null, undefined, false, {}, [], "invalid", NaN, Infinity]) {
    assert.equal(window.parseTimestamp(value), null);
  }
  window.close();
});

test("new message items export attachments and use sentAtMs only when available", () => {
  const window = modernPage();
  window.chatgptTimestampResponseData = { getTime: () => null };
  const element = window.document.querySelector("[data-chatgpt-search-message-ids]");
  attach(element, { item: { type: "user-message", messageId: "user-1", message: "Photo and file",
    sentAtMs: 1790683200000, chatGptImageAttachments: [{ fileId: "image" }],
    chatGptFileAttachments: [{ name: "notes.txt" }] } });
  window.addChatTimestamps();
  assert.equal(window.document.querySelectorAll(".chatgpt-timestamp").length, 1);
  const data = JSON.parse(window.exportCurrentChat("json").content);
  assert.match(data.messages[0].content, /\[Image\]/);
  assert.match(data.messages[0].content, /\[File: notes.txt\]/);
  assert.equal(data.messages[0].timestamp, "2026-09-29T12:00:00.000Z");
  assert.equal(data.messages[1].timestamp, null);
  window.close();
});

test("virtualized timeline exports unmounted messages and keeps visible numbering stable", () => {
  const window = modernPage();
  const visible = window.document.querySelectorAll("[data-chatgpt-search-message-ids]");
  const entries = [
    { turn: { items: [
      { type: "user-message", messageId: "older-user", message: "Earlier question", sentAtMs: null },
      { type: "chatgpt-reasoning-group", items: [] },
      { type: "assistant-message", messageId: "older-answer", content: "Earlier answer", sentAtMs: null },
    ] } },
    { turn: { items: [visible[0].__reactFiber$test.return.memoizedProps.item,
      visible[1].__reactFiber$test.return.memoizedProps.item] } },
  ];
  for (const element of visible) {
    element.__reactFiber$test.return.return = { memoizedProps: { entries }, return: null };
  }
  window.addChatTimestamps();
  assert.equal(visible[0].querySelector(".chatgpt-turn-index").textContent, "#3");
  assert.equal(visible[1].querySelector(".chatgpt-turn-index").textContent, "#4");
  const data = JSON.parse(window.exportCurrentChat("json").content);
  assert.equal(data.messageCount, 4);
  assert.deepEqual(data.messages.map(message => message.content),
    ["Earlier question", "Earlier answer", "Hello", "**Answer**"]);
  window.close();
});

const tick = () => new Promise(resolve => setImmediate(resolve));
async function waitForTime(window, id) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (window.chatgptTimestampResponseData.getTime(id) != null) return;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
}

test("response observer captures server dates without consuming or replacing the response", async () => {
  const payload = { mapping: { node: { message: message("server-id", "user", "Private text") } } };
  const response = new Response(JSON.stringify(payload), { headers: { "Content-Type": "application/json" } });
  const originalPromise = Promise.resolve(response);
  let callCount = 0;
  const window = setup("<main></main>", () => { callCount++; return originalPromise; });
  const result = window.fetch("/backend-api/conversation/chat-1");
  assert.equal(result, originalPromise);
  assert.equal(await result, response);
  assert.deepEqual(await response.json(), payload);
  await waitForTime(window, "server-id");
  assert.equal(callCount, 1);
  assert.equal(window.chatgptTimestampResponseData.getTime("server-id"), 1790683200);
  assert.deepEqual(Object.keys(window.chatgptTimestampResponseData), ["getTime"]);
  window.close();
});

test("response observer handles streamed messages and split CRLF boundaries", async () => {
  const payload = JSON.stringify({ v: { message: message("stream-id", "assistant", "Answer", 1790683205) } });
  const chunks = [`event: delta\r\ndata: ${payload}\r`, "\n\r", "\ndata: [DONE]\r\n\r\n"];
  const stream = new ReadableStream({ start(controller) {
    for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
    controller.close();
  } });
  const response = new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
  const window = setup("<main></main>", () => Promise.resolve(response));
  await window.fetch("/backend-api/conversation");
  assert.equal(await response.text(), chunks.join(""));
  await waitForTime(window, "stream-id");
  assert.equal(window.chatgptTimestampResponseData.getTime("stream-id"), 1790683205);
  window.close();
});

test("response observer ignores unrelated endpoints and preserves rejected requests", async () => {
  const payload = JSON.stringify(message("unrelated", "assistant", "Text"));
  const window = setup("<main></main>", () => Promise.resolve(new Response(payload,
    { headers: { "Content-Type": "application/json" } })));
  await window.fetch("https://example.com/backend-api/conversation");
  await window.fetch("/unrelated");
  await tick();
  assert.equal(window.chatgptTimestampResponseData.getTime("unrelated"), null);
  window.close();
  const error = new Error("aborted");
  const failure = setup("<main></main>", () => Promise.reject(error));
  await assert.rejects(failure.fetch("/backend-api/conversation"), error);
  failure.close();
});

test("bookmark filtering hides whole new sidebar rows and preserves project controls", () => {
  const window = modernPage();
  const doc = window.document;
  const other = doc.createElement("div");
  other.className = "sidebar-item";
  other.innerHTML = '<a href="/c/other" data-interactive-row-link>Other chat</a><button>Actions</button>';
  doc.body.prepend(other);
  window.eval('userSettings.starredIds = ["chat-1"]; userSettings.sidebarFilterMode = "starred"');
  window.addSidebarTimestampsFiber();
  assert.equal(other.style.display, "none");
  const current = doc.querySelector('a[href="/c/chat-1"]').closest(".sidebar-item");
  assert.equal(current.style.display, "");
  assert.equal(current.querySelector(".timestamp-star").style.display, "flex");
  assert.equal(doc.querySelector("[data-app-action-sidebar-project-row]").style.display, "");
  window.eval('userSettings.sidebarFilterMode = "all"; userSettings.starredIds = []');
  window.addSidebarTimestampsFiber();
  assert.equal(other.style.display, "");
  assert.equal(current.querySelector(".timestamp-star").style.display, "none");
  window.close();
});

test("v2.2 hover modes, custom colors and font weights apply to the new layout", () => {
  const window = modernPage();
  window.document.documentElement.setAttribute("data-theme", "dark");
  window.eval(`Object.assign(userSettings, {
    colorSidebarPrimaryDark: "#123456", colorSidebarSecondaryDark: "#abcdef",
    colorChatDark: "#654321", boldSidebarTimestamp: true, boldChatTimestamp: false
  })`);
  window.addSidebarTimestampsFiber();
  window.addChatTimestamps();
  const row = window.document.querySelector(".sidebar-item");
  const primary = row.querySelector(".timestamp-primary");
  const secondary = row.querySelector(".timestamp-secondary");
  assert.equal(primary.style.color, "rgb(18, 52, 86)");
  assert.equal(secondary.style.color, "rgb(171, 205, 239)");
  assert.equal(primary.parentElement.style.fontWeight, "600");
  row.dispatchEvent(new window.Event("mouseenter"));
  assert.equal(primary.style.opacity, "0");
  assert.equal(secondary.style.opacity, "1");
  row.dispatchEvent(new window.Event("mouseleave"));
  assert.equal(primary.style.opacity, "1");
  const stamp = window.document.querySelector(".chatgpt-timestamp");
  assert.equal(stamp.style.color, "rgb(101, 67, 33)");
  assert.equal(stamp.style.fontWeight, "400");
  window.eval('userSettings.hoverMode = "classic"');
  window.addSidebarTimestampsFiber();
  row.dispatchEvent(new window.Event("mouseenter"));
  assert.equal(secondary.style.display, "block");
  assert.equal(row.style.paddingBottom, "28px");
  window.eval('userSettings.hoverMode = "disabled"; userSettings.colorChatDark = "invalid"');
  window.addSidebarTimestampsFiber();
  window.addChatTimestamps();
  assert.equal(secondary.style.display, "none");
  assert.equal(stamp.style.color, "rgb(175, 175, 175)");
  window.close();
});

test("historyItem sidebar props still supply dates and export metadata", () => {
  const window = modernPage();
  attach(window.document.querySelector("a"), { historyItem: {
    id: "chat-1", title: "History title", create_time: "2026-08-01T00:00:00Z",
  } });
  window.addSidebarTimestampsFiber();
  const data = JSON.parse(window.exportCurrentChat("json").content);
  assert.equal(data.title, "History title");
  assert.equal(data.created, "2026-08-01T00:00:00.000Z");
  window.close();
});

test("new message props resolve WEB draft IDs for bookmark context and star badges", () => {
  const window = modernPage();
  window.history.replaceState(null, "", "/c/server-chat");
  const link = window.document.querySelector("a");
  link.setAttribute("href", "/c/WEB:client-chat");
  attach(link, { conversation: { id: "WEB:client-chat", create_time: 1790683200 } });
  const element = window.document.querySelector("[data-chatgpt-search-message-ids]");
  attach(element, { localConversationId: "WEB:client-chat", conversationId: "server-chat" });
  const context = window.getChatContext();
  assert.equal(context.conversationId, "server-chat");
  assert.equal(context.title, "Fixture chat");
  assert.equal(context.isDraft, false);
  window.eval('userSettings.starredIds = ["server-chat"]');
  window.addSidebarTimestampsFiber();
  assert.equal(link.closest(".sidebar-item").querySelector(".timestamp-star").style.display, "flex");
  window.close();
});

test("unresolved WEB drafts are not exposed as bookmarkable conversations", () => {
  const window = modernPage();
  window.history.replaceState(null, "", "/c/WEB:unresolved");
  const context = window.getChatContext();
  assert.equal(context.conversationId, null);
  assert.equal(context.isDraft, true);
  window.close();
});

test("group chat export preserves sender names, excludes notices and nested segments", () => {
  const window = setup(`<title>Group</title><a href="/gg/room-1">Group</a><main>
    <div data-message-id="notice"></div><div data-message-id="group-user"></div>
    <div data-message-id="group-answer"><div data-message-id="segment"></div></div></main>`);
  window.history.replaceState(null, "", "/gg/room-1");
  const room = { id: "room-1", updatedAt$: () => "2026-09-29T12:01:00Z",
    name$: () => "Our group", hasFetchedBeginning$: () => true,
    messages$: () => [{ createdAt: "2026-09-01T00:00:00Z" }],
    members$: () => [{ accountUserId: "member-1", name: "Example member" }] };
  attach(window.document.querySelector("a"), ...Array.from({ length: 35 }, () => ({})), { room });
  attach(window.document.querySelector('[data-message-id="notice"]'), { calpicoMessage: { role: "system", preview: "Created group" } });
  attach(window.document.querySelector('[data-message-id="group-user"]'), { calpicoMessage: {
    role: "user", accountUserId: "member-1", content: { text: "Group question" }, createdAt: "2026-09-29T12:00:00Z",
  } });
  const answer = { role: "assistant", rawMessages: [message("raw-answer", "assistant", "Group answer")], createdAt: "2026-09-29T12:00:05Z" };
  attach(window.document.querySelector('[data-message-id="group-answer"]'), { calpicoMessage: answer });
  attach(window.document.querySelector('[data-message-id="segment"]'), { calpicoMessage: answer });
  window.eval('userSettings.starredIds = ["room-1"]');
  window.addSidebarTimestampsFiber();
  assert.equal(window.document.querySelector(".timestamp-star").style.display, "flex");
  window.addChatTimestamps();
  assert.equal(window.document.querySelectorAll(".chatgpt-timestamp").length, 0);
  const result = window.exportCurrentChat("json");
  assert.equal(result.success, true, result.message);
  const data = JSON.parse(result.content);
  assert.equal(data.messageCount, 2);
  assert.equal(data.title, "Our group");
  assert.equal(data.created, "2026-09-01T00:00:00.000Z");
  assert.equal(data.messages[0].sender, "Example member");
  assert.equal(data.messages[1].content, "Group answer");
  assert.equal(window.getChatContext().conversationId, "room-1");
  window.close();
});
