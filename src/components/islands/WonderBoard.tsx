/**
 * Island: "Today's wonder" on the home page.
 *
 * Rotates through the wonder prompts, and lets a reader commit to one for the
 * day. The commitment count is the whole point of the box: it turns a question
 * into something a child carries around with them.
 */
import { useEffect, useState } from "preact/hooks";
import { load, save } from "../../lib/storage";

interface Props {
  wonders: string[];
}

export default function WonderBoard({ wonders }: Props) {
  const [index, setIndex] = useState(0);
  const [taken, setTaken] = useState<number[]>([]);

  useEffect(() => {
    setIndex(load("wonderIndex", 0) % wonders.length);
    setTaken(load<number[]>("wondersTaken", []));
  }, [wonders.length]);

  const isTaken = taken.includes(index);

  function next() {
    const i = (index + 1) % wonders.length;
    setIndex(i);
    save("wonderIndex", i);
  }

  function toggleTaken() {
    const updated = isTaken ? taken.filter((n) => n !== index) : [...taken, index];
    setTaken(updated);
    save("wondersTaken", updated);
  }

  return (
    <aside class="board">
      <p class="board-label">Today&rsquo;s wonder</p>
      <p class="board-q">{wonders[index]}</p>

      <div class="board-actions">
        <button class="tool" type="button" onClick={next}>
          Another one
        </button>
        <label class="board-think">
          <input type="checkbox" checked={isTaken} onChange={toggleTaken} /> I&rsquo;ll think about this today
        </label>
      </div>

      <p class="board-count" aria-live="polite">
        {taken.length > 0 &&
          `You have taken on ${taken.length} wonder${taken.length > 1 ? "s" : ""}.`}
      </p>

      <div class="board-rule" aria-hidden="true" />
      <p class="board-note">
        A wonder is not a test. Nothing here has a right answer, and &ldquo;I don&rsquo;t know yet&rdquo; counts as an
        answer.
      </p>
    </aside>
  );
}
