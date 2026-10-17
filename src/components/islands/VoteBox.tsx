/**
 * Island: "What do you think?" on an idea page.
 *
 * The three answers are the page's own first "Talk about it" question, so the
 * vote is never a generic agree/disagree widget.
 *
 * The percentages shown are SAMPLE PILOT FIGURES and the component says so in
 * the interface, not just in a code comment. A real tally needs a database
 * behind the button (Cloudflare D1 + one on-demand route), which this static
 * build deliberately does not have yet.
 */
import { useEffect, useState } from "preact/hooks";
import { load, save } from "../../lib/storage";

type Choice = "yes" | "no" | "unsure";

interface Props {
  slug: string;
  question: string;
  sample: Record<Choice, number>;
}

const CHOICES: { key: Choice; label: string }[] = [
  { key: "yes", label: "Yes, I think so" },
  { key: "no", label: "No — and here's why" },
  { key: "unsure", label: "I'm not sure yet" },
];

export default function VoteBox({ slug, question, sample }: Props) {
  const [choice, setChoice] = useState<Choice | null>(null);

  useEffect(() => {
    setChoice(load<Choice | null>(`vote:${slug}`, null));
  }, [slug]);

  function vote(next: Choice) {
    setChoice(next);
    save(`vote:${slug}`, next);
  }

  return (
    <section class="vote">
      <p class="vote-label">What do you think?</p>
      <p class="vote-q">{question}</p>

      <div class="vote-btns">
        {CHOICES.map((c) => (
          <button
            class="vote-btn"
            type="button"
            aria-pressed={choice === c.key}
            key={c.key}
            onClick={() => vote(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {choice && (
        <div class="vote-results">
          <p class="vote-thanks">
            You said: {CHOICES.find((c) => c.key === choice)?.label}. You can change your mind.
          </p>

          {CHOICES.map((c) => (
            <div class="vbar" key={c.key}>
              <span style={`--w:${sample[c.key]}%`} />
              <i>{c.label}</i>
              <b>{sample[c.key]}%</b>
            </div>
          ))}

          <p class="vote-note">
            These numbers come from one class that read this page, not from everyone who visits.
          </p>
        </div>
      )}
    </section>
  );
}
