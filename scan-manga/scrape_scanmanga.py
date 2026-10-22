#!/usr/bin/env python3
"""Scrape le VRAI catalogue scan-manga.com -> SQLite + catalogue.json.

Methode : curl_cffi (impersonation Chrome) contourne le challenge Cloudflare.
Pages TOP : TOP-Shonen-56, TOP-Seinen-13, TOP-Shojo-40, TOP-Manga-Webtoon-47, etc.
Entree : <div class="image_manga image_listing"><a name='RANK'></a>
         <a href="URL"><img data-original="COVER" title="TITLE">

Usage :
    python3 scrape_scanmanga.py --top TOP-Shonen-56            # 1 page (~30 mangas)
    python3 scrape_scanmanga.py --all-tops                      # toutes les pages TOP
    python3 scrape_scanmanga.py --all-tops --chapters           # + chapitres de chaque manga
    python3 scrape_scanmanga.py --stats / --search xxx
Requiert : pip install curl_cffi
"""
import argparse
import html as ihtml
import json
import re
import sqlite3
import sys
import time
import urllib.parse

BASE = "https://www.scan-manga.com"
DEFAULT_DB = "catalogue.db"
DEFAULT_JSON = "catalogue.json"

TOP_PAGES = [
    "TOP-Shonen-56", "TOP-Seinen-13", "TOP-Shojo-40", "TOP-Shojo-Ai-3",
    "TOP-Shonen-Ai-8", "TOP-Josei-28", "TOP-Ecchi-11", "TOP-Adulte-56",
    "TOP-Yaoi-110", "TOP-Yuri-34", "TOP-BD-7", "TOP-One-Shot-3",
    "TOP-Webcomics-14", "TOP-Manga-Webtoon-47", "TOP-Isekai-58",
    "TOP-Licencie-37", "TOP-Novel",
]

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS mangas(
  id TEXT PRIMARY KEY, site_id TEXT, slug TEXT, title TEXT NOT NULL,
  url TEXT NOT NULL, cover TEXT DEFAULT '', category TEXT DEFAULT '',
  genres TEXT DEFAULT '', status TEXT DEFAULT '', last_chapter TEXT DEFAULT '',
  rank INTEGER DEFAULT 0, source TEXT DEFAULT '', updated_at TEXT DEFAULT '',
  auteur TEXT DEFAULT '', annee TEXT DEFAULT '', editeur TEXT DEFAULT '',
  equipe TEXT DEFAULT '', description TEXT DEFAULT '', type TEXT DEFAULT '',
  note TEXT DEFAULT '', nb_votes TEXT DEFAULT '', popularite TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_mangas_title ON mangas(title);
CREATE TABLE IF NOT EXISTS chapters(
  id TEXT PRIMARY KEY, manga_id TEXT, title TEXT, url TEXT, num TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_ch_manga ON chapters(manga_id);
CREATE TABLE IF NOT EXISTS sync_log(
  id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT DEFAULT (datetime('now')),
  source TEXT, count INTEGER, status TEXT
);
"""



def get_session():
    from curl_cffi import requests as cr
    return cr.Session(impersonate="chrome124")


def fetch(sess, url, timeout=30):
    r = sess.get(url, timeout=timeout)
    if r.status_code != 200:
        raise RuntimeError("HTTP %s sur %s" % (r.status_code, url))
    if "Just a moment" in r.text or len(r.text) < 5000:
        raise RuntimeError("challenge/block sur %s" % url)
    return r.text


def clean(s):
    return ihtml.unescape(re.sub(r"<[^>]+>", "", s or "")).strip()


def parse_top(html, category):
    """Extrait les mangas d'une page TOP. Retourne [{id,title,url,...}]."""
    out = []
    blocks = re.findall(
        r'<div class="image_manga image_listing">(.*?)'
        r'<div class="fiche_technique folder_corner">(.*?)'
        r'(?=<div class="image_manga image_listing">|$)',
        html, re.S)
    for img_part, fiche in blocks:
        m_url = re.search(r"<a[^>]+href=\"([^\"]+)\"", img_part)
        m_rank = re.search(r"<a name='(\d+)'", img_part)
        m_img = re.search(r'data-original="([^"]+)"', img_part)
        m_title = re.search(r'title="([^"]+)"', img_part)
        if not m_url:
            continue
        url = m_url.group(1)
        if not url.startswith("http"):
            url = urllib.parse.urljoin(BASE, url)
        title = clean(m_title.group(1)) if m_title else url.rsplit("/", 1)[-1]
        path = urllib.parse.urlparse(url).path
        parts = [p for p in path.strip("/").split("/") if p]
        site_id = parts[0].split("-")[0] if parts else ""
        slug = parts[-1].rsplit(".html", 1)[0] if parts else ""
        m_cat = re.search(r"<li><strong>([^<]+)</strong>", fiche)
        genres = re.findall(r"</span>([^<]+)</a>", fiche)
        m_last = re.search(r"Dernier chapitre</li>.*?<li[^>]*>(.*?)</li>", fiche, re.S)
        m_stat = re.search(r"Statut</li>.*?<li[^>]*>(.*?)</li>", fiche, re.S)
        out.append({
            "id": path, "site_id": site_id, "slug": slug,
            "title": title or path, "url": url,
            "cover": m_img.group(1) if m_img else "",
            "category": clean(m_cat.group(1)) if m_cat else category,
            "genres": ", ".join(clean(g) for g in genres[:8]),
            "status": clean(m_stat.group(1)) if m_stat else "",
            "last_chapter": clean(m_last.group(1))[:80] if m_last else "",
            "rank": int(m_rank.group(1)) if m_rank else 0,
            # metadata champs remplis par parse_fiche
            "auteur": "", "annee": "", "editeur": "", "equipe": "",
            "description": "", "type": "", "note": "", "nb_votes": "", "popularite": "",
        })
    return out


def parse_fiche(html, manga_url):
    """Extraction metadata + chapitres d'une fiche manga.
    Retourne (meta_dict, chapters_list).
    """
    meta = {}
    chaps = []

    # --- Cover (itemprop="image") ---
    m_img = re.search(r'<img[^>]+itemprop="image"[^>]+src="([^\"]+)"', html)
    if m_img:
        meta["cover"] = m_img.group(1)

    # --- Description (meta description) ---
    m_desc = re.search(r'<meta[^>]+name="description"[^>]+content="([^\"]*)"', html)
    if m_desc:
        meta["description"] = ihtml.unescape(m_desc.group(1)).strip()[:2000]

    # --- Fiche technique : les 9 <li> de contenu_texte_fiche_technique ---
    m_block = re.search(
        r'<div class="contenu_texte_fiche_technique"><ul>(.*?)</ul></div>',
        html, re.S)
    if m_block:
        lis = re.findall(r"<li[^>]*>(.*?)</li>", m_block.group(1), re.S)

        # li 0 : Auteur/Artiste (itemprop="author")
        if len(lis) > 0:
            authors = re.findall(r"<a[^>]*>([^<]+)</a>", lis[0])
            if not authors:
                t = clean(lis[0])
                authors = [t] if t else []
            meta["auteur"] = ", ".join(authors)[:200]

        # li 1 : Categorie (itemprop="genre") ex: "Manhwa Shonen"
        if len(lis) > 1:
            cat_text = clean(lis[1])
            parts = cat_text.split()
            if parts:
                meta["categorie"] = parts[0]
                if len(parts) > 1:
                    meta["_cat_extra"] = " ".join(parts[1:])

        # li 2 : Genres (liens avec infoBulle)
        if len(lis) > 2:
            g_links = re.findall(
                r"<a[^>]*>(?:<span[^>]*>.*?</span>)?\s*([^<]+)\s*</a>",
                lis[2], re.S)
            genres = [clean(g) for g in g_links if clean(g)]
            if meta.get("_cat_extra"):
                genres.insert(0, meta["_cat_extra"])
            meta["genres"] = ", ".join(dict.fromkeys(genres))[:300]

        # li 3 : Annee
        if len(lis) > 3:
            m_year = re.search(r"(\d{4})", clean(lis[3]))
            if m_year:
                meta["annee"] = m_year.group(1)

        # li 4 : Editeur original (itemprop="publisher")
        if len(lis) > 4:
            meta["editeur"] = clean(lis[4])[:200]

        # li 5 : Dernier chapitre (lien ex: "Webtoon 3 Ch 217")
        if len(lis) > 5:
            ch_text = clean(lis[5])
            m_ch = re.search(r"^(.*?)\s+Ch\s*(\d+)", ch_text)
            if m_ch:
                meta["type"] = m_ch.group(1).strip()[:50]
                meta["last_chapter"] = "Ch %s" % m_ch.group(2)
            else:
                meta["last_chapter"] = ch_text[:80]

        # li 6 : Statut
        if len(lis) > 6:
            meta["status"] = clean(lis[6])[:50]

        # li 7 : Team (itemprop="translator") - noms des equipes de scan
        if len(lis) > 7:
            teams = re.findall(r"<a itemprop='name'[^>]*>([^<]+)</a>", lis[7])
            if not teams:
                teams = re.findall(r"<a[^>]*>([^<]+)</a>", lis[7])
            meta["equipe"] = ", ".join(teams)[:200]

        # li 8 : Popularite (ratingValue, ratingCount, UserLikes)
        if len(lis) > 8:
            m_rating = re.search(r'itemprop="ratingValue"[^>]+content="([^\"]+)"', lis[8])
            m_count = re.search(r'itemprop="ratingCount"[^>]+content="([^\"]+)"', lis[8])
            m_likes = re.search(r'content="UserLikes:(\d+)"', lis[8])
            pop = []
            if m_rating:
                meta["note"] = m_rating.group(1)
                pop.append("note %s/5" % m_rating.group(1))
            if m_count:
                meta["nb_votes"] = m_count.group(1)
                pop.append("%s votes" % m_count.group(1))
            if m_likes:
                pop.append("%s likes" % m_likes.group(1))
            meta["popularite"] = ", ".join(pop)

    # --- Chapitres ---
    for m in re.finditer(r'<div[^>]*\bchapitre_nom\b[^>]*>(.*?)</div>', html, re.S):
        block = m.group(1)
        a = re.search(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', block, re.S)
        if not a:
            continue
        href = a.group(1)
        if not href.startswith("http"):
            href = urllib.parse.urljoin(manga_url, href)
        title = clean(a.group(2)) or href
        path = urllib.parse.urlparse(href).path
        chaps.append({"id": path, "manga_id": "",
                      "title": title[:160], "url": href, "num": ""})

    meta.pop("_cat_extra", None)

    return meta, chaps


def save(db_path, mangas, chapters, source):
    con = sqlite3.connect(db_path)
    con.executescript(SCHEMA_SQL)
    # migrate old DBs (missing new columns)
    cols = [r[1] for r in con.execute("PRAGMA table_info(mangas)").fetchall()]
    for col, ddl in [
        ("cover", "ALTER TABLE mangas ADD COLUMN cover TEXT DEFAULT ''"),
        ("category", "ALTER TABLE mangas ADD COLUMN category TEXT DEFAULT ''"),
        ("genres", "ALTER TABLE mangas ADD COLUMN genres TEXT DEFAULT ''"),
        ("status", "ALTER TABLE mangas ADD COLUMN status TEXT DEFAULT ''"),
        ("last_chapter", "ALTER TABLE mangas ADD COLUMN last_chapter TEXT DEFAULT ''"),
        ("rank", "ALTER TABLE mangas ADD COLUMN rank INTEGER DEFAULT 0"),
        ("auteur", "ALTER TABLE mangas ADD COLUMN auteur TEXT DEFAULT ''"),
        ("annee", "ALTER TABLE mangas ADD COLUMN annee TEXT DEFAULT ''"),
        ("editeur", "ALTER TABLE mangas ADD COLUMN editeur TEXT DEFAULT ''"),
        ("equipe", "ALTER TABLE mangas ADD COLUMN equipe TEXT DEFAULT ''"),
        ("description", "ALTER TABLE mangas ADD COLUMN description TEXT DEFAULT ''"),
        ("type", "ALTER TABLE mangas ADD COLUMN type TEXT DEFAULT ''"),
        ("note", "ALTER TABLE mangas ADD COLUMN note TEXT DEFAULT ''"),
        ("nb_votes", "ALTER TABLE mangas ADD COLUMN nb_votes TEXT DEFAULT ''"),
        ("popularite", "ALTER TABLE mangas ADD COLUMN popularite TEXT DEFAULT ''"),
    ]:
        if col not in cols:
            con.execute(ddl)
    con.commit()

    now = time.strftime("%Y-%m-%d %H:%M:%S")
    con.executemany(
        "INSERT OR REPLACE INTO mangas(id,site_id,slug,title,url,cover,"
        "category,genres,status,last_chapter,rank,source,updated_at,"
        "auteur,annee,editeur,equipe,description,type,note,nb_votes,popularite)"
        " VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [(m["id"], m["site_id"], m["slug"], m["title"], m["url"],
          m.get("cover", ""), m.get("category", ""), m.get("genres", ""),
          m.get("status", ""), m.get("last_chapter", ""),
          m.get("rank", 0), source, now,
          m.get("auteur", ""), m.get("annee", ""), m.get("editeur", ""),
          m.get("equipe", ""), m.get("description", ""), m.get("type", ""),
          m.get("note", ""), m.get("nb_votes", ""), m.get("popularite", "")
         ) for m in mangas])
    if chapters:
        con.executemany(
            "INSERT OR REPLACE INTO chapters(id,manga_id,title,url,num)"
            " VALUES(?,?,?,?,?)",
            [(c["id"], c["manga_id"], c["title"], c["url"], c.get("num", ""))
             for c in chapters])
    con.execute("INSERT INTO sync_log(source,count,status) VALUES(?,?,?)",
                (source, len(mangas), "ok"))
    con.commit()
    total = con.execute("SELECT COUNT(*) FROM mangas").fetchone()[0]
    nch = con.execute("SELECT COUNT(*) FROM chapters").fetchone()[0]
    con.close()
    return total, nch


def export_json(db_path, json_path, limit=0):
    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row
    q = ("SELECT m.id,m.title,m.url,m.site_id,m.slug,m.cover,m.category,"
         "m.genres,m.status,m.last_chapter,m.rank,m.auteur,m.annee,m.editeur,"
         "m.equipe,m.description,m.type,m.note,m.nb_votes,m.popularite,"
         "(SELECT COUNT(*) FROM chapters c WHERE c.manga_id = m.id) AS nb_ch "
         "FROM mangas m ORDER BY m.rank, m.title")
    if limit:
        q += " LIMIT %d" % int(limit)
    rows = con.execute(q).fetchall()
    con.close()
    items = [dict(r) for r in rows]
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump({"count": len(items), "items": items}, f, ensure_ascii=False)
    return len(items)


def main():
    ap = argparse.ArgumentParser(description="Scrape scan-manga.com -> SQLite")
    ap.add_argument("--db", default=DEFAULT_DB)
    ap.add_argument("--json", default=DEFAULT_JSON)
    ap.add_argument("--top", default="",
                    help="Une page TOP (ex: TOP-Manga-Webtoon-47)")
    ap.add_argument("--all-tops", action="store_true")
    ap.add_argument("--chapters", action="store_true",
                    help="Scrape aussi les chapitres de chaque fiche")
    ap.add_argument("--delay", type=float, default=1.0)
    ap.add_argument("--search", default="")
    ap.add_argument("--stats", action="store_true")
    a = ap.parse_args()

    if a.stats:
        con = sqlite3.connect(a.db)
        n = con.execute("SELECT COUNT(*) FROM mangas").fetchone()[0]
        try:
            nch = con.execute("SELECT COUNT(*) FROM chapters").fetchone()[0]
        except Exception:
            nch = 0
        last = con.execute(
            "SELECT at,source,count FROM sync_log ORDER BY id DESC LIMIT 3"
        ).fetchall()
        con.close()
        print("mangas: %d | chapitres: %d | syncs: %s" % (n, nch, last))
        return
    if a.search:
        con = sqlite3.connect(a.db)
        con.row_factory = sqlite3.Row
        rows = con.execute(
            "SELECT title,url,category,rank FROM mangas WHERE title LIKE ?"
            " ORDER BY rank LIMIT 30",
            ("%" + a.search + "%",)).fetchall()
        con.close()
        for r in rows:
            print("[%s#%s] %s\n  %s" % (r["category"], r["rank"],
                                        r["title"], r["url"]))
        return

    pages = []
    if a.all_tops:
        pages = list(TOP_PAGES)
    elif a.top:
        pages = [a.top]
    else:
        print("Donne --top PAGE ou --all-tops (ex: --top TOP-Manga-Webtoon-47)")
        sys.exit(2)

    sess = get_session()
    all_m, all_c = [], []
    for pg in pages:
        url = "%s/%s.html" % (BASE, pg)
        print("TOP %s ..." % pg, flush=True)
        html = fetch(sess, url)
        ms = parse_top(html, pg)
        print("   -> %d mangas" % len(ms), flush=True)
        all_m.extend(ms)
        # fetch chaque fiche pour metadonnees (toujours) + chapitres si --chapters
        for m in ms:
            try:
                fh = fetch(sess, m["url"])
                meta, chs = parse_fiche(fh, m["url"])
                # fusion metadata dans le manga
                for k, v in meta.items():
                    m[k] = v
                if a.chapters:
                    for c in chs:
                        c["manga_id"] = m["id"]
                    all_c.extend(chs)
                    print("      %s : meta OK | %d chapitres"
                          % (m["title"][:40], len(chs)), flush=True)
                else:
                    print("      %s : meta OK" % m["title"][:40], flush=True)
            except Exception as e:
                print("      ! %s : %s" % (m["title"][:40], e), flush=True)
            time.sleep(a.delay)
        time.sleep(a.delay)

    seen, uniq = set(), []
    for m in all_m:
        if m["id"] not in seen:
            seen.add(m["id"])
            uniq.append(m)
    total, nch = save(a.db, uniq, all_c, "scrape:" + ",".join(pages))
    n = export_json(a.db, a.json)
    print("OK : %d scrapes (%d uniques) | DB %s : %d mangas, %d chapitres"
          " | export %s (%d)" % (len(all_m), len(uniq), a.db, total, nch,
                                 a.json, n))


if __name__ == "__main__":
    main()

