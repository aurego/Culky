"""Captures de démonstration de Kulky pour le site : personnages illustrés, œuvres libres de droits."""
import asyncio, json, re, subprocess, sys, time
from urllib.parse import urlparse, parse_qs, unquote, urlencode
from playwright.async_api import async_playwright

S = sys.argv[1]; IMG = f'{S}/site/img'; OUT = f'{S}/site/ecrans'
def uid(n): return f'{n:08d}-0000-4000-8000-000000000000'
MOI, SOFIA, HUGO, MALIK, INES, JULES, NADIA, MARCEL = (uid(i) for i in range(1, 9))
def photo(n): return f'https://demo.kulky.test/img/{n}'
profils = {
  MOI:   {'id': MOI, 'pseudo': 'Léa', 'bio': 'Romans du XIXe, ciné muet et concerts dans les petites salles.', 'photo_url': photo('lea.png'), 'univers_choisis': ['livres', 'cine', 'concerts', 'expos'], 'inscription_terminee': True, 'visibilite_defaut': 'public'},
  SOFIA: {'id': SOFIA, 'pseudo': 'Sofia', 'bio': 'Toujours un livre dans le sac.', 'photo_url': photo('sofia.png'), 'univers_choisis': ['livres', 'concerts'], 'inscription_terminee': True},
  HUGO:  {'id': HUGO, 'pseudo': 'Hugo', 'bio': None, 'photo_url': photo('hugo.png'), 'univers_choisis': ['livres'], 'inscription_terminee': True},
  MALIK: {'id': MALIK, 'pseudo': 'Malik', 'bio': None, 'photo_url': photo('malik.png'), 'univers_choisis': ['expos'], 'inscription_terminee': True},
  INES:  {'id': INES, 'pseudo': 'Émilie', 'bio': None, 'photo_url': photo('ines.png'), 'univers_choisis': ['cine'], 'inscription_terminee': True},
  JULES: {'id': JULES, 'pseudo': 'Jules', 'bio': None, 'photo_url': photo('jules.png'), 'univers_choisis': ['livres'], 'inscription_terminee': True},
  NADIA: {'id': NADIA, 'pseudo': 'Nadia', 'bio': None, 'photo_url': photo('nadia.png'), 'univers_choisis': ['expos'], 'inscription_terminee': True},
  MARCEL: {'id': MARCEL, 'pseudo': 'Marcel', 'bio': None, 'photo_url': photo('marcel.png'), 'univers_choisis': ['livres', 'concerts'], 'inscription_terminee': True},
}
oeuvres = {
  'o1': {'id': 'o1', 'titre': 'Le Comte de Monte-Cristo', 'createur': 'Alexandre Dumas', 'univers': 'livres', 'image_url': photo('monte-cristo.png'), 'date_fin': None, 'nb_pages': 1240},
  'o2': {'id': 'o2', 'titre': 'Les Misérables', 'createur': 'Victor Hugo', 'univers': 'livres', 'image_url': photo('miserables.png'), 'date_fin': None},
  'o3': {'id': 'o3', 'titre': 'Le Voyage dans la Lune', 'createur': 'Georges Méliès', 'univers': 'cine', 'image_url': photo('voyage-lune.png'), 'date_fin': None},
  'o4': {'id': 'o4', 'titre': 'Les Nuits Jaunes', 'createur': 'Les Nuits Jaunes', 'univers': 'concerts', 'image_url': None, 'date_fin': None},
  'o5': {'id': 'o5', 'titre': 'Lignes et couleurs', 'createur': None, 'univers': 'expos', 'image_url': None, 'date_fin': None},
  'o6': {'id': 'o6', 'titre': 'Orgueil et préjugés', 'createur': 'Jane Austen', 'univers': 'livres', 'image_url': photo('orgueil.png'), 'date_fin': None},
}
lieux = {'l1': {'nom': 'La Petite Scène'}, 'l2': {'nom': 'Musée des Beaux-Arts'}, 'l3': {'nom': 'Cinéma Le Rex'}}
def il_y_a(h): return time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(time.time() - h * 3600))
def jour(h): return time.strftime('%Y-%m-%d', time.gmtime(time.time() - h * 3600))
def act(i, qui, o, h, emotions, mots=None, lieu=None, etat='fini', cine=None, photo_url=None, chouchou=False):
    return {'id': f'a{i}', 'auteur_id': qui, 'oeuvre_id': o, 'lieu_id': lieu, 'date_activite': jour(h), 'cree_le': il_y_a(h), 'etat': etat, 'emotions': emotions,
            'mots': mots, 'au_cinema': cine, 'visibilite': 'public', 'photo_url': photo_url, 'chouchou': chouchou, 'grace_a': None}
