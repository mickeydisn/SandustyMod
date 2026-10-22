# Scan-Manga Navigator (dossier `scan-manga/`)

App web pour naviguer et **lire** les mangas de
https://www.scan-manga.com :

- 🔍 **Catalogue** (1250+ fiches) avec recherche, couvertures et filtres
- 📖 **Lecture directe** des chapitres (pages extraites comme Hakuneko)
- 🕘 **Historique auto** des mangas ouverts (`localStorage`)
- ✅ **Bouton « déjà lu »** + liste dédiée (`localStorage`)

## ⚠️ Le serveur local est OBLIGATOIRE

scan-manga.com est protégé par **Cloudflare** et son CDN d'images exige des
en-têtes `Origin` / `Referer` qu'un navigateur ne peut pas fournir depuis une
balise `<img>`. Les proxies CORS publics (corsproxy.io, allorigins, weserv…)
sont **bloqués ou renvoient 404** pour ce site.

L'app doit donc être servie par `server.py`, qui :

- scrape avec `curl_cffi` (impersonation Chrome) → Cloudflare passe ;
- relaie les images en ajoutant `Origin` / `Referer` ;
- sert une API JSON pour le frontend (le navigateur ne fait plus de scraping).

## Installation

```bash
pip install curl_cffi          # fortement recommandé (sinon Cloudflare bloque)
```

`curl_cffi` est optionnel côté code (repli `urllib` disponible), mais **sans
lui le lecteur ne peut pas diffuser les pages** : l'empreinte TLS est
filtrée et le CDN renvoie 403.

## Lancer

```bash
cd scan-manga
python3 server.py            # port 8099 (port de test des suites)
python3 server.py 9000       # ou un autre port
# puis ouvrir http://localhost:8099
```

Le port par défaut des suites de tests est **8099**.

Ne pas ouvrir `index.html` en double-clic : le mode `file://` n'a ni API
locale ni proxy d'images, donc rien ne s'affiche.

## Chapitres lisibles en local (`scrape_chapters.py`)

Le script `scrape_chapters.py` scrape (threadé, `scanmanga_core` + `curl_cffi`)
les chapitres **lisibles uniquement** (liens `/lecture-en-ligne/`, exclut les
liens verrouillés izneo/mangaplus) et les stocke dans `catalogue.db`.

```bash
cd scan-manga
python3 scrape_chapters.py           # scrape tous les mangas (par défaut 500)
python3 scrape_chapters.py --limit 50 --workers 8 --delay 0.2
python3 scrape_chapters.py --manga one_piece --force   # re-scrape un titre
python3 scrape_chapters.py --stats   # stats DB (titres avec chapitres, etc.)
```

Résultat :
- `catalogue.db` — table `chapters(manga_id, id, num, title, url)` + `mangas.nb_ch`
- `catalogue.json` — régénéré avec un champ `nb_ch` (nombre de chapitres lisibles)
  par manga, utilisé par l'app web pour les badges et le filtre.

## Filtre UI : « mangas avec des chapitres lisibles »

L'app affiche un badge `N ch.` sur chaque carte du catalogue et propose une case
à cocher **« Afficher uniquement les mangas avec des chapitres lisibles »**.
Elle se combine avec la recherche et est conservée au rechargement du catalogue.

## API du serveur local

| Route | Description |
|---|---|
| `GET /api/catalogue` | Catalogue : `catalogue.json` s'il existe, sinon le catalogue distant scrapé par le serveur (`scan.data.json`). |
| `GET /api/manga?url=<url>` | Fiche d'un manga : `title`, `cover`, `description`, `status`, `chapters[]`. |
| `GET /api/chapters?url=<url>` | Liste des chapitres (`{ chapters: [...] }`). |
| `GET /api/pages?url=<url>` | Pages d'un chapitre : `{ pages: [{ url, width, height }] }`. |
| `GET /img/<chemin>` | Proxy des couvertures → `static.scan-manga.com/img/<chemin>` (envoie le `Referer` requis). |
| `GET /pageimg?u=<url>&r=<referer>` | Proxy des pages de chapitre → CDN `data*.scan-manga.com` (envoie l'`Origin` requis). |
| `GET /static/<chemin>` | Proxy des ressources du site (CSS, JS, polices). |
| `GET /page/<chemin>` | Proxy HTML de `www.scan-manga.com`, avec réécriture des URLs vers le proxy local. |

Points importants :

- **Sécurité** : le proxy n'accepte que les hôtes `*.scan-manga.com`
  (whitelist stricte → pas de SSRF ouvert). Les autres renvoient `400`.
- **Type MIME** : le type est déduit des octets reçus, pas de l'extension.
  Le CDN sert parfois du **WebP sur une URL en `.jpg`** : sans reniflage, le
  navigateur refuse l'image.
- **Cache** : cache mémoire LRU (600 entrées) pour les images et les pages.

## Catalogue SQLite (`fetch_catalogue.py`)

Le script construit `catalogue.db` + `catalogue.json` à partir du site
(l'API `/api/catalogue` sert aussi de repli distant si le JSON manque).
Les chapitres lisibles sont ajoutés par `scrape_chapters.py` (table `chapters`
+ colonne `mangas.nb_ch`).

```bash
cd scan-manga
python3 fetch_catalogue.py                  # fetch -> catalogue.db + catalogue.json
python3 fetch_catalogue.py --stats          # stats DB
python3 fetch_catalogue.py --search naruto  # recherche locale (sans réseau)
python3 scrape_chapters.py                  # chapitres lisibles (table chapters, nb_ch)
python3 scrape_chapters.py --stats          # nb titres avec chapitres, total

# Si le fetch est bloqué (cas normal) :
# 1. ouvre la page catalogue dans ton navigateur, Cmd+S -> page.html, puis :
python3 fetch_catalogue.py --import-file page.html
# 2. ou ajoute un manga à la main :
python3 fetch_catalogue.py --add "One Piece|https://www.scan-manga.com/9/one_piece.html"
# 3. seed offline avec 100+ vrais titres connus (sans réseau) :
python3 fetch_catalogue.py --seed-top100
# 4. top MyAnimeList via API Jikan (si réseau OK) :
python3 fetch_catalogue.py --seed-jikan 100
```

Tables : `mangas(id, site_id, slug, title, url, source, updated_at)` +
`sync_log(at, source, count, status)`. Chaque save réexporte `catalogue.json`
(pour l'app web).

## Stockage local (app web)

- `scanmanga_history` : `{ [mangaId]: { id, title, url, lastChapterId, lastChapterTitle, updatedAt, openedCount } }`
- `scanmanga_read` : `{ [mangaId]: { id, title, url, markedAt } }`

Boutons « 🗑 Vider » pour réinitialiser. Rien n'est envoyé ailleurs.

## Fichiers

- `server.py` — serveur local : API de scraping + proxies images/HTML
- `scanmanga_core.py` — noyau de scraping (déobfuscation, DataAPI, en-têtes)
- `index.html` — structure (catalogue / ouverts / déjà lus / fiche / lecteur)
- `styles.css` — thème sombre
- `app.js` — logique front (catalogue, chapitres, pages, stockage)
- `fetch_catalogue.py` — construction du catalogue (SQLite + JSON)
- `scrape_chapters.py` — scrape les chapitres lisibles dans `catalogue.db`
- `README.md` — ce fichier
