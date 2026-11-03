import asyncio
from playwright.async_api import async_playwright
O='/tmp/claude-0/-home-claude/ee24b00d-fc66-5265-a4f5-76df7aad391a/scratchpad/site/img'
# Une salle de musée : mur sombre, faisceau de lumière, un grand tableau géométrique façon art moderne aux couleurs de Kulky.
svg='''<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600">
<defs><radialGradient id="spot" cx="50%" cy="38%" r="55%"><stop offset="0" stop-color="#3A3340"/><stop offset="1" stop-color="#17131B"/></radialGradient>
<linearGradient id="sol" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2A2430"/><stop offset="1" stop-color="#0F0C12"/></linearGradient></defs>
<rect width="900" height="600" fill="url(#spot)"/><rect y="470" width="900" height="130" fill="url(#sol)"/>
<polygon points="380,0 520,0 690,470 210,470" fill="#FFF6E5" opacity=".07"/>
<g transform="translate(270 70)">
 <rect x="-12" y="-12" width="384" height="384" fill="#E9E2D6"/>
 <rect width="360" height="360" fill="#F7F1E6"/>
 <rect x="0" y="0" width="210" height="190" fill="#9B2335"/>
 <rect x="226" y="0" width="134" height="96" fill="#F7F1E6"/>
 <rect x="226" y="112" width="134" height="78" fill="#E8A631"/>
 <rect x="0" y="206" width="92" height="154" fill="#3FB6B0"/>
 <rect x="108" y="206" width="102" height="66" fill="#F7F1E6"/>
 <rect x="108" y="288" width="102" height="72" fill="#F28B73"/>
 <rect x="226" y="206" width="134" height="154" fill="#F7F1E6"/>
 <rect x="292" y="300" width="68" height="60" fill="#2BA77F"/>
 <g fill="#1F1B24"><rect x="210" y="0" width="16" height="360"/><rect x="0" y="190" width="360" height="16"/><rect x="92" y="206" width="16" height="154"/><rect x="226" y="96" width="134" height="16"/><rect x="108" y="272" width="102" height="16"/><rect x="276" y="206" width="16" height="154"/><rect x="292" y="284" width="68" height="16"/></g>
</g>
<rect x="420" y="452" width="60" height="6" rx="3" fill="#FBEFD6" opacity=".4"/>
<g fill="#0B080D"><circle cx="640" cy="388" r="26"/><path d="M604 600 C604 470 616 420 640 420 C664 420 676 470 676 600Z"/><circle cx="215" cy="400" r="22"/><path d="M186 600 C186 480 196 432 215 432 C234 432 244 480 244 600Z"/></g>
</svg>'''
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':900,'height':600})
        await pg.set_content(f'<body style="margin:0">{svg}</body>')
        await pg.screenshot(path=f'{O}/expo.jpg', type='jpeg', quality=88); await b.close()
asyncio.run(main())
