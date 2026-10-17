/**
 * Island: the wonder wall.
 *
 * The seed questions are rendered by the server (they are static), and this
 * island adds the visitor's own on top — so the wall is never empty without
 * JavaScript. Added questions stay in localStorage.
 */
import { useEffect, useState } from "preact/hooks";
import { load, save } from "../../lib/storage";

interface SeededQuestion {
  q: string;
  a: string;
}

interface Props {
  seed: SeededQuestion[];
}

export default function WonderWall({ seed }: Props) {
  const [mine, setMine] = useState<string[]>([]);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setMine(load<string[]>("myWonders", []));
  }, []);

  function add(event: Event) {
    event.preventDefault();
    const question = draft.trim();
    if (!question) return;
    const updated = [question, ...mine].slice(0, 40);
    setMine(updated);
    save("myWonders", updated);
    setDraft("");
  }

  return (
    <>
      <form class="wonder-form" onSubmit={add}>
        <label for="wonder-input">What do you wonder about?</label>
        <div class="wf-row">
          <input
            id="wonder-input"
            type="text"
            maxlength={120}
            placeholder="Why do we have to sleep?"
            required
            value={draft}
            aria-describedby="wf-hint"
            onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
          />
          <button class="btn" type="submit">
            Put it on the wall
          </button>
        </div>
        <p class="wf-hint" id="wf-hint">
          Nothing is sent anywhere. No account, no name, no email, no tracking — your question is saved in this browser
          only.
        </p>
      </form>

      <div class="wall">
        {mine.map((q) => (
          <div class="wq mine" key={q}>
            {q}
            <small>Yours &middot; saved on this device</small>
          </div>
        ))}
        {seed.map((s) => (
          <div class="wq" key={s.q}>
            {s.q}
            <small>Sent in by {s.a}</small>
          </div>
        ))}
      </div>
    </>
  );
}
