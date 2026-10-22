#!/usr/bin/env python3
"""
Scan-Manga Navigator — serveur local.

Fonctions :
  1. Sert les fichiers statiques (index.html, styles.css, app.js, catalogue.json).
  2. Proxy les images via /img/<chemin>  -> static.scan-manga.com
     (le CDN exige un header Referer, sinon 403).
  3. Proxy les pages HTML via /page/<chemin> -> www.scan-manga.com.
  4. Scraping serveur via /api/manga, /api/chapters, /api/pages.
     Cloudflare bloque le navigateur : le scraping se fait cote serveur,
     avec curl_cffi (impersonation Chrome) pour passer le controle TLS.
  5. Proxy les images de page via /pageimg?u=<url>&r=<referer>
     (le CDN des pages exige un header Origin : impossible en <img> direct).

Lancement :  python3 server.py [port]
Puis ouvrir  http://localhost:8090
"""
import json
import os
import re
import sys
import threading
import urllib.error
import urllib.parse
import urllib.request
from collections import OrderedDict
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import scanmanga_core as core

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8090
HERE = os.path.dirname(os.path.abspath(__file__))

SITE = core.SITE
STATIC = "https://static.scan-manga.com"

# Cache mémoire des images (LRU) : evite de re-telecharger les couvertures.
_CACHE = OrderedDict()
_CACHE_MAX = 600
_CACHE_LOCK = threading.Lock()

# Signatures binaires -> type MIME. Le CDN scan-manga sert parfois du WebP
# sur une URL terminant par .jpg : on renifle donc les octets recus au lieu
# de deviner a partir de l'extension (sinon le navigateur refuse l'image).
_MAGIC = (
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"GIF87a", "image/gif"),
    (b"GIF89a", "image/gif"),
    (b"BM", "image/bmp"),
    (b"II*\x00", "image/tiff"),
    (b"MM\x00*", "image/tiff"),
)


def sniff_image_type(body, default="image/jpeg"):
    """Determine le type MIME reel d'une image a partir de ses octets."""
    if not body:
        return default
    if body[:4] == b"RIFF" and body[8:12] == b"WEBP":
        return "image/webp"
    if body[4:8] == b"ftyp":
        brand = body[8:12].lower()
        if brand in (b"avif", b"avis"):
            return "image/avif"
        if brand in (b"heic", b"heix", b"mif1", b"heim"):
            return "image/heic"
        return "image/heic"
    for magic, mime in _MAGIC:
        if body.startswith(magic):
            return mime
    if body[:5].lower() == b"<?xml" or body[:4].lower() == b"<svg":
        if b"<svg" in body[:1024].lower():
            return "image/svg+xml"
    return default


def sniff_content_type(body, default="application/octet-stream"):
    """Determine le type MIME reel d'une ressource (image ou fichier web)."""
    if not body:
        return default
    mime = sniff_image_type(body, None)
    if mime:
        return mime
    low = body[:2048].lower()
    if low.startswith(b"<!doctype html") or low.startswith(b"<html"):
        return "text/html; charset=utf-8"
    if low.startswith(b"<?xml") and b"<svg" in low:
        return "image/svg+xml"
    if body[:4] == b"wOFF":
        return "font/woff"
    if body[:4] == b"wOF2":
        return "font/woff2"
    if body[:4] in (b"OTTO", b"true"):
        return "font/otf"
    if body[:5] == b"<?xml":
        return "application/xml; charset=utf-8"
    if body[:1] in (b"{", b"["):
        return "application/json; charset=utf-8"
    # CSS : commentaire, @charset ou @media en tete
    if low.startswith(b"/*") or low.startswith(b"@charset") or \
            low.startswith(b"@import") or low.startswith(b"@media"):
        return "text/css; charset=utf-8"
    # JavaScript : mots-cles typiques dans les 2 premiers Ko
    js_markers = (b"function", b"var ", b"const ", b"let ", b"=>", b"window.",
                   b"document.", b"require(", b"module.exports", b"return ")
    if any(m in low for m in js_markers):
        return "application/javascript; charset=utf-8"
    if b"{" in body[:2048] and b":" in body[:2048]:
        return "text/css; charset=utf-8"
    return default


def _cache_get(key):
    with _CACHE_LOCK:
        if key in _CACHE:
            _CACHE.move_to_end(key)
            return _CACHE[key]
    return None


def _cache_put(key, value):
    with _CACHE_LOCK:
        if key in _CACHE:
            _CACHE.move_to_end(key)
        _CACHE[key] = value
        while len(_CACHE) > _CACHE_MAX:
            _CACHE.popitem(last=False)


def safe_path(rel):
    """Empêche toute traversée de répertoire."""
    rel = rel.lstrip("/")
    if ".." in rel.split("/"):
        return None
    return rel


