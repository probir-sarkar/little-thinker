import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { BRANCHES } from "../lib/site";

/** Search index, generated at build time from the content collections
 *  so it can never list a page that does not exist. */
export const GET: APIRoute = async () => {
  const philosophers = await getCollection("philosophers");
  const concepts = await getCollection("concepts");
  const stories = await getCollection("stories");

  const index = [
    ...philosophers.map((p) => ({
      t: p.data.name,
      u: `/philosophers/${p.id}`,
      k: "philosopher",
      s: `${p.data.years} · ${p.data.place}`,
      q: p.data.bigQuestion,
    })),
    ...concepts.map((c) => ({
      t: c.data.title,
      u: `/ideas/${c.id}`,
      k: "big idea",
      s: `${BRANCHES[c.data.branch].name} · ages ${c.data.agesMin}–${c.data.agesMax}`,
      q: c.data.hook,
    })),
    ...stories.map((s) => ({
      t: s.data.title,
      u: `/stories/${s.id}`,
      k: "story",
      s: s.data.sourceShort,
      q: s.data.ask,
    })),
    { t: "For grown-ups", u: "/grown-ups", k: "page", s: "The ten-minute ritual", q: "" },
    { t: "Stories", u: "/stories", k: "page", s: "Old tales with the question left open", q: "" },
    { t: "About", u: "/about", k: "page", s: "A library of questions, not answers", q: "" },
    { t: "Image credits", u: "/credits", k: "page", s: "Where the pictures come from", q: "" },
  ];

  return new Response(JSON.stringify(index), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
};
