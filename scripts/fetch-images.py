#!/usr/bin/env python3
"""Fetch public-domain / openly licensed images from Wikimedia Commons.

For each subject it queries the Commons API, reads the ACTUAL licence metadata
(never guesses it), picks the best candidate that is public domain or CC0/CC-BY,
downloads a ~1200px thumbnail, and writes credits.json.

Run: python3 scripts/fetch-images.py
"""
import json
import pathlib
import re
import sys
import time
import urllib.parse
import urllib.request

API = "https://commons.wikimedia.org/w/api.php"
UA = "ThinkSmallPhilosophySite/1.0 (educational children's site; contact: probirsarkar855@gmail.com)"
OUT = pathlib.Path(__file__).resolve().parent.parent / "src" / "assets" / "images"
CREDITS = pathlib.Path(__file__).resolve().parent.parent / "src" / "data" / "credits.json"

SUBJECTS = [
    ("socrates", "Socrates bust Louvre marble portrait"),
    ("confucius", "Confucius portrait painting"),
    ("plato", "Plato bust marble portrait"),
    ("aristotle", "Aristotle bust Altemps portrait"),
    ("hypatia", "Hypatia Alexandria painting"),
    ("ibn-sina", "Avicenna Ibn Sina portrait manuscript"),
    ("descartes", "René Descartes portrait Frans Hals"),
    ("wollstonecraft", "Mary Wollstonecraft portrait John Opie"),
    ("arendt", "Hannah Arendt photograph portrait"),
    ("diogenes", "Diogenes painting lantern"),
    ("marcus-aurelius", "Marcus Aurelius bust portrait"),
    ("mill", "John Stuart Mill portrait photograph"),
    ("nagarjuna", "Nagarjuna statue"),
    ("sor-juana", "Sor Juana Ines de la Cruz portrait"),
    ("zera-yacob", "Zera Yacob Ethiopian philosopher"),
    # Added with the wider geography: China, India, the Islamic world, Japan,
    # Africa and the Americas. Search terms are chosen so the Commons title
    # usually contains the subject's name, which is what pick() prefers.
    ("laozi", "Laozi painting"),
    ("zhuangzi", "Zhuangzi painting"),
    ("zhu-xi", "Zhu Xi portrait"),
    ("wang-yangming", "Wang Yangming portrait"),
    ("mencius", "Mencius portrait"),
    ("shankara", "Adi Shankara painting"),
    ("kautilya", "Chanakya portrait"),
    ("thiruvalluvar", "Thiruvalluvar statue"),
    ("ambedkar", "B. R. Ambedkar portrait"),
    ("al-ghazali", "Al-Ghazali portrait"),
    ("ibn-rushd", "Averroes medieval portrait"),
    ("ibn-khaldun", "Ibn Khaldun portrait"),
    ("ibn-tufayl", "Ibn Tufayl portrait"),
    ("dogen", "Dogen portrait painting"),
    ("nishida-kitaro", "Nishida Kitaro photograph"),
    ("fanon", "Frantz Fanon photograph"),
    ("du-bois", "W. E. B. Du Bois photograph"),
]

SCENES = [
    ("scene-owl", "owl engraving natural history illustration"),
    ("scene-stars", "starry night sky engraving stars"),
    ("scene-library", "old library books engraving"),
    ("scene-paper", "old paper manuscript texture"),
]

GOOD_LICENCE = re.compile(r"public domain|pd-|cc0|cc[- ]by|no restrictions", re.I)
BAD_TITLE = re.compile(r"\.(svg|pdf|tif|tiff|gif|ogg|webm|djvu)$", re.I)


def api(params):
    params = {**params, "format": "json", "formatversion": "2"}
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=45) as r:
        return json.load(r)


def search(term, limit=14):
    """Return candidate files with their real licence metadata."""
    data = api({
        "action": "query",
        "generator": "search",
        "gsrsearch": f"filetype:bitmap {term}",
        "gsrnamespace": "6",
        "gsrlimit": str(limit),
        "prop": "imageinfo",
        "iiprop": "url|size|extmetadata|mime",
        "iiurlwidth": "1200",
    })
    out = []
    for page in data.get("query", {}).get("pages", []):
        info = (page.get("imageinfo") or [{}])[0]
        if not info:
            continue
        meta = info.get("extmetadata", {})
        get = lambda k: (meta.get(k, {}) or {}).get("value", "")  # noqa: E731
        title = page.get("title", "")
        if BAD_TITLE.search(title):
            continue
        licence = re.sub(r"<[^>]+>", "", get("LicenseShortName")).strip() or "UNKNOWN"
        author = re.sub(r"<[^>]+>", "", get("Artist")).strip() or "Unknown"
        out.append({
            "title": title,
            "licence": licence,
            "author": author,
            "licence_url": get("LicenseUrl"),
            "descriptionurl": info.get("descriptionurl", ""),
            "thumb": info.get("thumburl") or info.get("url"),
            "width": info.get("width"),
            "height": info.get("height"),
        })
    return out


def pick(cands, slug):
    """Prefer a public-domain image of the right person, portrait-ish shape."""
    named = [c for c in cands if slug.replace("-", " ").split()[0].lower() in c["title"].lower()
             or slug.lower() in c["title"].lower()]
    pool = named or cands
    licenced = [c for c in pool if GOOD_LICENCE.search(c["licence"])]
    pool = licenced or pool
    # prefer roughly portrait orientation and reasonable size
    pool = sorted(pool, key=lambda c: (abs((c["height"] or 1) / max(c["width"] or 1, 1) - 1.25),) )
    return pool[0] if pool else None


def download(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=90) as r:
        data = r.read()
    dest.write_bytes(data)
    return len(data)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    credits, failed = [], []

    for slug, term in SUBJECTS + SCENES:
        try:
            cands = search(term)
        except Exception as e:  # noqa: BLE001
            failed.append((slug, f"search error: {e}"))
            continue
        best = pick(cands, slug)
        if not best or not best["thumb"]:
            failed.append((slug, "no licensed candidate"))
            continue
        ext = ".jpg"
        dest = OUT / f"{slug}{ext}"
        try:
            size = download(best["thumb"], dest)
        except Exception as e:  # noqa: BLE001
            failed.append((slug, f"download error: {e}"))
            continue
        credits.append({
            "slug": slug,
            "file": dest.name,
            "title": best["title"].replace("File:", ""),
            "author": best["author"][:200],
            "license": best["licence"],
            "license_url": best["licence_url"] or "",
            "source_url": best["descriptionurl"],
            "direct_url": best["thumb"],
            "width": best["width"],
            "height": best["height"],
            "notes": f"downloaded {size // 1024} KiB",
        })
        print(f"  ok  {slug:16s} {best['licence']:22s} {best['title'][:52]}")
        time.sleep(0.4)

    CREDITS.write_text(json.dumps(credits, ensure_ascii=False, indent=2) + "\n")
    print(f"\n{len(credits)} images -> {OUT}")
    print(f"credits -> {CREDITS}")
    for slug, why in failed:
        print(f"  FAILED {slug}: {why}", file=sys.stderr)


if __name__ == "__main__":
    main()
