import { expect, type Page } from "@playwright/test";

// The page's own shell asks Google for its fonts. Nothing else may leave the machine.
const THEME_FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

/** Aborts every request that is not for this machine and returns what else tried to leave.
 * The theme fonts are aborted and expected, so the page falls back to its stack. */
export async function loopbackOnly(page: Page): Promise<() => string[]> {
  const unexpected: string[] = [];
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "127.0.0.1" || url.hostname === "localhost") {
      await route.fallback();
      return;
    }
    if (!THEME_FONT_HOSTS.includes(url.hostname)) unexpected.push(route.request().url());
    await route.abort();
  });
  return () => [...unexpected];
}

export function expectNoOutbound(seen: () => string[]): void {
  expect(seen(), "requests that left the machine").toEqual([]);
}

const PROVIDER_KEYS = [
  "OPENROUTER_API_KEY", "OPENROUTER_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "PERPLEXITY_API_KEY",
  "DEEPSEEK_API_KEY", "OPENAI_COMPATIBLE_API_KEY", "AZURE_OPENAI_API_KEY", "WATSONX_API_KEY",
];

/** A fixture server must never reach a provider, whatever keys the developer's shell holds. */
export function withoutProviderKeys(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const kept = { ...env };
  for (const key of PROVIDER_KEYS) delete kept[key];
  return kept;
}
