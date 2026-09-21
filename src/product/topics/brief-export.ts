import type { PromptBrief } from "./prompt-brief.js";

// A finding nobody can take out of the tool is a finding nobody acts on. This
// assembles what is already known into something that can be pasted into a
// ticket. It adds no advice: every line below is an observation.

function bullet(lines: string[]): string {
  return lines.map((line) => `- ${line}`).join("\n");
}

export function briefMarkdown(brief: PromptBrief): string {
  const out: string[] = [`# ${brief.text}`, "", brief.verdict, ""];

  out.push("## Where this stands", "");
  out.push(bullet([
    `${brief.answers} answer(s) archived, ${brief.appearances} of them named you.`,
    brief.contest.reason,
    brief.demand
      ? `Asked ${brief.demand.match.exactTerms} time(s) in the indexed corpus, ${brief.demand.match.relatedTerms} loosely. A historical sample, not live volume.`
      : "No corpus is indexed, so how often anyone asks this is unknown. That is not zero demand.",
    brief.namedBy.length ? `Named you: ${brief.namedBy.join(", ")}.` : `Not named by: ${brief.missedBy.join(", ")}.`,
    brief.namesYouElsewhere.length
      ? `These name you on other questions: ${brief.namesYouElsewhere.join(", ")}. The gap is this question, not the brand.`
      : "",
  ].filter(Boolean)), "");

  const rivals = brief.voices.filter((voice) => !voice.isTarget).slice(0, 5);
  if (rivals.length) {
    out.push("## What the models credited, in their own words", "");
    out.push("The standard this question is answered against. A model repeats what its sources say about a product.", "");
    for (const voice of rivals) {
      const spread = [`${voice.answers} answer(s)`, voice.positive ? `${voice.positive} recommended` : "", voice.negative ? `${voice.negative} warned against` : ""]
        .filter(Boolean).join(" · ");
      out.push(`### ${voice.name} — ${spread}`, "");
      out.push(voice.quotes.length ? bullet(voice.quotes.map((quote) => `"${quote}"`)) : "Named without a reason given.", "");
    }
  }

  const you = brief.voices.find((voice) => voice.isTarget);
  if (you && you.quotes.length) {
    out.push("## What they said about you", "", bullet(you.quotes.map((quote) => `"${quote}"`)), "");
  }

  out.push("## What these answers read", "");
  out.push(brief.sources.length
    ? bullet(brief.sources.slice(0, 12))
    : "These answers cited no source, so nothing here says which page to write. That is a property of the models that ran.", "");

  return `${out.join("\n").trim()}\n`;
}
