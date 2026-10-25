"""Screenshot the running dashboard: python tools/shots.py [url] -> shots/*.png"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:5173/'
OUT = Path(__file__).resolve().parent.parent / 'shots'
OUT.mkdir(exist_ok=True)

with sync_playwright() as p:
    b = p.chromium.launch()
    desk = b.new_page(viewport={'width': 1440, 'height': 960}, device_scale_factor=1)
    desk.goto(URL, wait_until='networkidle')
    desk.wait_for_timeout(800)
    desk.screenshot(path=OUT / 'desktop.png', full_page=True)
    desk.click('[data-mode="night"]')
    desk.click('[data-room="bedroom"]')
    desk.wait_for_timeout(900)
    desk.screenshot(path=OUT / 'desktop-night.png', full_page=True)

    mob = b.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    mob.goto(URL, wait_until='networkidle')
    mob.wait_for_timeout(800)
    mob.screenshot(path=OUT / 'mobile.png')
    b.close()
print('\n'.join(str(f) for f in sorted(OUT.glob('*.png'))))
