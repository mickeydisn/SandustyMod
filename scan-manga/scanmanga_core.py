#!/usr/bin/env python3
"""Noyau de scraping scan-manga.com (fiche manga -> chapitres -> pages).

Le site est protege par Cloudflare + un jeton "DataAPI" :

  1. page fiche      -> liste des liens de chapitre (div.chapitre_nom > a)
  2. page chapitre  -> blocs eval() obfusques contenant `sme` / `sml`
  3. POST bqj.../lel/<idc>.json {a:sme, b:sml, c:<gpu>} -> charge utile
  4. charge utile   -> zlib -> base64 -> inverse -> JSON {dN,s,v,c,p:[pages]}

IMPORTANT : Cloudflare filtre les empreintes TLS. Avec `urllib` (stdlib) la
requete 3 renvoie une charge utile "degradee" (jetons vides, hote de pages
inaccessible) et les images renvoient 403. Il faut donc `curl_cffi` avec
impersonation navigateur. Sans lui, le serveur fonctionne mais le lecteur
ne peut pas diffuser les pages.
"""
import base64
import json
import os
import re
import sqlite3
import threading
import urllib.error
import urllib.parse
import urllib.request
import zlib

SITE = "https://www.scan-manga.com"
API_HOST = "https://bqj.scan-manga.com/lel/%d.json"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")

# Hotes autorises : le proxy d'images ne doit pas devenir un SSRF ouvert.
ALLOWED_HOSTS = ("scan-manga.com",)

# Alphabet du deobfuscateur du site (base 64 custom : 0-9 a-z A-Z + /)
_ALPHA = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+/"

try:  # optionnel, mais fortement recommande
    from curl_cffi import requests as _creq
    HAVE_CURL = True
except Exception:  # pragma: no cover
    _creq = None
    HAVE_CURL = False


class ScanError(Exception):
    """Erreur metier (reseau, obfuscation, chapitre introuvable...)."""


# --------------------------------------------------------------------------
# Deobfuscation du site
# --------------------------------------------------------------------------
def _decode_base(num_str, e, f):
    """Reproduit _0xe67c(d, e, f) : base `e` -> base `f` (entier)."""
    h = _ALPHA[0:e]
    out_al = _ALPHA[0:f]
    j = 0
    for c, ch in enumerate(reversed(num_str)):
        idx = h.find(ch)
        if idx != -1:
            j += idx * (e ** c)
    k = ""
    while j > 0:
        k = out_al[j % f] + k
        j = (j - (j % f)) // f
    return int(k) if k else 0


def deob(payload, q, t, b, f):
    """Reproduit eval(function(n,w,q,t,b,f){...}) du site.

    `q[b]` est le delimiteur et `b` sert aussi de base de conversion.
    """
    delim = q[b]
    out = ""
    i = 0
    n = payload
    while i < len(n):
        s = ""
        while i < len(n) and n[i] != delim:
            s += n[i]
            i += 1
        i += 1  # saute le delimiteur
        for j in range(len(q)):
            s = s.replace(q[j], str(j))
        out += chr(_decode_base(s, b, 10) - t)
    return out


_EVAL_RE = re.compile(
    r'\}\(\s*"([A-Za-z0-9+/=]+)"\s*,\s*(\d+)\s*,\s*"([^"]+)"\s*,'
    r'\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)')


def extract_bootstrap(html):
    """Extrait (sml, sme) des blocs eval() d'une page chapitre."""
    for payload, _w, q, t, b, f in _EVAL_RE.findall(html):
        try:
            js = deob(payload, q, int(t), int(b), int(f))
        except Exception:
            continue
        m_sml = re.search(r"var\s+sml\s*=\s*'([A-Za-z0-9+/=]+)'", js)
        m_sme = re.search(r"var\s+sme\s*=\s*'([A-Za-z0-9+/=]+)'", js)
        if m_sml and m_sme:
            return m_sml.group(1), m_sme.group(1)
    raise ScanError("Jetons (sme/sml) introuvables dans la page du chapitre.")


def decode_payload(raw_b64, idc):
    """Decode la charge utile de l'API DataAPI -> dict JSON."""
    try:
        raw = zlib.decompress(base64.b64decode(raw_b64)).decode("utf-8")
    except Exception as exc:
        raise ScanError("Charge utile illisible (%s)." % exc)
    # le site retire/ajoute le suffixe hex(idc) avant l'inversion
    text = re.sub(re.escape("%x" % idc) + "$", "", raw)[::-1]
    text += "=" * (-len(text) % 4)
    try:
        return json.loads(base64.b64decode(text).decode("utf-8"))
    except Exception as exc:
        raise ScanError("JSON de l'API illisible (%s)." % exc)



