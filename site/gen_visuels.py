import asyncio
from playwright.async_api import async_playwright
O='/tmp/claude-0/-home-claude/ee24b00d-fc66-5265-a4f5-76df7aad391a/scratchpad/site/img'
F="<style>@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@600;800&display=swap');</style>"
def couverture(fond, encre, titre, auteur, motif):
    lignes=''.join(f'<text x="150" y="{120+i*44}" text-anchor="middle" font-family="Georgia,serif" font-size="36" font-weight="700" fill="{encre}">{l}</text>' for i,l in enumerate(titre))
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450">
<rect width="300" height="450" fill="{fond}"/>{motif}
<rect x="18" y="18" width="264" height="414" fill="none" stroke="{encre}" stroke-opacity=".5" stroke-width="2"/>
{lignes}<text x="150" y="400" text-anchor="middle" font-family="Georgia,serif" font-size="20" letter-spacing="2" fill="{encre}">{auteur}</text></svg>'''
V={
 'monte-cristo': couverture('#1F6E6A','#F4E9D8',['Le Comte','de','Monte-Cristo'],'ALEXANDRE DUMAS',
     '<g fill="#F4E9D8" opacity=".9"><path d="M60 330 q45-40 90 0 q45 40 90 0 v40 h-180z" opacity=".35"/><circle cx="210" cy="285" r="22" opacity=".8"/></g>'),
 'miserables': couverture('#7A5410','#FBEFD6',['Les','Misérables'],'VICTOR HUGO',
     '<g stroke="#FBEFD6" stroke-width="3" opacity=".55"><path d="M70 360 v-80 l40-30 40 30 v80 M160 360 v-110 l30-25 30 25 v110"/><path d="M50 362 h200"/></g>'),
 'orgueil': couverture('#F4E3E6','#9B2335',['Orgueil','et préjugés'],'JANE AUSTEN',
     '<g fill="#9B2335" opacity=".35"><circle cx="150" cy="300" r="40"/><circle cx="118" cy="278" r="16"/><circle cx="182" cy="278" r="16"/></g>'),
 'voyage-lune': f'''<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450">
<rect width="300" height="450" fill="#1E2A44"/>{''.join(f'<circle cx="{x}" cy="{y}" r="2" fill="#FBEFD6"/>' for x,y in [(40,60),(90,30),(260,80),(230,40),(60,150),(270,190),(30,260)])}
<circle cx="160" cy="190" r="90" fill="#FBEFD6"/><circle cx="130" cy="170" r="10" fill="#1E2A44"/><circle cx="180" cy="170" r="10" fill="#1E2A44"/>
<path d="M125 220 q35 25 70 0" stroke="#1E2A44" stroke-width="7" fill="none" stroke-linecap="round"/>
<path d="M182 150 l52 -40 10 14 -50 38z" fill="#E8A631"/>
<text x="150" y="350" text-anchor="middle" font-family="Georgia,serif" font-size="32" font-weight="700" fill="#FBEFD6">Le Voyage</text>
<text x="150" y="388" text-anchor="middle" font-family="Georgia,serif" font-size="32" font-weight="700" fill="#FBEFD6">dans la Lune</text>
<text x="150" y="420" text-anchor="middle" font-family="Georgia,serif" font-size="16" letter-spacing="2" fill="#E8A631">GEORGES MÉLIÈS · 1902</text></svg>''',
 'concert': f'''<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600">
<rect width="900" height="600" fill="#22142A"/>
<path d="M150 0 L60 420 L240 420Z" fill="#E8A631" opacity=".35"/><path d="M450 0 L340 420 L560 420Z" fill="#F28B73" opacity=".35"/><path d="M750 0 L660 420 L840 420Z" fill="#3FB6B0" opacity=".35"/>
<rect x="0" y="410" width="900" height="40" fill="#3A2440"/>
<g fill="#FBEFD6"><circle cx="450" cy="330" r="22"/><rect x="432" y="352" width="36" height="60" rx="12"/><circle cx="300" cy="345" r="18"/><rect x="286" y="363" width="28" height="48" rx="10"/><circle cx="610" cy="345" r="18"/><rect x="596" y="363" width="28" height="48" rx="10"/></g>
<g fill="#120A16">{''.join(f'<circle cx="{x}" cy="{500+(x*37)%40}" r="{34+(x%3)*6}"/><rect x="{x-30}" y="{520+(x*37)%40}" width="60" height="120" rx="26"/>' for x in range(20,900,70))}</g>
<g stroke="#120A16" stroke-width="16" stroke-linecap="round"><path d="M230 520 l-30 -90"/><path d="M640 520 l40 -100"/></g></svg>''',
 'expo': f'''<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600">
<rect width="900" height="600" fill="#F4EEE6"/><rect x="0" y="470" width="900" height="130" fill="#E4DCD1"/>
<rect x="90" y="110" width="220" height="280" fill="#3FB6B0"/><rect x="110" y="130" width="180" height="240" fill="#DDF3F1"/><circle cx="200" cy="230" r="60" fill="#2BA77F"/>
<rect x="360" y="80" width="300" height="340" fill="#9B2335"/><rect x="382" y="102" width="256" height="296" fill="#FDE6E0"/><path d="M400 380 L510 180 L620 380Z" fill="#F28B73"/><circle cx="570" cy="170" r="30" fill="#E8A631"/>
<rect x="710" y="140" width="130" height="200" fill="#E8A631"/><rect x="726" y="156" width="98" height="168" fill="#FBEFD6"/>
<g fill="#5E5664"><circle cx="520" cy="470" r="22"/><rect x="500" y="490" width="40" height="110" rx="16"/><circle cx="600" cy="476" r="18"/><rect x="584" y="492" width="32" height="108" rx="14"/></g></svg>''',
}
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page()
        for n,s in V.items():
            w,h=(900,600) if n in ('concert','expo') else (300,450)
            await pg.set_viewport_size({'width':w,'height':h})
            await pg.set_content(f'<body style="margin:0">{s}</body>'); await pg.wait_for_timeout(200)
            await pg.screenshot(path=f'{O}/{n}.jpg' if n in ('concert','expo') else f'{O}/{n}.png', clip={'x':0,'y':0,'width':w,'height':h}, **({'quality':85,'type':'jpeg'} if n in ('concert','expo') else {}))
        await b.close()
asyncio.run(main())
