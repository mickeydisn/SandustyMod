#!/usr/bin/env python3
"""Scrape les chapitres de N mangas du catalogue -> catalogue.db.

`catalogue.json` contient deja les fiches + metadata ; ce script y ajoute la
liste des chapitres *lisibles* (liens internes /lecture-en-ligne/).

Les chapitres "verrouilles" sont volontairement ignores : le site les pointe
vers des sites tiers (izneo, mangaplus, ono.live...) qui ne sont pas
lisibles sur scan-manga (ex. One Piece : 1202 blocs, 5 chapitres libres).

Cloudflare bloque le scraping : on passe par scanmanga_core (curl_cffi,
impersonation Chrome). `curl_cffi` n'est pas thread-safe, le noyau garde
donc une session par thread.

Usage :
    python3 scrape_chapters.py                    # 500 mangas
    python3 scrape_chapters.py --limit 50         # lot de test
    python3 scrape_chapters.py --workers 6
    python3 scrape_chapters.py --stats
    python3 scrape_chapters.py --manga /2336/19-Days.html   # une seule fiche
"""
import argparse
import json
import os
import re
import sqlite3
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import scanmanga_core as core

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DB = os.path.join(HERE, "catalogue.db")
DEFAULT_JSON = os.path.join(HERE, "catalogue.json")

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS chapters(
  id TEXT PRIMARY KEY, manga_id TEXT, title TEXT, url TEXT, num TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_ch_manga ON chapters(manga_id);
"""

_print_lock = threading.Lock()


def log(msg):
    with _print_lock:
        print(msg, flush=True)


def chapter_num(title, url):
    """Numero de chapitre lisible ('12'), sinon ''."""
    for src in (title or "", url or ""):
        m = re.search(r"chapitre[\s\-]*(\d+)", src, re.I)
        if m:
            return m.group(1)
    m = re.search(r"_(\d+)\.html", url or "")
    return m.group(1) if m else ""


def chapter_id(url):
    """Clef primaire : le chemin de l'URL (unique par chapitre)."""
    path = url.split("?", 1)[0].split("#", 1)[0]
    return path or url


def scrape_one(manga):
    """Retourne (manga_id, [chapitres]) pour une fiche, ou leve une exception."""
    info = core.fetch_manga(manga["url"])
    chaps = []
    seen = set()
    for c in info.get("chapters") or []:
        url = c.get("url") or ""
        if not url or "/lecture-en-ligne/" not in url:
            continue  # chapitre verrouille / externe : non lisible ici
        cid = chapter_id(url)
        if cid in seen:
            continue
        seen.add(cid)
        chaps.append({
            "id": cid,
            "manga_id": manga["id"],
            "title": (c.get("title") or "Chapitre").strip()[:160],
            "url": url,
            "num": chapter_num(c.get("title"), url),
        })
    return manga["id"], chaps



def load_catalogue(json_path):
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    items = data.get("items") if isinstance(data, dict) else data
    return items or []


def done_manga_ids(con):
    """Mangas deja scrappes (ont au moins un chapitre)."""
    try:
        rows = con.execute("SELECT DISTINCT manga_id FROM chapters").fetchall()
    except sqlite3.Error:
        return set()
    return {r[0] for r in rows if r[0]}


def main():
    ap = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--db", default=DEFAULT_DB)
    ap.add_argument("--json", dest="json_path", default=DEFAULT_JSON)
    ap.add_argument("--limit", type=int, default=500,
                    help="Nombre de mangas a scraper (0 = tous)")
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--delay", type=float, default=0.25,
                    help="Pause entre deux requetes (par worker)")
    ap.add_argument("--manga", default="", help="Scraper une seule fiche (id)")
    ap.add_argument("--force", action="store_true",
                    help="Re-scraper les fiches deja faites")
    ap.add_argument("--stats", action="store_true")
    args = ap.parse_args()

    con = sqlite3.connect(args.db)
    con.executescript(SCHEMA_SQL)

    if args.stats:
        n = con.execute("SELECT COUNT(*) FROM chapters").fetchone()[0]
        nm = con.execute(
            "SELECT COUNT(DISTINCT manga_id) FROM chapters").fetchone()[0]
        rows = con.execute(
            "SELECT manga_id, COUNT(*) c FROM chapters GROUP BY manga_id "
            "ORDER BY c DESC LIMIT 5").fetchall()
        last = con.execute(
            "SELECT at,source,count,status FROM sync_log ORDER BY id DESC LIMIT 3"
        ).fetchall()
        con.close()
        print("chapitres: %d | mangas couverts: %d" % (n, nm))
        print("top:", rows)
        print("syncs:", last)
        return

    items = load_catalogue(args.json_path)
    if args.manga:
        items = [m for m in items if m.get("id") == args.manga]
        if not items:
            print("Fiche introuvable : %s" % args.manga)
            sys.exit(1)
    else:
        if not args.force:
            done = done_manga_ids(con)
            items = [m for m in items if m.get("id") not in done]
        if args.limit:
            items = items[:args.limit]

    if not items:
        print("Rien a scraper (tout est deja fait).")
        con.close()
        return

    log("A scraper : %d fiches | %d workers | pause %.2fs"
        % (len(items), args.workers, args.delay))


    total_ch = 0
    ok = 0
    errors = []
    t0 = time.time()
    lock = threading.Lock()

    def worker(manga):
        mid, chaps = scrape_one(manga)
        if args.delay:
            time.sleep(args.delay)
        return mid, chaps

    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
        futures = {pool.submit(worker, m): m for m in items}
        for i, fut in enumerate(futures, 1):
            manga = futures[fut]
            try:
                mid, chaps = fut.result()
                with lock:
                    if chaps:
                        con.executemany(
                            "INSERT OR REPLACE INTO chapters"
                            "(id,manga_id,title,url,num) VALUES(?,?,?,?,?)",
                            [(c["id"], c["manga_id"], c["title"], c["url"], c["num"])
                             for c in chaps])
                        con.commit()
                    total_ch += len(chaps)
                    ok += 1
                log("[%4d/%4d] %-38s %4d ch" %
                    (i, len(items), manga.get("title", "")[:38], len(chaps)))
            except Exception as exc:
                with lock:
                    errors.append((manga.get("title", ""), str(exc)))
                log("[%4d/%4d] %-38s ERREUR %s" %
                    (i, len(items), manga.get("title", "")[:38], exc))

    con.execute("INSERT INTO sync_log(source,count,status) VALUES(?,?,?)",
                ("scrape_chapters", len(items),
                 "ok" if not errors else "partiel"))
    con.commit()
    n_total = con.execute("SELECT COUNT(*) FROM chapters").fetchone()[0]
    n_mangas = con.execute(
        "SELECT COUNT(DISTINCT manga_id) FROM chapters").fetchone()[0]
    con.close()

    print()
    print("Termine en %.1fs" % (time.time() - t0))
    print("Fiches OK : %d/%d | erreurs : %d" % (ok, len(items), len(errors)))
    print("Chapitres stocks : %d (total DB %d sur %d mangas)"
          % (total_ch, n_total, n_mangas))
    if errors:
        print("\nErreurs (%d) :" % len(errors))
        for title, msg in errors[:15]:
            print("  - %-36s %s" % (title[:36], msg))


if __name__ == "__main__":
    main()
