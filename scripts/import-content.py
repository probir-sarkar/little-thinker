#!/usr/bin/env python3
"""One-off importer: turns the prototype's content.py into Astro content
collection markdown + JSON data files.

Run once from the project root:  python3 scripts/import-content.py
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path.home() / "philosophy-for-kids"))
from content import BRANCHES, PHILOSOPHERS, CONCEPTS, WONDER_PROMPTS  # noqa: E402

CONTENT = ROOT / "src" / "content"
DATA = ROOT / "src" / "data"

# Maps a philosopher to the credited image file the image-sourcing pass downloads.
# The prototype's abstract symbol names -> concrete sprite ids.
SYMBOL_TO_ICON = {
    "spiral": "question", "gate": "door", "arch": "column", "leaf": "leaf",
    "star": "star", "lantern": "lantern", "dot": "mirror", "book": "scroll",
    "crowd": "speech",
}

HERO = {
    "socrates": ("socrates.jpg", "Marble bust of Socrates in the Louvre"),
    "confucius": ("confucius.jpg", "Traditional portrait of Confucius"),
    "plato": ("plato.jpg", "Marble bust of Plato"),
    "aristotle": ("aristotle.jpg", "Marble bust of Aristotle"),
    "hypatia": ("hypatia.jpg", "Hypatia of Alexandria in a 19th-century painting"),
    "ibn-sina": ("ibn-sina.jpg", "Medieval portrait of Ibn Sina (Avicenna)"),
    "descartes": ("descartes.jpg", "Portrait of René Descartes after Frans Hals"),
    "wollstonecraft": ("wollstonecraft.jpg", "Portrait of Mary Wollstonecraft by John Opie"),
    "arendt": ("arendt.jpg", "Photograph of Hannah Arendt"),
}


def inline(t: str) -> str:
    """Inline markdown -> HTML: **bold**, *italic*."""
    t = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", t)
    t = re.sub(r"\*([^*\n]+)\*", r"<em>\1</em>", t)
    return t


def years_to_ints(s: str):
    """'469-399 BCE' -> (-469, -399); '1596-1650' -> (1596, 1650)."""
    nums = [int(n) for n in re.findall(r"\d{3,4}", s)]
    if not nums:
        return None, None
    if len(nums) == 1:
        nums.append(nums[0])
    a, b = nums[0], nums[1]
    if "BCE" in s.upper():
        a, b = -a, -b
    return a, b


def yaml_scalar(v) -> str:
    """Emit a frontmatter-safe scalar."""
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    s = str(v).replace("\\", "\\\\").replace('"', '\\"')
    return f'"{s}"'


def yaml_list(items) -> str:
    return "\n".join(f"  - {yaml_scalar(i)}" for i in items)


def write(path: Path, front: dict, body: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = ["---"]
    for k, v in front.items():
        if isinstance(v, list):
            lines.append(f"{k}:")
            lines.append(yaml_list(v))
        elif v is None:
            continue
        else:
            lines.append(f"{k}: {yaml_scalar(v)}")
    lines.append("---")
    path.write_text("\n".join(lines) + "\n\n" + body.strip() + "\n")


def main():
    for p in PHILOSOPHERS:
        birth, death = years_to_ints(p["years"])
        img, alt = HERO.get(p["slug"], (None, None))
        front = {
            "name": p["name"],
            "monogram": p["monogram"],
            "icon": SYMBOL_TO_ICON[p["symbol"]],
            "years": p["years"],
            "birthYear": birth,
            "deathYear": death,
            "place": p["place"],
            "branch": p["branch"],
            "oneLiner": p["one_liner"],
            "bigQuestion": p["big_question"],
            "quote": p["quote"],
            "quoteNote": inline(p["quote_note"]),
            "heroImage": img,
            "heroImageAlt": alt,
            "facts": [inline(f) for f in p["facts"]],
            "activity": inline(p["activity"]),
        }
        write(CONTENT / "philosophers" / f"{p['slug']}.md", front, "\n\n".join(p["story"]))

    for c in CONCEPTS:
        lo, hi = [int(x) for x in c["ages"].replace("–", "-").split("-")]
        front = {
            "title": c["title"],
            "branch": c["branch"],
            "agesMin": lo,
            "agesMax": hi,
            "hook": c["hook"],
            "tryIt": inline(c["try"]),
            "talk": [inline(t) for t in c["talk"]],
            "related": c["related"],
        }
        write(CONTENT / "concepts" / f"{c['slug']}.md", front, "\n\n".join(c["body"]))

    DATA.mkdir(parents=True, exist_ok=True)
    (DATA / "branches.json").write_text(json.dumps(BRANCHES, ensure_ascii=False, indent=2))
    (DATA / "wonders.json").write_text(json.dumps(WONDER_PROMPTS, ensure_ascii=False, indent=2))
    print(f"imported {len(PHILOSOPHERS)} philosophers, {len(CONCEPTS)} concepts")


if __name__ == "__main__":
    main()