activites = [
  act(1, SOFIA, 'o4', 2, ['electrise', 'danse'], 'Trois rappels et toute la salle qui chante. Je ne m’en remets pas.', 'l1', photo_url=photo('concert.jpg')),
  act(2, HUGO, 'o1', 5, ['captive', 'coup-de-coeur'], '1 240 pages et pas une de trop. La vengeance la plus élégante de la littérature.'),
  act(3, NADIA, 'o5', 26, ['emerveille', 'inspire'], 'Ce rouge, en vrai… On reste plantée devant dix minutes.', 'l2', photo_url=photo('expo.jpg')),
  act(6, MARCEL, 'o2', 40, ['emu', 'habite'], 'Relu à 72 ans, et toujours la même émotion.'),
  act(7, MALIK, 'o3', 60, ['emerveille', 'diverti']),
  act(4, INES, 'o3', 30, ['surpris', 'mort-de-rire'], '1902 et toujours aussi drôle. Ciné-concert parfait.', 'l3', cine=True),
  act(5, JULES, 'o6', 50, ['attendri', 'habite']),
  act(10, MOI, 'o1', 300, ['captive', 'coup-de-coeur'], None, chouchou=True),
  act(11, MOI, 'o3', 900, ['emerveille'], None, 'l3', cine=True, chouchou=True),
  act(12, MOI, 'o6', 1500, ['attendri'], None, chouchou=True),
]
abonnements = [{'abonne_id': MOI, 'suivi_id': x} for x in (SOFIA, HUGO, MALIK, INES, JULES, NADIA, MARCEL)] + [{'abonne_id': x, 'suivi_id': MOI} for x in (SOFIA, HUGO, MALIK, INES)]
culkoko = [{'activite_id': 'a1', 'profil_id': x} for x in (HUGO, MALIK, INES, JULES)] + [{'activite_id': 'a2', 'profil_id': x} for x in (SOFIA, JULES)] + [{'activite_id': 'a3', 'profil_id': MOI}] + [{'activite_id': 'a10', 'profil_id': x} for x in (SOFIA, HUGO, MALIK, INES, JULES)]
penses = [{'id': 'p1', 'expediteur_id': SOFIA, 'destinataire_id': MOI, 'oeuvre_id': 'o2', 'mot': 'Tu vas adorer Fantine et Jean Valjean. J’ai pensé à toi à chaque chapitre !', 'propose_accompagner': False, 'cree_le': il_y_a(20), 'activite_bouclee_id': None, 'merci_le': None},
          {'id': 'p2', 'expediteur_id': MOI, 'destinataire_id': HUGO, 'oeuvre_id': 'o1', 'mot': 'Pour tes longues soirées d’hiver !', 'cree_le': il_y_a(800), 'merci_le': il_y_a(700), 'activite_bouclee_id': 'a2'}]
session = {'access_token': 'faux', 'refresh_token': 'faux', 'token_type': 'bearer', 'expires_in': 3600, 'expires_at': int(time.time()) + 3600,
           'user': {'id': MOI, 'aud': 'authenticated', 'role': 'authenticated', 'email': 'lea@exemple.fr'}}

def v(q, c): return unquote(q[c][0]) if c in q else None
def ids_in(s): return re.findall(r'[0-9a-f]{8}-0000-4000-8000-0{12}|[aop]\d+', s or '')
def filtre(lignes, q, cles):
    for c in cles:
        val = v(q, c)
        if val is None: continue
        if val.startswith('in.'): lignes = [x for x in lignes if str(x.get(c)) in ids_in(val)]
        elif val.startswith('eq.'): lignes = [x for x in lignes if str(x.get(c)).lower() == val[3:].lower()]
        elif val.startswith('neq.'): lignes = [x for x in lignes if str(x.get(c)) != val[4:]]
        elif val.startswith('is.'): lignes = [x for x in lignes if x.get(c) is None] if val == 'is.null' else lignes
    return lignes

