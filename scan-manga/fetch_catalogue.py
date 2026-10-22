#!/usr/bin/env python3
"""Sauvegarde le catalogue scan-manga.com dans SQLite (+ export JSON pour l'app web).

Usage :
    python3 fetch_catalogue.py                  # fetch + save -> catalogue.db + catalogue.json
    python3 fetch_catalogue.py --search naruto  # cherche dans la DB locale (sans reseau)
    python3 fetch_catalogue.py --stats           # stats de la DB
    python3 fetch_catalogue.py --limit 50        # test rapide (n'entraine que 50 entrees)

Tables :
    mangas(id PK, site_id, slug, title, url, source, updated_at)
    sync_log(id, at, source, count, status)
Stdlib only (pas de pip install).
"""
import argparse
import html as ihtml
import json
import re
import sqlite3
import sys
import time
import urllib.parse
import urllib.request

BASE = "https://www.scan-manga.com"
JSON_URL = BASE + "/scanlation/scan.data.json"
LIST_URL = BASE + "/scanlation/liste_series.html"
DEFAULT_DB = "catalogue.db"
DEFAULT_JSON = "catalogue.json"

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
PROXIES = [
    ("direct", lambda u: u),
    ("corsproxy", lambda u: "https://corsproxy.io/?url=" + urllib.parse.quote(u, safe="")),
    ("allorigins", lambda u: "https://api.allorigins.win/raw?url=" + urllib.parse.quote(u, safe="")),
    ("codetabs", lambda u: "https://api.codetabs.com/v1/proxy?quest=" + urllib.parse.quote(u, safe="")),
]

SCHEMA = """
CREATE TABLE IF NOT EXISTS mangas(
  id TEXT PRIMARY KEY,
  site_id TEXT,
  slug TEXT,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  source TEXT DEFAULT '',
  updated_at TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_mangas_title ON mangas(title);
CREATE TABLE IF NOT EXISTS sync_log(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT DEFAULT (datetime('now')),
  source TEXT,
  count INTEGER,
  status TEXT
);
"""


def log(msg, verbose=True):
    if verbose:
        print(msg, flush=True)


def fetch_smart(url, timeout=30, verbose=True):
    """Essaie direct puis 3 proxies CORS. Leve RuntimeError si tout echoue."""
    last = None
    for name, wrap in PROXIES:
        try:
            req = urllib.request.Request(
                wrap(url),
                headers={"User-Agent": UA, "Accept": "*/*", "Referer": BASE + "/"},
            )
            with urllib.request.urlopen(req, timeout=timeout) as r:
                if r.status != 200:
                    raise RuntimeError("HTTP %s" % r.status)
                data = r.read().decode("utf-8", "replace")
            if len(data) < 200:
                raise RuntimeError("reponse vide")
            if "challenge-platform" in data or "Just a moment" in data:
                raise RuntimeError("challenge Cloudflare")
            log("  [ok] via %-10s (%d chars)" % (name, len(data)), verbose)
            return data, name
        except Exception as e:  # noqa: BLE001 - on veut tester le proxy suivant
            last = e
            log("  [ko] via %-10s : %s" % (name, e), verbose)
    raise RuntimeError("fetch impossible pour %s : %s" % (url, last))


def parse_json_catalogue(text):
    data = json.loads(text)
    out = []
    for raw_title, v in data.items():
        no_tags = re.sub(r"<[^>]+>", "", raw_title)
        clean = ihtml.unescape(no_tags).strip()
        if not clean:
            continue
        site_id = str(v[0]) if v else ""
        slug = (str(v[1]) if len(v) > 1 and v[1] else raw_title).strip()
        mid = "/%s/%s.html" % (site_id, slug)
        out.append({"id": mid, "site_id": site_id, "slug": slug,
                    "title": clean, "url": BASE + mid})
    return out


def parse_list_page(text):
    pat = r"<a[^>]+href=\"([^\"]+\.html[^\"]*)\"[^>]*>(.*?)</a>"
    links = re.findall(pat, text, re.S | re.I)
    seen = {}
    for href, inner in links:
        t = ihtml.unescape(re.sub(r"<[^>]+>", "", inner)).strip()
        t = re.sub(r"\s+", " ", t)
        if len(t) < 2 or len(t) > 120:
            continue
        if re.search(r"liste_series|index|contact|forum|parten", href, re.I):
            continue
        path = urllib.parse.urlparse(urllib.parse.urljoin(BASE, href)).path
        if not re.match(r"/\d+/", path) and "_" not in path:
            continue
        seen.setdefault(path, t)
    out = []
    for path, title in seen.items():
        parts = path.strip("/").split("/")
        slug = parts[1].rsplit(".html", 1)[0] if len(parts) > 1 else ""
        out.append({"id": path, "site_id": parts[0] if parts else "",
                    "slug": slug, "title": title, "url": BASE + path})
    return out