# --------------------------------------------------------------------------
# HTTP
# --------------------------------------------------------------------------
# Cloudflare filtre deux choses :
#   * l'empreinte TLS  -> il faut `curl_cffi` (impersonate="chrome") ;
#   * les en-tetes     -> le CDN des pages exige `Origin`, le CDN des covers
#                         exige `Referer`. Sans l'un des deux -> 403.
_IMG_HOSTS = ("data2.scan-manga.com", "data3.scan-manga.com",
               "data.scan-manga.com", "lel.scan-manga.com")

_SESSION = None
_SESSION_LOCK = threading.Lock()
_TLS = threading.local()


def get_session():
    """Session HTTP partagee (reutilise les cookies entre les appels).

    `curl_cffi` n'est pas thread-safe : on garde donc une session par
    thread via `threading.local`.
    """
    sess = getattr(_TLS, "session", None)
    if sess is None:
        if HAVE_CURL:
            sess = _creq.Session(impersonate="chrome")
        else:
            sess = urllib.request.build_opener()
        _TLS.session = sess
    return sess


def get_clean_session():
    """Session sans cookie (l'API DataAPI renvoie 500 si elle recoit des cookies)."""
    sess = getattr(_TLS, "clean_session", None)
    if sess is None:
        if HAVE_CURL:
            sess = _creq.Session(impersonate="chrome")
        else:
            sess = urllib.request.build_opener()
        _TLS.clean_session = sess
    return sess


def _headers_for(url, referer=None, is_image=False):
    """En-tetes requis par scan-manga selon l'cible."""
    host = urllib.parse.urlparse(url).hostname or ""
    headers = {
        "User-Agent": UA,
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
    }
    if is_image:
        headers["Accept"] = ("image/avif,image/webp,image/apng,image/svg+xml,"
                             "image/*,*/*;q=0.8")
        if any(host.endswith(h) for h in _IMG_HOSTS):
            # CDN des pages : exige Origin, refuse Referer seul
            headers["Origin"] = SITE
        else:
            # CDN statique (covers) : exige Referer
            headers["Referer"] = referer or (SITE + "/")
    else:
        headers["Accept"] = ("text/html,application/xhtml+xml,"
                             "application/xml;q=0.9,*/*;q=0.8")
        headers["Referer"] = referer or (SITE + "/")
        headers["Origin"] = SITE
    return headers


def http_get(url, referer=SITE + "/", timeout=30, binary=False):
    """GET avec les en-tetes requis par scan-manga."""
    headers = _headers_for(url, referer)
    sess = get_session()
    if HAVE_CURL:
        resp = sess.get(url, headers=headers, timeout=timeout)
        if resp.status_code >= 400:
            raise ScanError("HTTP %s sur %s" % (resp.status_code, url))
        return resp.content if binary else resp.text
    req = urllib.request.Request(url, headers=headers)
    try:
        with sess.open(req, timeout=timeout) as resp:
            body = resp.read()
    except urllib.error.HTTPError as exc:
        raise ScanError("HTTP %s sur %s" % (exc.code, url))
    except Exception as exc:
        raise ScanError("Erreur reseau sur %s (%s)" % (url, exc))
    return body if binary else body.decode("utf-8", "ignore")


def http_get_image(url, referer=SITE + "/", timeout=30):
    """Telecharge une image (cover ou page de chapitre)."""
    headers = _headers_for(url, referer, is_image=True)
    sess = get_session()
    if HAVE_CURL:
        resp = sess.get(url, headers=headers, timeout=timeout)
        if resp.status_code >= 400:
            raise ScanError("HTTP %s sur %s" % (resp.status_code, url))
        return resp.content
    req = urllib.request.Request(url, headers=headers)
    try:
        with sess.open(req, timeout=timeout) as resp:
            return resp.read()
    except urllib.error.HTTPError as exc:
        raise ScanError("HTTP %s sur %s" % (exc.code, url))
    except Exception as exc:
        raise ScanError("Erreur reseau sur %s (%s)" % (url, exc))