def enrichir_activite(a):
    return {**a, 'oeuvre': oeuvres[a['oeuvre_id']], 'lieu': lieux.get(a['lieu_id']), 'auteur': {'pseudo': profils[a['auteur_id']]['pseudo'], 'photo_url': profils[a['auteur_id']]['photo_url']}, 'nb': [{'count': {'a1': 3, 'a2': 1, 'a20': 4}.get(a['id'], 0)}]}

async def gerer(route):
    req = route.request; u = urlparse(req.url)
    if u.netloc == 'demo.kulky.test':
        nom = u.path.split('/')[-1]
        return await route.fulfill(status=200, path=f'{IMG}/{nom}', headers={'access-control-allow-origin': '*'})
    if 'googleapis.com' in u.netloc:
        items = [{'id': 'gb1', 'volumeInfo': {'title': 'Les Misérables', 'authors': ['Victor Hugo'], 'publishedDate': '1862', 'pageCount': 1900, 'imageLinks': {'thumbnail': photo('miserables.png')}}}]
        return await route.fulfill(status=200, headers={'access-control-allow-origin': '*', 'content-type': 'application/json'}, body=json.dumps({'items': items}))
    if 'supabase.co' not in u.netloc: return await route.continue_()
    h = {'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': 'content-range', 'content-type': 'application/json'}
    if req.method == 'OPTIONS': return await route.fulfill(status=200, headers=h)
    if u.path.startswith('/auth/'): return await route.fulfill(status=200, headers=h, body=json.dumps(session['user']))
    if u.path.startswith('/storage/'): return await route.fulfill(status=200, headers=h, body='{"Key":"x"}')
    if '/rpc/' in u.path: return await route.fulfill(status=200, headers=h, body='[]')
    table = u.path.split('/')[-1]; q = parse_qs(u.query, keep_blank_values=True)
    objet = 'vnd.pgrst.object' in (req.headers.get('accept') or '')
    async def rep(l):
        if req.method == 'HEAD': return await route.fulfill(status=200, headers={**h, 'content-range': f'*/{len(l)}'}, body='')
        if objet:
            return await route.fulfill(status=200 if l else 406, headers=h, body=json.dumps(l[0] if l else {'code': 'PGRST116'}))
        return await route.fulfill(status=200, headers={**h, 'content-range': f'0-{max(len(l)-1,0)}/{len(l)}'}, body=json.dumps(l))
    if req.method in ('POST', 'PATCH', 'DELETE'):
        if req.method == 'POST' and table == 'activites': return await route.fulfill(status=201, headers=h, body=json.dumps({'id': 'a99'}))
        if req.method == 'POST' and table == 'oeuvres': return await route.fulfill(status=201, headers=h, body=json.dumps({'id': 'o2'}))
        return await route.fulfill(status=201, headers=h, body='[]')
    if table == 'profils':
        l = list(profils.values())
        if v(q, 'pseudo'): l = [p for p in l if v(q, 'pseudo').split('.', 1)[1].strip('*%').lower() in p['pseudo'].lower()]
        return await rep(filtre(l, q, ['id']))
    if table == 'activites':
        l = filtre(activites, q, ['id', 'auteur_id', 'oeuvre_id', 'etat', 'chouchou'])
        if v(q, 'visibilite'): l = [a for a in l if a['visibilite'] == 'public']
        l = sorted(l, key=lambda a: (a['date_activite'], a['cree_le']), reverse=True)
        return await rep([enrichir_activite(a) for a in l])
    if table == 'culkoko': return await rep(filtre(culkoko, q, ['activite_id', 'profil_id']))
    if table == 'abonnements':
        sel = v(q, 'select') or ''
        l = filtre(abonnements, q, ['abonne_id', 'suivi_id'])
        return await rep([{**x, 'par': {'pseudo': profils[x['abonne_id']]['pseudo']}, 'p': profils[x['abonne_id'] if 'abonne_id_fkey(id' in sel else x['suivi_id']]} for x in l])
    if table == 'oeuvres':
        return await rep(filtre(list(oeuvres.values()), q, ['id', 'univers']))
    if table == 'penses':
        l = filtre(penses, q, ['destinataire_id', 'expediteur_id', 'oeuvre_id'])
        return await rep([{**p, 'oeuvre': oeuvres[p['oeuvre_id']], 'expediteur': {'id': p['expediteur_id'], 'pseudo': profils[p['expediteur_id']]['pseudo']},
                           'destinataire': {'pseudo': profils[p['destinataire_id']]['pseudo']} if p.get('destinataire_id') else None,
                           'activite': {'emotions': ['captive', 'coup-de-coeur'], 'etat': 'fini'} if p.get('activite_bouclee_id') else None} for p in l])
    return await rep([])