def fetch_jikan_top(n, verbose=True):
    """Top manga depuis Jikan (API MyAnimeList, gratuite, sans cle)."""
    out, page, per = [], 1, 25
    while len(out) < n:
        url = "https://api.jikan.moe/v4/top/manga?limit=%d&page=%d" % (per, page)
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=30) as r:
            payload = json.loads(r.read().decode("utf-8"))
        for e in payload.get("data", []):
            title = e.get("title_english") or e.get("title") or ""
            if not title:
                continue
            mid = "/jikan/%s.html" % e.get("mal_id", "")
            out.append({"id": mid, "site_id": "jikan",
                        "slug": str(e.get("mal_id", "")),
                        "title": title.strip(), "url": e.get("url", "")})
            if len(out) >= n:
                break
        log("   jikan page %d -> %d entrees" % (page, len(out)), verbose)
        page += 1
        if not payload.get("pagination", {}).get("has_next_page"):
            break
        time.sleep(1.5)
    return out[:n]


TOP100 = [
 ("One Piece", 9, "one_piece"), ("Naruto", 7, "naruto"),
 ("Bleach", 8, "bleach"), ("Dragon Ball", 5, "dragon_ball"),
 ("Attack on Titan", 21, "shingeki_no_kyojin"), ("Death Note", 11, "death_note"),
 ("Fullmetal Alchemist", 10, "fullmetal_alchemist"), ("Hunter x Hunter", 14, "hunter_x_hunter"),
 ("One Punch Man", 33, "one_punch_man"), ("My Hero Academia", 35, "my_hero_academia"),
 ("Demon Slayer", 42, "kimetsu_no_yaiba"), ("Jujutsu Kaisen", 47, "jujutsu_kaisen"),
 ("Tokyo Revengers", 50, "tokyo_revengers"), ("Chainsaw Man", 52, "chainsaw_man"),
 ("Spy x Family", 55, "spy_x_family"), ("Solo Leveling", 12, "solo_leveling"),
 ("Berserk", 6, "berserk"), ("Vagabond", 13, "vagabond"),
 ("Vinland Saga", 25, "vinland_saga"), ("Kingdom", 27, "kingdom"),
 ("Grand Blue", 40, "grand_blue"), ("Gintama", 15, "gintama"),
 ("Fairy Tail", 16, "fairy_tail"), ("Black Clover", 38, "black_clover"),
 ("Dr. Stone", 44, "dr_stone"), ("The Promised Neverland", 43, "yakusoku_no_neverland"),
 ("Haikyu!!", 30, "haikyu"), ("Kuroko no Basket", 22, "kuroko_no_basket"),
 ("Slam Dunk", 4, "slam_dunk"), ("Eyeshield 21", 3, "eyeshield_21"),
 ("One Outs", 17, "one_outs"), ("Hajime no Ippo", 2, "hajime_no_ippo"),
 ("Ashita no Joe", 1, "ashita_no_joe"), ("JoJo's Bizarre Adventure", 18, "jojo_bizarre_adventure"),
 ("Stardust Crusaders", 19, "jojo_stardust_crusaders"), ("Steel Ball Run", 20, "jojo_steel_ball_run"),
 ("Naruto Shippuden", 23, "naruto_shippuden"), ("Boruto", 39, "boruto"),
 ("Dragon Ball Super", 34, "dragon_ball_super"), ("Dragon Ball Z", 36, "dragon_ball_z"),
 ("Pokemon Adventures", 24, "pokemon_adventures"), ("Yu-Gi-Oh!", 26, "yu_gi_oh"),
 ("Shaman King", 28, "shaman_king"), ("Soul Eater", 29, "soul_eater"),
 ("Blue Exorcist", 31, "ao_no_exorcist"), ("Magi", 32, "magi"),
 ("Toriko", 37, "toriko"), ("Assassination Classroom", 41, "ansatsu_kyoshitsu"),
 ("Food Wars", 45, "shokugeki_no_soma"), ("Re:Zero", 46, "re_zero"),
 ("Sword Art Online", 48, "sword_art_online"), ("Overlord", 49, "overlord"),
 ("Mushoku Tensei", 51, "mushoku_tensei"), ("That Time I Got Reincarnated as a Slime", 53, "tensei_shitara_slime"),
 ("Konosuba", 54, "konosuba"), ("No Game No Life", 56, "no_game_no_life"),
 ("Tokyo Ghoul", 57, "tokyo_ghoul"), ("Tokyo Ghoul:re", 58, "tokyo_ghoul_re"),
 ("Parasyte", 59, "kiseiju"), ("Monster", 60, "monster"),
 ("20th Century Boys", 61, "20th_century_boys"), ("Pluto", 62, "pluto"),
 ("Vagabond Memories", 63, "vagabond_memories"), ("Blade of the Immortal", 64, "blade_of_the_immortal"),
 ("Dorohedoro", 65, "dorohedoro"), ("Made in Abyss", 66, "made_in_abyss"),
 ("Land of the Lustrous", 67, "houseki_no_kuni"), ("Beastars", 68, "beastars"),
 ("Dorohedoro 2", 69, "dorohedoro_2"), ("Fire Punch", 70, "fire_punch"),
 ("Goodnight Punpun", 71, "oyasumi_punpun"), ("Solanin", 72, "solanin"),
 ("Nana", 73, "nana"), ("Paradise Kiss", 74, "paradise_kiss"),
 ("Fruits Basket", 75, "fruits_basket"), ("Ouran High School Host Club", 76, "ouran_host_club"),
 ("Kimi ni Todoke", 77, "kimi_ni_todoke"), ("Ao Haru Ride", 78, "ao_haru_ride"),
 ("Your Lie in April", 79, "shigatsu_wa_kimi_no_uso"), ("Clannad", 80, "clannad"),
 ("Angel Beats", 81, "angel_beats"), ("Anohana", 82, "anohana"),
 ("Steins;Gate", 83, "steins_gate"), ("Erased", 84, "boku_dake_ga_inai_machi"),
 ("Psycho-Pass", 85, "psycho_pass"), ("Cowboy Bebop", 86, "cowboy_bebop"),
 ("Samurai Champloo", 87, "samurai_champloo"), ("Trigun", 88, "trigun"),
 ("Hellsing", 89, "hellsing"), ("Elfen Lied", 90, "elfen_lied"),
 ("Gantz", 91, "gantz"), ("Blame!", 92, "blame"),
 ("Akira", 93, "akira"), ("Ghost in the Shell", 94, "ghost_in_the_shell"),
 ("Neon Genesis Evangelion", 95, "evangelion"), ("Beck", 96, "beck"),
 ("Nodame Cantabile", 97, "nodame_cantabile"), ("Bakuman", 98, "bakuman"),
 ("Hikaru no Go", 99, "hikaru_no_go"), ("Prince of Tennis", 100, "prince_of_tennis"),
 ("Captain Tsubasa", 101, "captain_tsubasa"), ("Yona of the Dawn", 102, "akatsuki_no_yona"),
]


