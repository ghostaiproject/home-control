"""Vendor the Lucide icons the page uses into assets/icons.js (no CDN at runtime).

python tools/vendor_icons.py   (needs Playwright; reads the icons from the pinned lucide@0.460.0 build)
Lucide is ISC licensed: https://lucide.dev/license
"""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

NAMES = ('alarm-clock bath bed blinds chef-hat clapperboard cloud-sun coffee door-open droplet droplets fan flame '
         'footprints house lamp lamp-floor layout-dashboard lightbulb lock lock-open minus moon plane plus power '
         'shield-check sofa sparkles speaker sun sunrise sunset thermometer trees tv wind workflow zap').split()
OUT = Path(__file__).resolve().parent.parent / 'assets' / 'icons.js'

with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_page()
    page.set_content('<script src="https://unpkg.com/lucide@0.460.0/dist/umd/lucide.min.js"></script>')
    page.wait_for_function('window.lucide')
    icons = page.evaluate('''(names) => Object.fromEntries(names.map(n => {
        const key = n.split('-').map(s => s[0].toUpperCase() + s.slice(1)).join('');
        return [n, lucide.createElement(lucide.icons[key]).innerHTML];
    }))''', NAMES)
    b.close()

OUT.write_text('// Lucide icons (ISC license, lucide.dev), vendored by tools/vendor_icons.py\n'
               f'window.ICONS = {json.dumps(icons, separators=(",", ":"))};\n', 'utf-8')
print(f'{OUT}  {len(icons)} icons  {OUT.stat().st_size // 1024} KB')
