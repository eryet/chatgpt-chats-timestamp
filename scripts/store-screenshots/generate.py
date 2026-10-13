"""Generate the zh-TW Chrome Web Store screenshots into screenshot/store-zh-TW/.

Usage: python scripts/store-screenshots/generate.py [slide-prefix ...]
Needs Python with Pillow, Node 22+, Google Chrome, and network access for Google Fonts.
"""
import json
import pathlib
import shutil
import subprocess
import sys

from PIL import Image

here = pathlib.Path(__file__).resolve().parent
repo = here.parent.parent
src = repo / "src"
build = here / ".build"
out = repo / "screenshot" / "store-zh-TW"

# 1. Copy the real popup and wire in the chrome.* stub with the zh_TW strings.
popup = build / "popup"
popup.mkdir(parents=True, exist_ok=True)
for name in ("popup.html", "popup.js", "utils.js"):
    shutil.copy(src / name, popup / name)
shutil.copytree(src / "assets", popup / "assets", dirs_exist_ok=True)

messages = json.loads((src / "_locales" / "zh_TW" / "messages.json").read_text(encoding="utf-8"))
stub = (here / "popup-stub.js").read_text(encoding="utf-8")
(popup / "stub.js").write_text(stub.replace("__MESSAGES__", json.dumps(messages, ensure_ascii=False)), encoding="utf-8")
shutil.copy(here / "popup-after.js", popup / "after.js")

html = (popup / "popup.html").read_text(encoding="utf-8")
utils_tag, popup_tag = '<script src="utils.js"></script>', '<script src="popup.js"></script>'
assert utils_tag in html and popup_tag in html, "popup.html script tags changed"
html = html.replace(utils_tag, '<script src="stub.js"></script>\n    ' + utils_tag)
html = html.replace(popup_tag, popup_tag + '\n    <script src="after.js"></script>')
(popup / "shot.html").write_text(html, encoding="utf-8")

# The sidebar slides redraw text over the original screenshots. Re-save them
# without their gAMA/cHRM chunks: Chrome color-converts tagged PNGs, which
# would no longer match the CSS colors painted over the English text.
assets = build / "assets"
assets.mkdir(exist_ok=True)
for name in ("white.png", "dark.png"):
    Image.open(repo / "screenshot" / name).convert("RGB").save(assets / name)
shutil.copy(src / "assets" / "icon.png", assets / "icon.png")

# 2. Render each slide at 2x with headless Chrome.
raw = build / "raw"
shutil.rmtree(raw, ignore_errors=True)
subprocess.run(["node", str(here / "render.mjs"), *sys.argv[1:]], check=True)

# 3. Downscale to 1280x800 24-bit PNGs (no alpha), as the store requires.
out.mkdir(parents=True, exist_ok=True)
for shot in sorted(raw.glob("*.png")):
    dest = out / shot.name
    Image.open(shot).convert("RGB").resize((1280, 800), Image.LANCZOS).save(dest, optimize=True)
    print(dest.relative_to(repo))
