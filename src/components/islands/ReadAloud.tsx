/**
 * Island: read the page aloud.
 *
 * Uses the browser's own SpeechSynthesis — no service, no cost, works offline.
 * Hidden entirely where the API does not exist, rather than shown broken.
 */
import { useEffect, useState } from "preact/hooks";

export default function ReadAloud() {
  const [supported, setSupported] = useState(true);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => window.speechSynthesis?.cancel();
  }, []);

  if (!supported) return null;

  function toggle() {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    // Read the article only — not the navigation, the vote buttons or the
    // sidebar, which are furniture rather than the story.
    const main = document.querySelector("#main");
    if (!main) return;
    const text = (main.cloneNode(true) as HTMLElement);
    text.querySelectorAll(".crumbs, .sidebox, .vote-btns, .chart-note, .rp-note").forEach((n) => n.remove());

    const utterance = new SpeechSynthesisUtterance(text.textContent?.replace(/\s+/g, " ").trim() ?? "");
    utterance.rate = 0.92;
    utterance.onend = utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  }

  return (
    <button class="tool" type="button" aria-pressed={speaking} title="Read this page aloud" onClick={toggle}>
      {speaking ? "Stop" : "Listen"}
    </button>
  );
}
