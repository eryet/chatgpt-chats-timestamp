# Store screenshots (zh-TW)

Generates the five localized Chrome Web Store screenshots in
`screenshot/store-zh-TW/`, in upload order:

1. `1-cover.png`: name, tagline, and the Actions and Bookmarks tabs
2. `2-sidebar-light.png`: the ChatGPT sidebar with timestamps (light)
3. `3-sidebar-dark.png`: the same sidebar (dark)
4. `4-bookmarks.png`: folders, notes, and the bookmark detail view
5. `5-style.png`: the Settings and Appearance tabs

```bash
python scripts/store-screenshots/generate.py            # all slides
python scripts/store-screenshots/generate.py 4 5        # only slides 4 and 5
```

Requirements: Python with Pillow, Node 22 or later, Google Chrome (set `CHROME`
if it isn't at the default Windows path), and network access for Google Fonts.
Output is 1280×800, 24-bit PNG with no alpha, as the store requires.

## How it works

- The popup panels are the real `src/popup.html` rendered in an iframe.
  `popup-stub.js` replaces `chrome.*` with the zh_TW strings from
  `src/_locales`, sample bookmarks, and a fixed clock (2026/10/1 10:15:25).
  `popup-after.js` picks the tab, theme, and bookmark from the iframe URL hash
  and reports the popup's size to the slide.
- The sidebar slides start from `screenshot/white.png` and `dark.png` and redraw
  the text in zh-TW. The labels (新對話, 搜尋對話, 檔案庫, 專案, 對話) are ChatGPT's
  own zh-TW strings. Line positions in `2-sidebar-light.html` and
  `3-sidebar-dark.html` were measured from those two images.
- `render.mjs` drives headless Chrome over the DevTools protocol at 2× with the
  zh-TW locale and the Asia/Taipei time zone. `generate.py` scales the results
  down to 1280×800.

Edit the slide text in `slides/*.html` and the sample data in `popup-stub.js`.
Popup changes in `src/` are picked up on the next run.
