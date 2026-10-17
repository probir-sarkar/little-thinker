/**
 * Island: the search palette ("Find").
 *
 * Fuzzy matching is delegated to Fuse.js rather than hand-rolled string
 * scoring; the index itself is generated at build time (src/pages/search.json.ts)
 * from the content collections, so it can never list a page that is gone.
 */
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import Fuse from "fuse.js";

interface Entry {
  t: string; // title
  u: string; // url
  k: string; // kind
  s: string; // subtitle
  q: string; // the question it answers
}

const KEYS = ["t", "s", "q", "k"];

export default function SearchPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const palette = useRef<HTMLDivElement>(null);

  // Closing hands focus back to the button that opened the palette, so the
  // keyboard user is not dropped at the top of the document.
  function close() {
    setOpen(false);
    button.current?.focus();
  }

  // Load the index only once the palette is first opened.
  useEffect(() => {
    if (!open || entries.length) return;
    fetch("/search.json")
      .then((r) => r.json())
      .then(setEntries)
      .catch(() => setEntries([]));
  }, [open, entries.length]);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  // Cmd/Ctrl+K, or "/" from anywhere on the page.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const typing = (e.target as HTMLElement)?.tagName === "INPUT";
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // The dialog is aria-modal, so Tab must cycle inside it.
  function trapTab(e: KeyboardEvent) {
    if (e.key !== "Tab" || !palette.current) return;
    const focusables = Array.from(
      palette.current.querySelectorAll<HTMLElement>("a[href], input, button"),
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  const fuse = useMemo(() => new Fuse(entries, { keys: KEYS, threshold: 0.38 }), [entries]);

  const results = useMemo(() => {
    const term = query.trim();
    const hits = term ? fuse.search(term).map((r) => r.item) : entries;
    return hits.slice(0, 8);
  }, [query, fuse, entries]);

  function onInputKey(e: KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[active]) {
      window.location.href = results[active].u;
    }
  }

  return (
    <>
      <button
        ref={button}
        class="tool"
        type="button"
        aria-expanded={open}
        aria-controls="palette"
        onClick={() => setOpen((v) => !v)}
        title="Search the site (press / or Ctrl-K)"
      >
        Find
      </button>

      {open && (
        <>
          <div class="palette-backdrop" onClick={close} aria-hidden="true" />
          <div
            id="palette"
            class="palette"
            role="dialog"
            aria-modal="true"
            aria-label="Search"
            ref={palette}
            onKeyDown={trapTab}
          >
            <input
              ref={input}
              type="search"
              placeholder="Type a name, or an idea…"
              autocomplete="off"
              value={query}
              aria-label="Search"
              aria-controls="palette-list"
              onInput={(e) => {
                setQuery((e.target as HTMLInputElement).value);
                setActive(0);
              }}
              onKeyDown={onInputKey}
            />
            <ul id="palette-list" class="palette-list">
              {results.map((r, i) => (
                <li key={r.u}>
                  <a href={r.u} class={i === active ? "is-active" : ""} onMouseEnter={() => setActive(i)}>
                    <span class="pk">{r.k}</span>
                    {r.t} — <em>{r.s}</em>
                  </a>
                </li>
              ))}
              {query.trim() !== "" && results.length === 0 && (
                <li class="palette-empty">Nothing matches “{query}”. Which is itself a good question.</li>
              )}
            </ul>
          </div>
        </>
      )}
    </>
  );
}