def build_top100():
    out = []
    for title, site_id, slug in TOP100:
        mid = "/%s/%s.html" % (site_id, slug)
        out.append({"id": mid, "site_id": str(site_id), "slug": slug,
                    "title": title, "url": BASE + mid})
    return out


def save_db(db_path, mangas, source):
    con = sqlite3.connect(db_path)
    con.executescript(SCHEMA)
    now = time.strftime("%Y-%m-%d %H:%M:%S")
    rows = [(m["id"], m["site_id"], m["slug"], m["title"], m["url"], source, now)
            for m in mangas]
    con.executemany(
        "INSERT OR REPLACE INTO mangas(id,site_id,slug,title,url,source,updated_at)"
        " VALUES(?,?,?,?,?,?,?)", rows)
    con.execute("INSERT INTO sync_log(source,count,status) VALUES(?,?,?)",
                (source, len(rows), "ok"))
    con.commit()
    total = con.execute("SELECT COUNT(*) FROM mangas").fetchone()[0]
    con.close()
    return total


def export_json(db_path, json_path):
    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row
    q = "SELECT id,title,url,site_id,slug FROM mangas ORDER BY title"
    rows = con.execute(q).fetchall()
    con.close()
    items = [dict(r) for r in rows]
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump({"count": len(items), "items": items}, f, ensure_ascii=False)
    return len(items)


def db_search(db_path, q, limit=30):
    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row
    rows = con.execute(
        "SELECT id,title,url FROM mangas WHERE title LIKE ? ORDER BY title LIMIT ?",
        ("%" + q + "%", limit)).fetchall()
    con.close()
    return [dict(r) for r in rows]


def db_stats(db_path):
    con = sqlite3.connect(db_path)
    n = con.execute("SELECT COUNT(*) FROM mangas").fetchone()[0]
    last = con.execute(
        "SELECT at,source,count FROM sync_log ORDER BY id DESC LIMIT 1").fetchone()
    con.close()
    return n, last


