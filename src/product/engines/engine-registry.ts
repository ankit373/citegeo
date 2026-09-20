import { waitFor, type BrowserEngine, type EngineId, type EngineOutcome } from "./browser-engine.js";
import type { CdpSession } from "./cdp-client.js";

// One adapter per surface. Page knowledge goes stale, so a selector that stops
// matching reports "unreadable" rather than an empty answer.

function jsonString(value: string): string {
  return JSON.stringify(value);
}

/** Reads a container, reporting which selector matched so a generic fallback
 * can be rejected rather than returned as an answer. */
function readerExpression(containerSelectors: string[], linkSelector: string): string {
  return `(() => {
    const selectors = ${JSON.stringify(containerSelectors)};
    for (const selector of selectors) {
      const node = document.querySelector(selector);
      if (!node) continue;
      const text = (node.innerText || "").trim();
      const links = Array.from(node.querySelectorAll(${jsonString(linkSelector)}))
        .map((anchor) => anchor.href)
        .filter((href) => typeof href === "string" && href.indexOf("http") === 0);
      return { selector: selector, text: text, links: Array.from(new Set(links)) };
    }
    return null;
  })()`;
}

interface ReadPayload {
  selector: string;
  text: string;
  links: string[];
}

/** A signed-out or interstitial page still renders text, so an answer is only
 * an answer when the surface's own container matched. */
async function readAnswer(input: {
  session: CdpSession;
  engineId: EngineId;
  expression: string;
  minimumLength: number;
  /** Matching one of these means the real answer container was found. */
  specificSelectors: string[];
}): Promise<EngineOutcome> {
  const payload = await input.session.evaluate<ReadPayload | null>(input.expression);
  if (!payload) {
    return { state: "unreadable", detail: "No answer container matched. The page has changed shape, so this engine needs updating." };
  }
  if (!input.specificSelectors.includes(payload.selector)) {
    return {
      state: "unreadable",
      detail: `Only the generic container "${payload.selector}" matched, so what was read is page furniture rather than an answer. Either the page changed or this browser is not signed in.`,
    };
  }
  if (payload.text.length < input.minimumLength) {
    return { state: "no_answer", detail: "The surface rendered no answer for this question." };
  }
  return {
    state: "answered",
    answer: { engineId: input.engineId, text: payload.text, citationUrls: payload.links, capturedAt: new Date().toISOString() },
  };
}

/** No overview for a query is a finding, not a failure: that is what a searcher
 * sees too. */
export const googleAiOverview: BrowserEngine = {
  id: "google-ai-overview",
  label: "Google AI Overview",
  caveat:
    "Read from a search results page in your own browser. Google shows an overview for some queries and not others, and personalises what it shows, so this is what your session saw rather than what everyone sees.",
  async ask(session, question) {
    const url = `https://www.google.com/search?q=${encodeURIComponent(question)}`;
    await session.send("Page.navigate", { url });
    const containers = ["[data-attrid='SGE']", "#rcnt [data-attrid='AIOverview']", "div[aria-label='AI Overview']"];
    const expression = readerExpression(containers, "a[href^='http']");
    // Overviews stream in after the page settles, so the wait is for content
    // rather than for a fixed delay.
    const appeared = await waitFor(session, `Boolean(${expression})`, 20000);
    if (!appeared) {
      return { state: "no_answer", detail: "No AI Overview appeared for this question, which is what a searcher would also see." };
    }
    return readAnswer({ session, engineId: "google-ai-overview", expression, minimumLength: 40, specificSelectors: containers });
  },
};

/** Also sold as an API, so the web answer and the API answer can be compared. */
export const perplexityWeb: BrowserEngine = {
  id: "perplexity-web",
  label: "Perplexity (web)",
  caveat: "Read from perplexity.ai in your own signed-in browser. The web app and the Sonar API do not always answer the same way.",
  async ask(session, question) {
    await session.send("Page.navigate", { url: `https://www.perplexity.ai/search?q=${encodeURIComponent(question)}` });
    // "main" is the fallback only so a miss can be reported as a miss; it is
    // not in specificSelectors, so page furniture never reads as an answer.
    const specific = ["[data-testid='answer']", "div.prose"];
    const expression = readerExpression([...specific, "main"], "a[href^='http']");
    await waitFor(session, `(() => { const found = ${expression}; return Boolean(found && found.links.length > 0 && found.text.length > 200); })()`, 45000);
    return readAnswer({ session, engineId: "perplexity-web", expression, minimumLength: 200, specificSelectors: specific });
  },
};


/** Copilot answers from Bing's index and cites as it goes, so a missing
 * citation list means the page changed rather than that it cited nothing. */
export const copilotWeb: BrowserEngine = {
  id: "copilot",
  label: "Microsoft Copilot",
  caveat: "Read from copilot.microsoft.com in your own signed-in browser. Copilot personalises by account and region, so this is what your session saw.",
  async ask(session, question) {
    await session.send("Page.navigate", { url: `https://copilot.microsoft.com/?q=${encodeURIComponent(question)}` });
    const specific = ["[data-content='ai-message']", "div[data-testid='message-content']", "cib-message-group"];
    const expression = readerExpression([...specific, "main"], "a[href^='http']");
    await waitFor(session, `(() => { const found = ${expression}; return Boolean(found && found.text.length > 200); })()`, 60000);
    return readAnswer({ session, engineId: "copilot", expression, minimumLength: 200, specificSelectors: specific });
  },
};

/** The product, not the API. It runs its own retrieval and routing, so its
 * answer and the API's answer to the same question are different measurements. */
export const chatgptWeb: BrowserEngine = {
  id: "chatgpt",
  label: "ChatGPT (web)",
  caveat: "Read from chatgpt.com in your own signed-in browser. The product and the API answer differently, because the product runs retrieval and model routing an API key does not expose.",
  async ask(session, question) {
    await session.send("Page.navigate", { url: `https://chatgpt.com/?q=${encodeURIComponent(question)}` });
    const specific = ["[data-message-author-role='assistant']", "div.markdown.prose"];
    const expression = readerExpression([...specific, "main"], "a[href^='http']");
    const settled = await waitFor(
      session,
      `(() => { const found = ${expression}; return Boolean(found && found.text.length > 200 && !document.querySelector("button[data-testid='stop-button']")); })()`,
      90000,
    );
    if (!settled) {
      // Reading a streaming answer captures half of it, which is worse than none.
      return { state: "no_answer", detail: "The answer did not finish streaming within the time allowed." };
    }
    return readAnswer({ session, engineId: "chatgpt", expression, minimumLength: 200, specificSelectors: specific });
  },
};

export const BROWSER_ENGINES: BrowserEngine[] = [googleAiOverview, perplexityWeb, chatgptWeb, copilotWeb];

export function browserEngine(id: string): BrowserEngine | undefined {
  return BROWSER_ENGINES.find((engine) => engine.id === id);
}