srv = subprocess.Popen(['python3', f'{S}/spa.py', 'dist'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, accept_downloads=True)
        await ctx.add_init_script(f"localStorage.setItem('sb-ktsbhikhrmjsoakljjlj-auth-token', {json.dumps(json.dumps(session))}); localStorage.setItem('culky-premiers-pas-masques','1');")
        await ctx.route('**/*', gerer)
        pg = await ctx.new_page(); err = []
        pg.on('pageerror', lambda e: err.append(str(e)))
        async def aller(chemin, attente=2200):
            await pg.goto('http://localhost:5077' + chemin); await pg.wait_for_timeout(1200)
            if await pg.get_by_label('Entrer dans Kulky').count(): await pg.get_by_label('Entrer dans Kulky').click()
            await pg.wait_for_timeout(attente)
        async def shot(n): await pg.screenshot(path=f'{OUT}/{n}.png')
        await aller('/'); await shot('1-fil')
        await pg.set_viewport_size({'width': 390, 'height': 2600}); await pg.wait_for_timeout(1500); await shot('1-fil-long'); await pg.set_viewport_size({'width': 390, 'height': 844})
        await pg.mouse.wheel(0, 520); await pg.wait_for_timeout(800); await shot('1b-fil')
        # Léa a fini Les Misérables : ses amis l'applaudissent.
        activites.append(act(20, MOI, 'o2', 0.5, ['coup-de-coeur', 'emerveille'], 'Jean Valjean m’accompagnera longtemps. Merci Sofia !'))
        culkoko.extend({'activite_id': 'a20', 'profil_id': x} for x in (SOFIA, HUGO, MALIK, INES, JULES, NADIA, MARCEL))
        await aller('/'); await shot('8-recu')
        activites.pop()
        await aller('/enregistrer', 1200)
        await pg.get_by_text('Un livre').click(); await pg.wait_for_timeout(700)
        await pg.get_by_label('Titre ou auteur').fill('misérables'); await pg.wait_for_timeout(1500); await shot('2-recherche')
        await pg.get_by_text('Les Misérables').first.click(); await pg.wait_for_timeout(1200)
        for e in ['Coup de cœur', 'Émerveillé·e']:
            await pg.get_by_text(re.compile(e)).first.click(); await pg.wait_for_timeout(300)
        await pg.get_by_placeholder('Ce que tu en retiens…').fill('Jean Valjean m’accompagnera longtemps.'); await pg.wait_for_timeout(400)
        # Démo : pas d'émotion triste à l'écran.
        await pg.get_by_text(re.compile('Bouleversé')).first.evaluate("e => { let n = e; while (n && n.getAttribute('role') !== 'button' && n.tagName !== 'BUTTON') n = n.parentElement; (n || e).style.display = 'none'; }")
        await pg.wait_for_timeout(300); await shot('3-emotions')
        await aller('/celebration?' + urlencode({'univers': 'livres', 'titre': 'Les Misérables', 'createur': 'Victor Hugo', 'image': photo('miserables.png'), 'rang': 'ton 14e livre de l’année', 'emotion': 'coup-de-coeur', 'grace': 'Sofia', 'croises': 'Hugo\nJules'}), 2500)
        await shot('4-fete')
        async with pg.expect_download() as d:
            await pg.get_by_text('Partager en story').click()
        await (await d.value).save_as(f'{OUT}/5-story.png'); await pg.wait_for_timeout(600)
        await aller('/pour-toi'); await shot('6-pour-moi')
        await aller('/penser?oeuvre=o2')
        for n in ['Émilie']: await pg.get_by_text(n, exact=True).first.click(); await pg.wait_for_timeout(250)
        await pg.get_by_text('Tu vas adorer !').click(); await pg.wait_for_timeout(500); await shot('7-conseiller')
        await aller('/carnet'); await shot('8-profil')
        await aller('/amis'); await shot('9-amis')
        print('erreurs :', err[:6]); await b.close()
try: asyncio.run(main())
finally: srv.kill()
