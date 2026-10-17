/**
 * Island: theme picker.
 *
 * Because every colour, radius, shadow and font is a Tailwind theme token,
 * switching a theme is one attribute on <html>. Nothing re-renders, nothing
 * re-downloads: the variables change and the cascade does the rest.
 *
 * This exists as an experiment bench — the shipped default stays "ink".
 */
import { useEffect, useState } from "preact/hooks";
import { load, save } from "../../lib/storage";

export const THEMES = [
  { id: "ink", label: "Paper & ink", note: "the default: warm, editorial, quiet" },
  { id: "riso", label: "Risograph", note: "two flat inks, overprinted, misregistered" },
  { id: "bauhaus", label: "Bauhaus", note: "primaries, heavy rules, geometric sans" },
  { id: "botanic", label: "Field notebook", note: "sage and cream, ruled paper, plate labels" },
  { id: "chalk", label: "Chalkboard", note: "slate board, chalk lines, handwriting" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export default function ThemePicker({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<ThemeId>("ink");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // ?theme=riso lets the theme lab hand a full-page preview over in one click.
    const fromUrl = new URLSearchParams(window.location.search).get("theme");
    const valid = THEMES.some((t) => t.id === fromUrl);
    const stored = valid ? (fromUrl as ThemeId) : load<ThemeId>("theme", "ink");
    setTheme(stored);
    document.documentElement.dataset.theme = stored;
    if (valid) save("theme", stored);
  }, []);

  function choose(next: ThemeId) {
    setTheme(next);
    save("theme", next);
    document.documentElement.dataset.theme = next;
    setOpen(false);
  }

  return (
    <div class="reader-wrap">
      <button class="tool" type="button" aria-expanded={open} title="Change the visual theme" onClick={() => setOpen((v) => !v)}>
        Theme
        <span class="sr-only">: pick a visual theme</span>
      </button>

      {open && (
        <div class="reader-panel" role="group" aria-label="Theme">
          <p class="rp-title">Theme experiment</p>
          {THEMES.map((t) => (
            <div class="rp-row" key={t.id}>
              <span>
                {t.label}
                <br />
                <span class="text-[0.78rem] text-muted">{t.note}</span>
              </span>
              <button
                class="tool"
                type="button"
                aria-pressed={theme === t.id}
                onClick={() => choose(t.id)}
              >
                {theme === t.id ? "On" : "Try"}
              </button>
            </div>
          ))}
          {!compact && (
            <p class="rp-note">
              <a href="/theme-lab">See all five side by side &rarr;</a>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