def http_post_json(url, payload, referer=SITE + "/", timeout=30):
    """POST JSON (utilise par l'API DataAPI).

    L'API DataAPI refuse la requete si elle recoit les cookies de session
    du site (reponse 500) : on utilise donc une session dediee, sans
    cookie, plutot que la session partagee.
    """
    headers = {
        "User-Agent": UA,
        "Referer": referer,
        "Origin": SITE,
        "Accept": "*/*",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
        "Content-Type": "application/json; charset=UTF-8",
        "Token": "yf",
        "source": referer,
    }
    if HAVE_CURL:
        sess = get_clean_session()
        resp = sess.post(url, json=payload, headers=headers, timeout=timeout)
        if resp.status_code >= 400:
            raise ScanError("HTTP %s sur %s" % (resp.status_code, url))
        return resp.text
    opener = urllib.request.build_opener()  # sans cookie
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode("utf-8"), headers=headers)
    try:
        with opener.open(req, timeout=timeout) as resp:
            return resp.read().decode("utf-8", "ignore")
    except urllib.error.HTTPError as exc:
        raise ScanError("HTTP %s sur %s" % (exc.code, url))
    except Exception as exc:
        raise ScanError("Erreur reseau sur %s (%s)" % (url, exc))



# --------------------------------------------------------------------------
# Scraping
# --------------------------------------------------------------------------
_CHAP_RE = re.compile(
    r'<div[^>]*class=[\'"][^\'"]*chapitre_nom[^\'"]*[\'"][^>]*>\s*'
    r'<a[^>]*href=[\'"]([^\'"]+)[\'"][^>]*>(.*?)</a>', re.I | re.S)
_CHAP_FALLBACK_RE = re.compile(
    r'href=[\'"](https?://[^\'"]*?/lecture-en-ligne/[^\'"]+?)[\'"]'
    r'[^>]*>\s*([^<]{1,80})<', re.I)


def _abs_url(url):
    if url.startswith("//"):
        return "https:" + url
    if url.startswith("/"):
        return SITE + url
    return url


def _chapter_entry(url, title):
    """Chapitre normalise : url, titre, id (chemin) et num (numero)."""
    num = ""
    for src in (title or "", url or ""):
        m = re.search(r"chapitre[\s\-]*(\d+)", src, re.I)
        if m:
            num = m.group(1)
            break
    if not num:
        m = re.search(r"_(\d+)\.html", url or "")
        num = m.group(1) if m else ""
    return {
        "id": url.split("?", 1)[0].split("#", 1)[0] or url,
        "url": url,
        "title": title,
        "num": num,
    }


def parse_manga_page(html, manga_url):
    """Extrait la fiche (titre, cover, description, chapitres) d'une page manga."""
    info = {"title": "", "cover": "", "description": "", "status": "",
            "chapters": []}

    m = re.search(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)',
                  html, re.I) or \
        re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']',
                  html, re.I)
    if m:
        info["cover"] = _abs_url(m.group(1))

    m = re.search(r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)',
                  html, re.I) or \
        re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:title["\']',
                  html, re.I)
    if m:
        info["title"] = m.group(1).strip()

    m = re.search(r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']+)',
                  html, re.I)
    if m:
        info["description"] = m.group(1).strip()

    for url, label in _CHAP_RE.findall(html):
        label = re.sub(r"<[^>]+>", "", label).strip()
        info["chapters"].append(
            _chapter_entry(_abs_url(url), label or "Chapitre"))
    if not info["chapters"]:
        for url, label in _CHAP_FALLBACK_RE.findall(html):
            info["chapters"].append(
                _chapter_entry(_abs_url(url), label.strip() or "Chapitre"))
    if not info["chapters"]:
        raise ScanError("Aucun chapitre trouve sur %s" % manga_url)
    return info


def fetch_manga(manga_url):
    """Fiche manga + liste des chapitres."""
    html = http_get(manga_url)
    info = parse_manga_page(html, manga_url)
    info["url"] = manga_url
    return info


def _chapter_id(url):
    m = re.search(r"_(\d+)\.html", url)
    if not m:
        raise ScanError("Identifiant de chapitre introuvable dans %s" % url)
    return int(m.group(1))