def is_allowed_host(host):
    """Whitelist stricte : le proxy ne doit pas devenir un SSRF ouvert."""
    if not host:
        return False
    host = host.lower()
    return any(host == d or host.endswith("." + d) for d in core.ALLOWED_HOSTS)


def _manga_id(url):
    """Id de manga dans le catalogue local (ex: '/2336/19-Days.html').

    Le chemin de l'URL fait foi : c'est lui qui identifie la fiche (le slug
    n'est que cosmetique, un mauvais slug redirige vers un autre manga).
    """
    path = urllib.parse.urlparse(url).path or ""
    if not path.endswith(".html"):
        return ""
    return path


def rewrite_html(body, page_url):
    """Réécrit les URLs du site pour qu'elles passent par le proxy local.

    Sans ça, le lecteur (lel.js) tente de charger static.scan-manga.com
    avec un Referer "localhost" -> 403 -> aucune page affichée.
    """
    text = body.decode("utf-8", "ignore")
    origin = "http://%s:%d" % ("localhost", PORT)

    # 1. ressources absolues vers le site -> proxy local
    text = text.replace(STATIC + "/", origin + "/static/")
    text = text.replace(STATIC, origin + "/static")
    text = text.replace(SITE + "/", origin + "/page/")
    text = text.replace(SITE, origin + "/page")

    # 2. URL protocole-relative //static.scan-manga.com/...
    text = text.replace("//static.scan-manga.com/", origin + "/static/")
    text = text.replace("//www.scan-manga.com/", origin + "/page/")

    # 3. base href : force les routes relatives vers le proxy
    text = re.sub(r'<base[^>]*>', '', text, flags=re.I)
    text = re.sub(
        r'(<head[^>]*>)',
        r'\1<base href="' + origin + '/page/">',
        text, count=1, flags=re.I)

    # 4. liens de navigation : ils restent sur le proxy (meme origine)
    return text.encode("utf-8")


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=HERE, **kwargs)

    # ---------- utilitaires ----------
    def log_message(self, fmt, *args):
        sys.stderr.write("[%s] %s\n" % (self.log_date_time_string(), fmt % args))

    def _send_bytes(self, body, ctype, code=200, extra=None):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "public, max-age=86400")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def _send_text(self, text, code=200):
        self._send_bytes(text.encode("utf-8"), "text/plain; charset=utf-8", code)

    def _send_json(self, obj, code=200, extra=None):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self._send_bytes(body, "application/json; charset=utf-8", code, extra)

    def _proxy(self, url, ctype="application/octet-stream", cache_key=None,
               extra=None, rewrite=False, referer=None, is_image=True,
               sniff="image"):
        """Telecharge `url` via le proxy local et renvoie les octets.

        `sniff` : "image" (type MIME d'apres les octets), "any" (images,
        CSS, JS, polices...) ou None (type fourni conserve tel quel).
        """
        def final_type(body):
            if sniff == "image":
                return sniff_image_type(body, ctype)
            if sniff == "any":
                return sniff_content_type(body, ctype)
            return ctype

        if cache_key:
            hit = _cache_get(cache_key)
            if hit is not None:
                body = hit
                if rewrite:
                    body = rewrite_html(body, url)
                return self._send_bytes(body, final_type(body), 200, extra)
        try:
            if is_image:
                body = core.http_get_image(url, referer=referer or (SITE + "/"))
            else:
                body = core.http_get(url, referer=referer or (SITE + "/"))
                if isinstance(body, str):
                    body = body.encode("utf-8")
        except core.ScanError as exc:
            return self._send_text(str(exc), 502)
        if cache_key:
            _cache_put(cache_key, body)
        if rewrite:
            body = rewrite_html(body, url)
        # le type reel prime sur l'extension (.jpg peut servir du WebP)
        self._send_bytes(body, final_type(body), 200, extra)

    # ---------- routage ----------
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # /static/<chemin> -> static.scan-manga.com (ressources du site)
        if path.startswith("/static/"):
            rel = safe_path(path[len("/static/"):])
            if rel is None:
                return self._send_text("Chemin invalide", 400)
            return self._proxy(
                "%s/%s" % (STATIC, rel),
                ctype="application/octet-stream",
                cache_key="static:" + rel,
                sniff="any",
            )
        # /img/<chemin> -> static.scan-manga.com/img/<chemin>
        # Le prefixe "/img/" fait partie de l'URL du CDN : il doit etre
        # conserve, sinon les covers renvoient 404.
        if path.startswith("/img/"):
            rel = safe_path(path[len("/img/"):])
            if rel is None:
                return self._send_text("Chemin invalide", 400)
            return self._proxy(
                "%s/img/%s" % (STATIC, rel),
                ctype="image/jpeg",
                cache_key="img:" + rel,
                extra={"Access-Control-Allow-Origin": "*"},
            )

        # /pageimg?u=<url>&r=<referer> -> CDN des pages de chapitre.
        # Le CDN exige un header Origin : une balise <img> ne peut pas
        # l'envoyer, il faut donc passer par le serveur.
        if path == "/pageimg":
            return self._proxy_pageimg(query)

        # /page/<chemin> -> www.scan-manga.com (HTML, URLs reecrites)
        if path.startswith("/page/"):
            rel = safe_path(path[len("/page/"):])
            if rel is None:
                return self._send_text("Chemin invalide", 400)
            return self._proxy(
                "%s/%s" % (SITE, rel),
                ctype="text/html; charset=utf-8",
                rewrite=True,
                is_image=False,
            )

        if path == "/api/catalogue":
            cat = os.path.join(HERE, "catalogue.json")
            if os.path.exists(cat):
                try:
                    with open(cat, "rb") as f:
                        return self._send_bytes(
                            f.read(), "application/json; charset=utf-8", 200,
                            {"Cache-Control": "no-cache"},
                        )
                except OSError:
                    pass
            # secours : catalogue distant scrape par le serveur
            try:
                items = core.fetch_remote_catalogue()
                return self._send_json(
                    {"items": items, "source": "distant"},
                    extra={"Cache-Control": "no-cache"},
                )
            except core.ScanError as exc:
                return self._send_json({"error": str(exc)}, 502)
            except Exception as exc:  # pragma: no cover
                return self._send_json({"error": "Erreur interne: %s" % exc}, 500)

        # ---- API de scraping (serveur) ----

        # /api/manga?url=<url>  -> fiche + chapitres
        if path == "/api/manga":
            url = (query.get("url") or [""])[0]
            if not is_allowed_host(urllib.parse.urlparse(url).hostname):
                return self._send_json({"error": "URL non autorisee"}, 400)
            try:
                info = core.fetch_manga(url)
            except core.ScanError as exc:
                return self._send_json({"error": str(exc)}, 502)
            except Exception as exc:  # pragma: no cover
                return self._send_json({"error": "Erreur interne: %s" % exc}, 500)
            # si le manga a des chapitres pre-scrapes, on les prefere :
            # la liste est deja en base, inutile de re-parser la fiche.
            local = core.local_chapters(_manga_id(url))
            if local:
                info["chapters"] = local
                info["source"] = "local"
            return self._send_json(info)

        # /api/chapters?url=<url>  -> liste des chapitres
        if path == "/api/chapters":
            url = (query.get("url") or [""])[0]
            if not is_allowed_host(urllib.parse.urlparse(url).hostname):
                return self._send_json({"error": "URL non autorisee"}, 400)
            local = core.local_chapters(_manga_id(url))
            if local:
                return self._send_json({"chapters": local, "source": "local"})
            try:
                info = core.fetch_manga(url)
                return self._send_json({"chapters": info["chapters"],
                                        "source": "distant"})
            except core.ScanError as exc:
                return self._send_json({"error": str(exc)}, 502)
            except Exception as exc:  # pragma: no cover
                return self._send_json({"error": "Erreur interne: %s" % exc}, 500)

        # /api/pages?url=<url>  -> pages du chapitre (URLs d'images)
        if path == "/api/pages":
            url = (query.get("url") or [""])[0]
            if not is_allowed_host(urllib.parse.urlparse(url).hostname):
                return self._send_json({"error": "URL non autorisee"}, 400)
            try:
                pages = core.fetch_chapter_pages(url)
                return self._send_json({"pages": pages})
            except core.ScanError as exc:
                return self._send_json({"error": str(exc)}, 502)
            except Exception as exc:  # pragma: no cover
                return self._send_json({"error": "Erreur interne: %s" % exc}, 500)

        return super().do_GET()

    def _proxy_pageimg(self, query):
        """Proxy des images de page : /pageimg?u=<url>&r=<referer>."""
        url = (query.get("u") or [""])[0]
        referer = (query.get("r") or [SITE + "/"])[0]
        if not is_allowed_host(urllib.parse.urlparse(url).hostname):
            return self._send_text("URL non autorisee", 400)
        ctype = "image/jpeg"
        ext = os.path.splitext(urllib.parse.urlparse(url).path)[1].lower()
        if ext in (".png", ".webp", ".gif", ".avif", ".bmp"):
            ctype = "image/" + ext[1:]
        return self._proxy(url, ctype=ctype, cache_key="pageimg:" + url,
                           extra={"Access-Control-Allow-Origin": "*"},
                           referer=referer)

    def end_headers(self):
        # pas de cache sur index.html / app.js / styles.css
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()


def main():
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    srv.daemon_threads = True
    print("Scan-Manga Navigator  ->  http://localhost:%d" % PORT)
    print("Proxy images  : /img/<chemin>  ->  %s" % STATIC)
    print("Proxy pages   : /page/<chemin> ->  %s" % SITE)
    print("Ctrl+C pour arreter.")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nArret du serveur.")
    finally:
        srv.server_close()


if __name__ == "__main__":
    main()