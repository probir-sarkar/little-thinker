/**
 * Island: the era / age filter chips on the two index pages.
 *
 * Why this shape: the cards themselves stay server-rendered, so the catalogue
 * is readable and crawlable with JavaScript off. The island owns only the
 * chip state and toggles a `hidden` attribute on the existing cards, rather
 * than re-rendering the grid (which would mean shipping the same markup twice).
 *
 * `data-*` attributes on the cards are the contract:
 *   data-era="ancient|medieval|modern"        (philosophers index)
 *   data-age="6"                              (ideas index, agesMin)
 */
import { useEffect, useState } from "preact/hooks";

type Kind = "era" | "ageBand";

interface Option {
  value: string;
  label: string;
}

interface Props {
  kind: Kind;
  options: Option[];
  /** Selector for the container holding the server-rendered cards. */
  target: string;
  /** Optional second selector whose direct children hide when all their cards are filtered out. */
  hideEmptyGroups?: string;
  ariaLabel: string;
}

const ALL = "all";

export default function FilterChips({ kind, options, target, hideEmptyGroups, ariaLabel }: Props) {
  const [active, setActive] = useState(ALL);

  useEffect(() => {
    const cards = Array.from(document.querySelectorAll<HTMLElement>(`${target} .card`));
    const matches = (card: HTMLElement) =>
      active === ALL ||
      (kind === "era"
        ? card.dataset.era === active
        : Number(card.dataset.age ?? 99) <= Number(active));

    let shown = 0;
    for (const card of cards) {
      const visible = matches(card);
      card.hidden = !visible;
      if (visible) shown++;
    }

    // A branch heading with no visible cards under it is noise.
    if (hideEmptyGroups) {
      for (const group of Array.from(document.querySelectorAll<HTMLElement>(hideEmptyGroups))) {
        group.hidden = !Array.from(group.querySelectorAll<HTMLElement>(".card")).some((c) => !c.hidden);
      }
    }

    const count = document.querySelector(`#${kind === "era" ? "p" : "c"}-count`);
    if (count) {
      count.textContent =
        kind === "era"
          ? `${shown} ${shown === 1 ? "philosopher" : "philosophers"} shown`
          : `${shown} of ${cards.length} ideas shown`;
    }
  }, [active, kind, target, hideEmptyGroups]);

  return (
    <div class="chips" role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          class={`chip${active === o.value ? " is-on" : ""}`}
          type="button"
          key={o.value}
          aria-pressed={active === o.value}
          onClick={() => setActive(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