def fetch_chapter_pages(chapter_url):
    """Liste des pages d'un chapitre (URLs d'images)."""
    idc = _chapter_id(chapter_url)
    html = http_get(chapter_url)
    sml, sme = extract_bootstrap(html)

    gpu = base64.b64encode(json.dumps(
        {"gpu": "IC", "connection": "IC"}).encode()).decode()
    raw = http_post_json(API_HOST % idc, {"a": sme, "b": sml, "c": gpu},
                         referer=chapter_url)
    data = decode_payload(raw, idc)

    host = data.get("dN") or data.get("dC")
    if not host:
        raise ScanError("L'API n'a pas renvoye d'hote d'images.")
    base = "https://%s/%s/%s/%s" % (host, data.get("s"), data.get("v"), data.get("c"))

    pages = []
    raw_pages = data.get("p") or {}
    for key in sorted(raw_pages, key=lambda x: (len(str(x)), str(x))):
        p = raw_pages[key]
        fname = p.get("f")
        ext = p.get("e") or "jpg"
        if not fname:
            continue
        url = "%s/%s.%s" % (base, fname, ext)
        if p.get("o") and p.get("c"):
            url += "?o=%s&c=%s" % (p["o"], p["c"])
        pages.append({"url": url, "width": p.get("w"), "height": p.get("h")})
    if not pages:
        raise ScanError("Aucune page dans la reponse de l'API.")
    return pages


# --------------------------------------------------------------------------
# Catalogue
# --------------------------------------------------------------------------
CATALOGUE_URL = SITE + "/scanlation/scan.data.json"


def _clean_title(raw):
    """Nettoie un titre du catalogue (tags HTML, entités, espaces)."""
    title = re.sub(r"<[^>]+>", "", raw or "")
    title = (title.replace("&amp;", "&").replace("&quot;", '"')
                  .replace("&#039;", "'").replace("&lt;", "<")
                  .replace("&gt;", ">").replace("&nbsp;", " "))
    return re.sub(r"\s+", " ", title).strip()


def fetch_remote_catalogue():
    """Catalogue complet du site (scan.data.json) -> liste de fiches.

    Utilise en secours quand `catalogue.json` est absent ou perime.
    """
    raw = http_get(CATALOGUE_URL)
    try:
        data = json.loads(raw)
    except Exception as exc:
        raise ScanError("Catalogue distant illisible (%s)." % exc)
    if not isinstance(data, dict):
        raise ScanError("Format de catalogue distant inattendu.")

    items = []
    for raw_title, v in data.items():
        if not isinstance(v, (list, tuple)) or not v:
            continue
        title = _clean_title(raw_title)
        if not title:
            continue
        site_id = str(v[0]) if v[0] else ""
        slug = str(v[1]) if len(v) > 1 and v[1] else ""
        if not slug:
            slug = re.sub(r"[^A-Za-z0-9]+", "-", title).strip("-")
        path = "/%s/%s.html" % (site_id, slug)
        items.append({
            "id": path,
            "site_id": site_id,
            "slug": slug,
            "title": title,
            "url": SITE + path,
        })
    if not items:
        raise ScanError("Catalogue distant vide.")
    return items


# --------------------------------------------------------------------------
# Catalogue local (SQLite) : chapitres deja scrapes
# --------------------------------------------------------------------------
HERE = os.path.dirname(os.path.abspath(__file__))
LOCAL_DB = os.path.join(HERE, "catalogue.db")


def _db_path():
    """Chemin du catalogue local (surchargeable via l'env)."""
    return os.environ.get("SCANMANGA_DB") or LOCAL_DB


def local_chapters(manga_id):
    """Chapitres deja scrapes pour un manga (liste de dicts) ou [].

    Permet d'afficher la liste des chapitres sans re-scraper la fiche.
    """
    path = _db_path()
    if not os.path.exists(path):
        return []
    try:
        con = sqlite3.connect("file:%s?mode=ro" % path, uri=True)
        try:
            rows = con.execute(
                "SELECT id, title, url, num FROM chapters "
                "WHERE manga_id = ? ORDER BY num DESC, rowid DESC",
                (manga_id,)).fetchall()
        finally:
            con.close()
    except sqlite3.Error:
        return []
    return [{"id": r[0], "title": r[1], "url": r[2], "num": r[3]} for r in rows]


def local_manga_ids():
    """Set des ids de mangas pour lesquels on a des chapitres."""
    path = _db_path()
    if not os.path.exists(path):
        return set()
    try:
        con = sqlite3.connect("file:%s?mode=ro" % path, uri=True)
        try:
            rows = con.execute(
                "SELECT DISTINCT manga_id FROM chapters").fetchall()
        finally:
            con.close()
    except sqlite3.Error:
        return set()
    return {r[0] for r in rows if r[0]}