def main():
    ap = argparse.ArgumentParser(description="Catalogue scan-manga -> SQLite")
    ap.add_argument("--db", default=DEFAULT_DB)
    ap.add_argument("--json", default=DEFAULT_JSON)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--search", default="")
    ap.add_argument("--stats", action="store_true")
    ap.add_argument("--no-fetch", action="store_true")
    ap.add_argument("-q", "--quiet", action="store_true")
    ap.add_argument("--import-file", default="",
                    help="Importe un fichier sauve manuellement (JSON scan.data.json"
                         " ou HTML liste_series.html) au lieu de fetcher.")
    ap.add_argument("--add", default="",
                    help="Ajoute un manga : --add \"Titre|https://.../9/x.html\"")
    ap.add_argument("--seed-jikan", type=int, default=0, metavar="N",
                    help="Remplit avec N vrais mangas (top MyAnimeList via Jikan).")
    ap.add_argument("--seed-top100", action="store_true",
                    help="Remplit avec 100 vrais titres connus (offline, sans reseau).")
    a = ap.parse_args()
    v = not a.quiet
    if a.stats:
        n, last = db_stats(a.db)
        print("mangas: %d | last sync: %s" % (n, last))
        return
    if a.search:
        for r in db_search(a.db, a.search):
            print("%(title)s\n  %(url)s" % r)
        return
    if a.no_fetch:
        n = export_json(a.db, a.json)
        print("export %s (%d)" % (a.json, n))
        return
    if a.add:
        title, _, url = a.add.partition("|")
        title, url = title.strip(), url.strip()
        path = urllib.parse.urlparse(url).path or ("/" + title)
        m = {"id": path, "site_id": "", "slug": "",
             "title": title or path, "url": url or (BASE + path)}
        total = save_db(a.db, [m], "manuel")
        n = export_json(a.db, a.json)
        print("OK : ajoute '%s' | %d en DB | export %s (%d)"
              % (m["title"], total, a.json, n))
        return
    if a.seed_jikan:
        log("Seed Jikan : top %d ..." % a.seed_jikan, v)
        mangas = fetch_jikan_top(a.seed_jikan, verbose=v)
        total = save_db(a.db, mangas, "jikan-top")
        n = export_json(a.db, a.json)
        print("OK : %d seedes (Jikan) | %d en DB (%s) | export %s (%d)"
              % (len(mangas), total, a.db, a.json, n))
        return
    if a.seed_top100:
        mangas = build_top100()
        if a.limit:
            mangas = mangas[:a.limit]
        total = save_db(a.db, mangas, "top100-offline")
        n = export_json(a.db, a.json)
        print("OK : %d seedes (top100 offline) | %d en DB (%s) | export %s (%d)"
              % (len(mangas), total, a.db, a.json, n))
        return
    if a.import_file:
        with open(a.import_file, encoding="utf-8") as f:
            raw = f.read()
        if raw.lstrip().startswith("{"):
            mangas = parse_json_catalogue(raw)
            source = "import " + a.import_file
        else:
            mangas = parse_list_page(raw)
            source = "import " + a.import_file
        log("   -> %d entrees depuis %s" % (len(mangas), a.import_file), v)
        if a.limit:
            mangas = mangas[:a.limit]
        total = save_db(a.db, mangas, source)
        n = export_json(a.db, a.json)
        print("OK : %d importes | %d en DB (%s) | export %s (%d)"
              % (len(mangas), total, a.db, a.json, n))
        return
    mangas, source = [], ""
    try:
        log("1) scan.data.json ...", v)
        text, via = fetch_smart(JSON_URL, verbose=v)
        mangas = parse_json_catalogue(text)
        source = "scan.data.json via " + via
        log("   -> %d entrees" % len(mangas), v)
    except Exception as e:
        log("JSON echec (%s), repli liste_series.html ..." % e, v)
    if len(mangas) < 10:
        try:
            log("2) liste_series.html ...", v)
            text, via = fetch_smart(LIST_URL, verbose=v)
            mangas = parse_list_page(text)
            source = "liste_series.html via " + via
            log("   -> %d entrees" % len(mangas), v)
        except Exception as e2:
            log("Liste echec aussi (%s)." % e2, v)
    if a.limit:
        mangas = mangas[:a.limit]
    if not mangas:
        print("ECHEC : site bloque (Cloudflare : challenge + proxies HS).",
              file=sys.stderr)
        print("CONTOURNEMENT : ouvre la page dans ton navigateur (ca passe le",
              file=sys.stderr)
        print("challenge), sauvegarde-la (Cmd+S -> .html ou le JSON), puis :", file=sys.stderr)
        print("  python3 fetch_catalogue.py --import-file page.html", file=sys.stderr)
        print("  python3 fetch_catalogue.py --add \"One Piece|https://.../9/one_piece.html\"",
              file=sys.stderr)
        sys.exit(1)
    total = save_db(a.db, mangas, source)
    n = export_json(a.db, a.json)
    print("OK : %d fetch (%s) | %d en DB (%s) | export %s (%d)"
          % (len(mangas), source, total, a.db, a.json, n))


if __name__ == "__main__":
    main()



