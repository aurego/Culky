import asyncio
from playwright.async_api import async_playwright
O='/tmp/claude-0/-home-claude/ee24b00d-fc66-5265-a4f5-76df7aad391a/scratchpad/site/img'
# Personnages illustrés de démonstration : fond aux couleurs de Kulky, visage rond, joues roses.
P = {
 'sofia': dict(fond='#DDF3F1', peau='#F2C9A8', cheveux='#3B2A26', coiffure='long', haut='#3FB6B0'),
 'hugo':  dict(fond='#FBEFD6', peau='#E9B48C', cheveux='#6B4A2E', coiffure='court', haut='#E8A631', lunettes=True),
 'lea':   dict(fond='#FDE6E0', peau='#F7D7BE', cheveux='#C9783E', coiffure='carre', haut='#F28B73'),
 'malik': dict(fond='#DAF0E6', peau='#8D5B3E', cheveux='#1E1714', coiffure='boucles', haut='#2BA77F'),
 'ines':  dict(fond='#F4E3E6', peau='#C98E68', cheveux='#2A1D1A', coiffure='chignon', haut='#9B2335'),
 'jules': dict(fond='#E6EEF7', peau='#F0C7A4', cheveux='#E2B85C', coiffure='meche', haut='#5A7FB0'),
 'nadia': dict(fond='#DDF3F1', peau='#B97A56', cheveux='#5A3422', coiffure='carre', haut='#E8A631'),
 'marcel': dict(fond='#FBEFD6', peau='#EDC2A0', cheveux='#E8E4DE', coiffure='senior', haut='#9C3F28', barbe=True, lunettes=True),
}
def svg(d):
    f,pe,ch,hb=d['fond'],d['peau'],d['cheveux'],d['haut']
    c=d['coiffure']
    arriere={'long':f'<path d="M58 118 C52 60 92 40 128 40 C164 40 204 60 198 118 L206 200 L50 200 Z" fill="{ch}"/>',
             'chignon':f'<circle cx="128" cy="44" r="26" fill="{ch}"/>',
             'carre':f'<path d="M62 120 C58 66 96 44 128 44 C160 44 198 66 194 120 L196 168 L60 168 Z" fill="{ch}"/>',
             'voile':f'<path d="M60 128 C56 66 94 40 128 40 C162 40 200 66 196 128 C196 170 178 196 128 206 C78 196 60 170 60 128 Z" fill="{ch}"/><path d="M40 256 C46 214 82 196 128 196 C174 196 210 214 216 256 Z" fill="{ch}"/>'}.get(c,'')
    devant={'long':f'<path d="M78 104 C84 70 108 60 128 60 C150 60 172 72 178 104 C160 92 140 84 120 86 C104 88 90 96 78 104 Z" fill="{ch}"/>',
            'court':f'<path d="M76 102 C76 66 102 52 128 52 C158 52 182 68 180 102 C168 86 150 80 128 82 C106 80 88 88 76 102 Z" fill="{ch}"/>',
            'carre':f'<path d="M74 106 C80 70 104 58 128 58 C154 58 176 70 182 106 C150 96 124 84 112 72 C104 88 92 98 74 106 Z" fill="{ch}"/>',
            'boucles':''.join(f'<circle cx="{x}" cy="{y}" r="16" fill="{ch}"/>' for x,y in [(84,92),(100,74),(120,64),(142,64),(162,74),(176,92),(92,84),(168,84)]),
            'chignon':f'<path d="M78 104 C80 72 104 60 128 60 C152 60 176 72 178 104 C160 88 146 82 128 82 C110 82 94 90 78 104 Z" fill="{ch}"/>',
            'voile':f'<path d="M72 112 C74 74 100 58 128 58 C156 58 182 74 184 112 C176 92 156 80 128 80 C100 80 80 92 72 112 Z" fill="{ch}"/>',
            'senior':f'<path d="M74 118 C70 92 80 76 92 70 C88 90 86 104 84 124 Z M182 118 C186 92 176 76 164 70 C168 90 170 104 172 124 Z" fill="{ch}"/>',
            'meche':f'<path d="M76 104 C74 68 102 54 130 54 C160 54 184 70 180 100 C168 92 150 90 136 98 C128 84 104 84 76 104 Z" fill="{ch}"/>'}[c]
    barbe=f'<path d="M80 128 C84 176 108 190 128 190 C148 190 172 176 176 128 C170 150 156 160 128 160 C100 160 86 150 80 128 Z" fill="{ch}"/><path d="M110 150 C118 145 138 145 146 150" stroke="{ch}" stroke-width="9" stroke-linecap="round" fill="none"/>' if d.get('barbe') else ''
    lun='<g fill="none" stroke="#3B2A26" stroke-width="4"><circle cx="108" cy="124" r="14"/><circle cx="148" cy="124" r="14"/><path d="M122 124h12"/></g>' if d.get('lunettes') else ''
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
<circle cx="128" cy="128" r="128" fill="{f}"/>
<clipPath id="r"><circle cx="128" cy="128" r="128"/></clipPath><g clip-path="url(#r)">
<path d="M40 256 C44 206 82 186 128 186 C174 186 212 206 216 256 Z" fill="{hb}"/>
{arriere}
<rect x="112" y="160" width="32" height="34" rx="12" fill="{pe}"/>
<ellipse cx="128" cy="118" rx="52" ry="58" fill="{pe}"/>
{devant}
<circle cx="108" cy="124" r="5.5" fill="#2A1D1A"/><circle cx="148" cy="124" r="5.5" fill="#2A1D1A"/>
{lun}
{barbe}<path d="M114 146 C120 154 136 154 142 146" fill="none" stroke="#2A1D1A" stroke-width="4.5" stroke-linecap="round"/>
<circle cx="94" cy="142" r="8" fill="#F28B73" opacity=".55"/><circle cx="162" cy="142" r="8" fill="#F28B73" opacity=".55"/>
</g></svg>'''
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':256,'height':256})
        for n,d in P.items():
            s=svg(d); open(f'{O}/{n}.svg','w').write(s)
            await pg.set_content(f'<body style="margin:0;background:transparent">{s}</body>')
            await pg.screenshot(path=f'{O}/{n}.png', omit_background=True, clip={'x':0,'y':0,'width':256,'height':256})
        await b.close()
asyncio.run(main())
