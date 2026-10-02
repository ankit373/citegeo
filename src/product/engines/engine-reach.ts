import { listTargets, CdpSession, type CdpTarget } from "./cdp-client.js";
import { chooseTarget, DEFAULT_DEBUG_ENDPOINT, waitFor, type BrowserEngine } from "./browser-engine.js";

// Which surfaces this browser can actually drive, asked before a run rather
// than discovered by spending one. A surface that is gone, walled or blocked
// from here fails every question put to it, and the failures all look alike
// from the inside of a run.

/** Long enough for an application shell to render, short enough that checking
 * four surfaces is not a coffee break. */
export const REACH_TIMEOUT_MS = 12000;

export type Reach = "drivable" | "sign_in" | "blocked" | "unreachable";

export interface EngineReach {
  id: string;
  label: string;
  home: string;
  reach: Reach;
  /** What was seen, in words, so a verdict can be disagreed with. */
  detail: string;
  /** Where the browser ended up, which is how a block shows. */
  landedOn: string;
}

const SIGN_IN_WORDS = ["sign in", "log in", "sign up", "create an account", "continue with google", "请登录", "登录"];

/** Reads enough of the page to tell a wall from a shell. Nothing is asked and
 * nothing is typed, so this costs the surface one page load. */
const LOOK = `(() => {
  const body = document.body ? document.body.innerText : "";
  const lower = body.slice(0, 4000).toLocaleLowerCase();
  return {
    url: location.href,
    host: location.host,
    length: body.length,
    composer: document.querySelectorAll("textarea, [contenteditable='true']").length,
    signIn: ${JSON.stringify(SIGN_IN_WORDS)}.filter((word) => lower.includes(word)),
  };
})()`;

interface Look {
  url: string;
  host: string;
  length: number;
  composer: number;
  signIn: string[];
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

export function verdictFor(home: string, look: Look): { reach: Reach; detail: string } {
  if (!look.length) {
    return { reach: "unreachable", detail: "The page loaded nothing that can be read." };
  }
  // Sent somewhere else entirely. A surface that moves you to its own notice
  // is not one this browser can drive, whatever the notice says.
  if (hostOf(home) && look.host && hostOf(home) !== look.host) {
    return { reach: "blocked", detail: `Sent to ${look.host} instead, which is not the surface being checked.` };
  }
  if (look.signIn.length && look.length < 2500) {
    return { reach: "sign_in", detail: `Asking to sign in, and too short to be holding an answer. Saw: ${look.signIn.join(", ")}.` };
  }
  if (!look.composer) {
    return { reach: "unreachable", detail: "Loaded, with nothing on it to type a question into." };
  }
  return { reach: "drivable", detail: "Loaded with somewhere to type a question. Whether it answers is only known once one is asked." };
}

export const REACH_CAVEAT = "Each surface is loaded once and read, and nothing is asked of it. Drivable means there is somewhere to type a question, not that an answer will come back: a surface can take a question signed out and then decline to answer it.";

export async function probeReach(input: {
  engines: BrowserEngine[];
  endpoint?: string | undefined;
  attach?: ((target: CdpTarget) => Promise<CdpSession>) | undefined;
}): Promise<{ endpoint: string; engines: EngineReach[]; caveat: string }> {
  const endpoint = input.endpoint || DEFAULT_DEBUG_ENDPOINT;
  const results: EngineReach[] = [];
  let session: CdpSession | null = null;
  try {
    const target = chooseTarget(await listTargets(endpoint));
    if (!target) throw new Error(`The browser at ${endpoint} has no open tab to drive.`);
    session = await (input.attach ? input.attach(target) : CdpSession.attach(target));
    await session.send("Page.enable");
    await session.send("Runtime.enable");
    for (const engine of input.engines) {
      const shell = { id: engine.id, label: engine.label, home: engine.home };
      try {
        await session.send("Page.navigate", { url: engine.home });
        await waitFor(session, `Boolean(document.body && document.body.innerText.length > 0)`, REACH_TIMEOUT_MS, 500);
        const look = await session.evaluate<Look>(LOOK);
        results.push({ ...shell, ...verdictFor(engine.home, look), landedOn: look.url });
      } catch (error) {
        results.push({
          ...shell,
          reach: "unreachable",
          detail: error instanceof Error ? error.message : String(error),
          landedOn: "",
        });
      }
    }
  } finally {
    session?.close();
  }
  return { endpoint, engines: results, caveat: REACH_CAVEAT };
}
