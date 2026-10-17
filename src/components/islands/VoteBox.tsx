/**
 * Island: "What do you think?" on an idea page.
 *
 * There is no tally and no percentages. An earlier version showed bars with
 * sample figures from "a pilot class" — numbers that did not come from anywhere,
 * which is just a lie with decimal points. Counting answers would need a
 * database, and this site deliberately has no backend.
 *
 * So the interaction is honest and smaller: the reader picks an answer, it is
 * remembered on their own device, and they are invited to change their mind.
 * The question is the point; the count never was.
 */
import { useEffect, useState } from "preact/hooks";
import { load, save } from "../../lib/storage";

type Choice = "yes" | "no" | "unsure";

interface Props {
  slug: string;
  question: string;
}

const CHOICES: { key: Choice; label: string }[] = [
  { key: "yes", label: "Yes, I think so" },
  { key: "no", label: "No — and here's why" },
  { key: "unsure", label: "I'm not sure yet" },
];

export default function VoteBox({ slug, question }: Props) {
  const [choice, setChoice] = useState<Choice | null>(null);

  useEffect(() => {
    setChoice(load<Choice | null>(`vote:${slug}`, null));
  }, [slug]);

  function vote(next: Choice) {
    setChoice(next);
    save(`vote:${slug}`, next);
  }

  const chosen = CHOICES.find((c) => c.key === choice)?.label;

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
        <p class="vote-thanks" aria-live="polite">
          You said: {chosen}. You can change your mind — most philosophers did.
        </p>
      )}
    </section>
  );
}
