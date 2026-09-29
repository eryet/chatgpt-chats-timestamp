# ChatGPT layout compatibility

For the observed DOM selectors and React prop examples, see the
[September 2026 Fiber update in info.md](info.md#september-2026-react-fiber-update).

This patch is based on v2.2 (`cc6b9d7`). It preserves bookmark management,
group-chat behavior, hover modes, and appearance settings. Jump to Turn was
removed upstream in v2.1 and is not reintroduced here.

The September 2026 page inspected during this repair uses:

- Message units: `[data-chatgpt-search-message-ids]`. The attribute contains whitespace-separated IDs and may repeat an ID. User and assistant messages share a `[data-turn-key]` ancestor, so that ancestor is not a single message.
- Chat links: `a[data-interactive-row-link]`, inside a fixed-height `.sidebar-item` row.
- Project folders: `[data-app-action-sidebar-project-row]`, with the project ID in `data-app-action-sidebar-project-id`. These are buttons, not links.

`src/page-data.js` owns selectors, React data lookup, date normalization, and theme detection. It also supports the older message IDs, sidebar links, and project links. Match message and conversation IDs before using data from an ancestor: a turn can contain reasoning and multiple messages with different creation dates.

The live React diagnostic confirmed sidebar `conversation` data at ancestor 27
(the old code stopped at 25), and project data under `project.gizmo`. Message
components now receive `item` objects with `type: "user-message"` or
`type: "assistant-message"`. User text is in `message`; assistant text is in
`content`. Reasoning groups are separate items and are excluded from export.
Both message types had `sentAtMs: null` in the inspected saved conversation.

`src/response-data.js` runs at document start and observes copies of same-origin
`/backend-api/` JSON and server-sent event responses that ChatGPT already fetches.
It keeps a bounded, in-memory map of message IDs to `create_time` values. It makes
no requests, stores no message content, and returns the original fetch promise
and response to ChatGPT. Reloading the page clears the map. If neither the server
response nor a message item supplies a date, the extension leaves it unavailable.

Dates may be ISO strings, Unix seconds, or Unix milliseconds. Never substitute the current time when a creation date is unavailable.

## Testing

Run `npm ci` and `npm test`. Tests use jsdom and synthetic React props, with DOM attributes taken from the live page. No conversation content or account data is stored in the fixtures.

For live verification, temporarily disable the store copy, load this repository's `src` folder using **Load unpacked** at `chrome://extensions/`, and refresh ChatGPT. After future source changes, reload the unpacked extension and refresh the page again.

Check sidebar chats and projects, hover modes, message dates, date formats,
alignment, custom colors and font weights, dark/light themes, bookmark badges
and filtering, draft-chat bookmark context, group chats, and
Markdown/plain-text/JSON exports. Navigate between conversations and check a new
response. The new timeline's loaded `entries` provide stable message numbers and
allow export of turns currently outside the rendered DOM. The extension does not
fetch unloaded history.
