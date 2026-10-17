/**
 * Island: reading settings (text size, calm mode, letter spacing).
 *
 * These exist because the audience spans a six-year-old and a grown-up reading
 * the same page. Values are written to the <html>/<body> attributes that the
 * stylesheet keys off, and remembered per device.
 */
import { useEffect, useState } from "preact/hooks";
import { load, save } from "../../lib/storage";

type Size = 0 | 1 | 2;

const LABELS: Record<Size, string> = { 0: "A", 1: "A+", 2: "A++" };

export default function ReadingSettings() {
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState<Size>(0);
  const [calm, setCalm] = useState(false);
  const [spaced, setSpaced] = useState(false);

  // Read stored preferences once on mount (SSR renders the defaults).
  useEffect(() => {
    setSize(load<Size>("size", 0));
    setCalm(load("calm", false));
    setSpaced(load("spaced", false));
  }, []);

  // Reflect them onto the document, which is what the CSS reacts to.
  useEffect(() => {
    document.documentElement.setAttribute("data-size", String(size));
    save("size", size);
  }, [size]);

  useEffect(() => {
    document.body.classList.toggle("calm", calm);
    save("calm", calm);
  }, [calm]);

  useEffect(() => {
    document.body.classList.toggle("spaced", spaced);
    save("spaced", spaced);
  }, [spaced]);

  return (
    <div class="reader-wrap">
      <button class="tool" type="button" aria-expanded={open} title="Text size, calm mode, letter spacing" onClick={() => setOpen((v) => !v)}>
        Aa
        <span class="sr-only">Reading settings</span>
      </button>

      {open && (
        <div class="reader-panel" role="group" aria-label="Reading settings">
          <p class="rp-title">Reading settings</p>

          <div class="rp-row">
            <span>Text size</span>
            <span class="rp-btns">
              {([0, 1, 2] as Size[]).map((n) => (
                <button
                  class="tool"
                  type="button"
                  aria-pressed={size === n}
                  data-size={n}
                  onClick={() => setSize(n)}
                >
                  {LABELS[n]}
                </button>
              ))}
            </span>
          </div>

          <div class="rp-row">
            <span>Calm mode</span>
            <button class="tool" type="button" aria-pressed={calm} onClick={() => setCalm((v) => !v)}>
              {calm ? "On" : "Off"}
            </button>
          </div>

          <div class="rp-row">
            <span>Wide letter spacing</span>
            <button class="tool" type="button" aria-pressed={spaced} onClick={() => setSpaced((v) => !v)}>
              {spaced ? "On" : "Off"}
            </button>
          </div>

          <p class="rp-note">Saved on this device. Nothing leaves it.</p>
        </div>
      )}
    </div>
  );
}
