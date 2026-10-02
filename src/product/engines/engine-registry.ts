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

/** A wall, not a banner: a sign-in phrase on a page too short to hold an
 * answer. Signing in and updating a selector are different repairs. */
const SIGNED_OUT = `(() => {
  const text = (document.body ? document.body.innerText : "").slice(0, 4000).toLowerCase();
  const prompts = ["sign in", "log in", "sign up", "create an account", "continue with google"];
  const hits = prompts.filter((phrase) => text.includes(phrase)).length;
  return hits > 0 && text.length < 2500;
})()`;

/** The container gets its grace first: a page three seconds old has rendered
 * nothing, and a prompt beside a real answer is a banner rather than a wall. */
async function signedOut(session: CdpSession, specificSelectors: string[], graceMs = 15000): Promise<boolean> {
  const present = `${JSON.stringify(specificSelectors)}.some((selector) => document.querySelector(selector))`;
  if (await waitFor(session, present, graceMs, 1000)) return false;
  return session.evaluate<boolean>(SIGNED_OUT).catch(() => false);
}

const SIGN_IN_OUTCOME: EngineOutcome = {
  state: "unavailable",
  detail: "This surface is asking the browser to sign in. Sign in to it in the browser you started, then run again. Nothing here will sign in for you.",
};

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
    if (await input.session.evaluate<boolean>(SIGNED_OUT).catch(() => false)) return SIGN_IN_OUTCOME;
    return {
      state: "unreadable",
      detail: `Only the generic container "${payload.selector}" matched, so what was read is page furniture rather than an answer. The page has changed and this engine needs updating.`,
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
  home: "https://www.google.com/",
  label: "Google AI Overview",
  caveat:
    "Read from a search results page in your own browser. Google shows an overview for some queries and not others, and personalises what it shows, so this is what your session saw rather than what everyone sees.",
  // An overview is written from the search result it sits on. There is no
  // version of it that answered without searching.
  grounding: "always",
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
  home: "https://www.perplexity.ai/",
  label: "Perplexity (web)",
  caveat: "Read from perplexity.ai in your own signed-in browser. Signed out it answers but renders no linked sources, so citations come back empty rather than wrong. The web app and the Sonar API do not always answer the same way.",
  // It searches for every question. Signed out the sources are not rendered,
  // which is a reading problem here and not the surface declining to search.
  grounding: "always",
  async ask(session, question) {
    await session.send("Page.navigate", { url: `https://www.perplexity.ai/search?q=${encodeURIComponent(question)}` });
    // "main" is the fallback only so a miss can be reported as a miss; it is
    // not in specificSelectors, so page furniture never reads as an answer.
    const specific = ["[data-testid='answer']", "div.prose"];
    if (await signedOut(session, specific)) return SIGN_IN_OUTCOME;
    const expression = readerExpression([...specific, "main"], "a[href^='http']");
    await waitFor(session, `(() => { const found = ${expression}; return Boolean(found && found.links.length > 0 && found.text.length > 200); })()`, 45000);
    return readAnswer({ session, engineId: "perplexity-web", expression, minimumLength: 200, specificSelectors: specific });
  },
};


const COMPOSER = "[contenteditable='true']";

/** Unchanged readings a second apart before a streaming answer is taken as
 * finished. One is not enough: the stream pauses while it is still writing. */
const STREAM_STABLE_POLLS = 4;

/** The editor is wired up a few seconds after it appears, so an insert is
 * retried. Four tries covers what was observed with room to spare. */
const TYPING_ATTEMPTS = 4;
const TYPING_WAIT_MS = 3000;

/** Finds the send control by its accessible name, which survives a class hash
 * changing on every deploy. */
const SEND_BUTTON = `(() => {
  const buttons = Array.from(document.querySelectorAll("button"));
  return buttons.find((button) => {
    const label = (button.getAttribute("aria-label") || "").toLowerCase();
    return label === "send" && button.getBoundingClientRect().width > 0 && !button.disabled;
  }) || null;
})()`;

/** Clears the editor so a retry cannot append to a half-taken attempt. */
async function clearComposer(session: CdpSession): Promise<void> {
  await session.evaluate(`(() => {
    const editor = document.querySelector(${jsonString(COMPOSER)});
    if (!editor) return;
    editor.focus();
    const range = document.createRange();
    range.selectNodeContents(editor);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  })()`);
  await session.send("Input.dispatchKeyEvent", { type: "keyDown", windowsVirtualKeyCode: 8, nativeVirtualKeyCode: 8, key: "Backspace", code: "Backspace" });
  await session.send("Input.dispatchKeyEvent", { type: "keyUp", windowsVirtualKeyCode: 8, nativeVirtualKeyCode: 8, key: "Backspace", code: "Backspace" });
}

/** Types the question in rather than putting it in the URL. Insertion goes
 * through the browser so the editor's own handling runs. */
async function askByTyping(session: CdpSession, question: string): Promise<boolean> {
  if (!await waitFor(session, `Boolean(document.querySelector(${jsonString(COMPOSER)}))`, 20000)) return false;
  // The send control only exists once the editor is holding text, so it is
  // the proof the editor took it rather than the markup merely showing it.
  const taken = `(() => {
    const editor = document.querySelector(${jsonString(COMPOSER)});
    const held = Boolean(editor) && (editor.innerText || "").indexOf(${jsonString(question)}) >= 0;
    return held && Boolean(${SEND_BUTTON});
  })()`;
  let ready = false;
  for (let attempt = 0; attempt < TYPING_ATTEMPTS && !ready; attempt += 1) {
    if (attempt > 0) await clearComposer(session);
    await session.evaluate(`document.querySelector(${jsonString(COMPOSER)}).focus()`);
    await session.send("Input.insertText", { text: question });
    ready = await waitFor(session, taken, TYPING_WAIT_MS);
  }
  if (!ready) return false;
  const sent = await session.evaluate<boolean>(`(() => { const button = ${SEND_BUTTON}; if (!button) return false; button.click(); return true; })()`);
  if (!sent) return false;
  // The posted question is the receipt. An empty one still gets an answer, and
  // archiving that would record a reply to a question nobody asked.
  return waitFor(session, `(() => {
    const asked = document.querySelector("[data-testid='chatQuestion']");
    return Boolean(asked) && (asked.innerText || "").indexOf(${jsonString(question)}) >= 0;
  })()`, 20000);
}

