# Starred Chats Spec

## Summary

Add a local "star chat" feature so users can mark important ChatGPT conversations and quickly identify them in the sidebar. Stars are stored locally via extension storage and do not modify ChatGPT data on the server.

This feature should feel lightweight:

- star or unstar the current chat from the popup
- show a star indicator beside starred chats in the sidebar
- optionally filter the sidebar view to starred chats only

## Goals

- Help users keep track of important conversations
- Reuse the extension's existing sidebar augmentation pattern
- Keep the feature local-only and permission-light
- Avoid fragile DOM operations like reordering ChatGPT's sidebar

## Non-Goals

- Syncing stars with ChatGPT/OpenAI accounts
- Reordering chats in the sidebar
- Full tag or folder support in v1
- Bulk star/unstar actions in v1

## User Stories

- As a user, I can star the chat I am currently viewing
- As a user, I can unstar a previously starred chat
- As a user, I can see which chats are starred directly in the sidebar
- As a user, I can filter the sidebar to show only starred chats
- As a user, my stars remain after refreshing the page or reopening the browser

## UX

### Popup

Add a new section in the popup:

- current chat status: `Starred` or `Not starred`
- primary action button: `Star this chat` / `Unstar this chat`
- optional toggle or select for sidebar filter:
  - `All chats`
  - `Starred only`

Expected behavior:

- If the active tab is not a ChatGPT page, disable the action and show a short status message
- If the current page is a ChatGPT page but no chat id can be resolved, disable the star button
- After toggling, update button text immediately and show a short success state

### Sidebar

For each chat link that already receives a timestamp:

- render a small star marker for starred chats
- keep the marker visually secondary so timestamps remain readable
- marker should work in light and dark mode

Suggested placement:

- append a `starred` badge inline with the timestamp container
- avoid inserting controls that compete with ChatGPT's existing row actions

### Filtering

When `Starred only` is enabled:

- non-starred chat rows should be hidden with `display: none`
- starred rows remain visible
- filtering applies only to chat conversation links, not unrelated navigation items

Project folders and project chats:

- if a row resolves to a conversation id, it can be starred
- project folders without a conversation id should not expose starring in v1

## Data Model

Store in `chrome.storage.sync`.

Proposed shape:

```json
{
  "starredChats": {
    "conversation_id_1": {
      "starredAt": "2026-03-06T10:00:00.000Z",
      "titleSnapshot": "Research notes"
    },
    "conversation_id_2": {
      "starredAt": "2026-03-06T10:05:00.000Z",
      "titleSnapshot": "Refactor plan"
    }
  },
  "sidebarFilterMode": "all"
}
```

Notes:

- key by stable conversation id, not title
- `titleSnapshot` is optional metadata for future use
- `sidebarFilterMode` values:
  - `all`
  - `starred`

## Chat Identity

The implementation needs a stable way to resolve the current conversation id.

Preferred sources:

1. URL path for standard chats: `/c/:id`
2. Sidebar React props if needed for project chat rows

Helper behavior:

- active tab popup logic should parse the current tab URL first
- sidebar rendering should derive id from `conversation.id` when available
- if neither source is available, skip star UI for that item

## Architecture

### Existing files involved

- `src/popup.html`
- `src/popup.js`
- `src/bridge.js`
- `src/main.js`

### Proposed additions

#### `popup.js`

Add:

- current chat id resolution from active tab URL
- load `starredChats` and `sidebarFilterMode`
- star/unstar button handler
- filter control save handler
- disabled state for unsupported pages

#### `bridge.js`

Extend the settings payload sent to the page:

- `starredChats`
- `sidebarFilterMode`

Listen for storage changes and resend them to the page, same pattern as timestamp settings.

#### `main.js`

Extend `userSettings` or introduce separate local state for:

- `starredChats`
- `sidebarFilterMode`

Add logic to:

- decorate starred sidebar rows
- hide non-starred rows when filter mode is `starred`
- refresh the sidebar when star data changes

## Implementation Plan

### Phase 1: Storage and popup

- add storage defaults for `starredChats` and `sidebarFilterMode`
- add popup UI for current chat star state
- add popup UI for sidebar filter mode
- resolve current chat id from active tab URL

### Phase 2: Bridge wiring

- send star/filter data into the page through the existing bridge
- refresh page state when storage changes

### Phase 3: Sidebar rendering

- extract conversation id per sidebar row
- add visual star marker for starred rows
- apply `Starred only` filtering
- ensure rerender loop preserves markers after ChatGPT rerenders

### Phase 4: Polish

- improve spacing and contrast for dark/light mode
- add i18n strings
- add migration guards for missing storage keys

## Technical Notes

### Sidebar row mutation strategy

Keep using the existing pattern:

- locate chat rows
- inspect React fiber props for metadata
- inject a small non-interactive marker

Do not:

- move sidebar nodes
- wrap nodes in custom containers
- depend on brittle text matching for chat titles

### Marker rendering

Recommended first pass:

- use a simple `★` glyph or small inline `span`
- color:
  - light mode: warm amber
  - dark mode: muted gold

Marker should be:

- easy to scan
- not brighter than ChatGPT's selected-row state
- non-clickable in v1 to minimize event conflicts

### Storage limits

`chrome.storage.sync` has quota limits, but starred chats are small records and should comfortably fit typical usage.

If this grows later:

- switch stars to `chrome.storage.local`
- keep filter preference in `sync`

## Edge Cases

- user opens popup on `chatgpt.com` home page with no active conversation
- active conversation exists but sidebar has not fully rendered yet
- conversation title changes after being starred
- ChatGPT rerenders the sidebar and removes injected nodes
- project navigation rows appear that are not actual conversations
- user stars a chat, then the row is not currently visible due to ChatGPT lazy rendering

## Acceptance Criteria

- user can star and unstar the active conversation from the popup
- star state persists across refresh and browser restart
- starred chats show a visible marker in the sidebar
- enabling `Starred only` hides non-starred chat conversation rows
- changing the filter updates the current page without requiring manual refresh
- unsupported pages fail gracefully without console errors or broken popup UI

## Future Extensions

- click star icon directly from the sidebar
- sort starred chats to the top inside a separate synthetic section
- add tags on top of starring
- add export/import of local metadata
- add search within starred chats

## Open Questions

- Should `Starred only` hide project folders, or leave them visible as navigation context?
- Should the popup show the current chat title beside the star button?
- Should star metadata sync across browsers via `sync`, or remain purely local via `local`?

## Recommendation

Ship v1 with:

- popup star toggle
- sidebar star badge
- `All chats` / `Starred only` filter

That is enough to validate demand without making the sidebar interaction model fragile.
