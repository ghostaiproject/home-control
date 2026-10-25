"""Screenshot the running dashboard: python tools/shots.py [url] [out_dir]

Writes full-size PNGs (README assets) plus sheet.jpg: one small labeled contact sheet
of every view. Review and share sheet.jpg only; it is ~10x cheaper to look at.
"""
import base64
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:5173/'
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).resolve().parent.parent / 'shots'
OUT.mkdir(exist_ok=True)
SHEET_W = 1600


def sheet(page, shots):
    """Tile (label, png bytes) pairs side by side and save as one compact JPEG."""
    cells = ''.join(
        f'<figure><figcaption>{label}</figcaption>'
        f'<img src="data:image/png;base64,{base64.b64encode(png).decode()}"></figure>'
        for label, png in shots)
    page.set_viewport_size({'width': SHEET_W, 'height': 400})
    page.set_content(f'''<style>
      body {{ margin: 0; padding: 12px; background: #222; font: 600 15px system-ui; color: #eee;
              display: flex; gap: 12px; align-items: flex-start; }}
      figure {{ margin: 0; flex: var(--f); }} img {{ width: 100%; display: block; border-radius: 6px; }}
      figcaption {{ margin-bottom: 6px; }}
      figure:last-child {{ --f: .45; }} figure {{ --f: 1; }}
    </style>{cells}''')
    page.wait_for_load_state('load')
    page.screenshot(path=OUT / 'sheet.jpg', full_page=True, type='jpeg', quality=60)


with sync_playwright() as p:
    b = p.chromium.launch()
    desk = b.new_page(viewport={'width': 1440, 'height': 960}, device_scale_factor=1)
    desk.goto(URL, wait_until='networkidle')
    desk.wait_for_timeout(800)
    day = desk.screenshot(path=OUT / 'desktop.png', full_page=True)
    desk.click('[data-mode="night"]')
    desk.click('[data-room="bedroom"]')
    desk.wait_for_timeout(900)
    night = desk.screenshot(path=OUT / 'desktop-night.png', full_page=True)

    mob = b.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    mob.goto(URL, wait_until='networkidle')
    mob.wait_for_timeout(800)
    phone = mob.screenshot(path=OUT / 'mobile.png')

    sheet(b.new_page(), [('Desktop', day), ('Night mode', night), ('Mobile', phone)])
    b.close()

for f in sorted(OUT.glob('*.*')):
    print(f'{f}  {f.stat().st_size // 1024} KB')