/** Copilot searches for every question and shows what it used, but lists each
 * source as a title and a domain with no link, so no page URL can be read. */
export const copilotWeb: BrowserEngine = {
  id: "copilot",
  home: "https://copilot.com/",
  label: "Microsoft Copilot",
  caveat: "Read from copilot.com in your own signed-in browser. It personalises by account and region, so this is what your session saw. It names its sources by domain without linking them, so citations come back empty rather than invented, and nothing here reports which page it read.",
  grounding: "always",
  async ask(session, question) {
    // The old host redirects and drops the question with it, so the deep link
    // that used to work now lands on an empty chat.
    await session.send("Page.navigate", { url: "https://copilot.com/" });
    const specific = ["[data-testid='markdown-reply']"];
    if (await signedOut(session, [COMPOSER], 20000)) return SIGN_IN_OUTCOME;
    if (!await askByTyping(session, question)) {
      return { state: "unreadable", detail: "The question could not be put to this surface: no composer or send control was found. The page has changed shape, so this engine needs updating." };
    }
    const expression = readerExpression([...specific, "main"], "a[href^='http']");
    // Waiting keys on the answer container alone. Including the fallback would
    // settle on the chat furniture, which is already past the length floor.
    const answerOnly = readerExpression(specific, "a[href^='http']");
    // Streaming pauses, so one unchanged reading is not a finished answer.
    // The length has to hold across several before it counts as settled.
    const settled = await waitFor(
      session,
      `(() => {
        const found = ${answerOnly};
        if (!found || found.text.length <= 200) return false;
        const same = window.__citegeoCopilotLength === found.text.length;
        window.__citegeoCopilotLength = found.text.length;
        window.__citegeoCopilotStable = same ? (window.__citegeoCopilotStable || 0) + 1 : 0;
        return window.__citegeoCopilotStable >= ${STREAM_STABLE_POLLS};
      })()`,
      90000,
      1000,
    );
    if (!settled) {
      const reached = await session.evaluate<number>(`(() => { const found = ${answerOnly}; return found ? found.text.length : 0; })()`).catch(() => 0);
      if (reached <= 200) return { state: "no_answer", detail: "This session produced no answer to read." };
      return { state: "no_answer", detail: "The answer was still being written when the time allowed ran out." };
    }
    return readAnswer({ session, engineId: "copilot", expression, minimumLength: 200, specificSelectors: specific });
  },
};

/** The product, not the API. It runs its own retrieval and routing, so its
 * answer and the API's answer to the same question are different measurements. */
export const chatgptWeb: BrowserEngine = {
  id: "chatgpt",
  home: "https://chatgpt.com/",
  label: "ChatGPT (web)",
  caveat: "Read from chatgpt.com in your own signed-in browser. The product and the API answer differently, because the product runs retrieval and model routing an API key does not expose.",
  // It decides per question whether to search, and often does not, so an
  // answer with no sources here is genuinely unknown rather than a nought.
  grounding: "per_question",
  async ask(session, question) {
    await session.send("Page.navigate", { url: `https://chatgpt.com/?q=${encodeURIComponent(question)}` });
    // The signed-out answer renders in a single article and carries none of
    // the attributes the signed-in transcript does, so both shapes are read.
    const specific = ["[data-message-author-role='assistant']", "div.markdown.prose", "article"];
    // The wall itself contains an article, so it cannot be the proof a
    // transcript exists. Only the two it never carries can be.
    if (await signedOut(session, specific.slice(0, 2))) return SIGN_IN_OUTCOME;
    const expression = readerExpression([...specific, "main"], "a[href^='http']");
    // The stop button's test id no longer exists, so a settled answer is one
    // whose length stopped changing rather than one with no button on screen.
    const settled = await waitFor(
      session,
      `(() => {
        const found = ${expression};
        if (!found || found.text.length <= 200) return false;
        const seen = window.__citegeoLastLength;
        window.__citegeoLastLength = found.text.length;
        return seen === found.text.length;
      })()`,
      90000,
    );
    if (!settled) {
      // Never starting and stopping halfway are different problems, and only
      // one of them is fixed by waiting longer.
      const reached = await session.evaluate<number>(`(() => { const found = ${expression}; return found ? found.text.length : 0; })()`).catch(() => 0);
      return reached > 200
        ? { state: "no_answer", detail: "The answer was still being written when the time allowed ran out." }
        : {
          state: "no_answer",
          detail: "This session never produced an answer to read. A signed-out session is rate limited and often returns nothing, so sign in to the browser this reads from.",
        };
    }
    return readAnswer({ session, engineId: "chatgpt", expression, minimumLength: 200, specificSelectors: specific });
  },
};

export const BROWSER_ENGINES: BrowserEngine[] = [googleAiOverview, perplexityWeb, chatgptWeb, copilotWeb];

export function browserEngine(id: string): BrowserEngine | undefined {
  return BROWSER_ENGINES.find((engine) => engine.id === id);
}
