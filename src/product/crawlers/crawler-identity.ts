// Which agent fetched a page, resolved from the user-agent string alone.
// Matching is substring based and case insensitive because this codebase bans
// regexes, and because every one of these tokens is a stable vendor identifier.

export type CrawlerPurpose = "training" | "search_index" | "live_fetch" | "unknown";

export interface CrawlerIdentity {
  /** Vendor-published bot name. */
  name: string;
  /** The answer engine that benefits from the fetch. */
  engine: string;
  purpose: CrawlerPurpose;
  token: string;
}

/**
 * Ordered most specific first, because several vendors ship overlapping tokens
 * (ChatGPT-User contains neither GPTBot nor OAI-SearchBot, but Claude-User and
 * ClaudeBot do share a prefix).
 */
export const KNOWN_CRAWLERS: CrawlerIdentity[] = [
  { token: "oai-searchbot", name: "OAI-SearchBot", engine: "ChatGPT", purpose: "search_index" },
  { token: "chatgpt-user", name: "ChatGPT-User", engine: "ChatGPT", purpose: "live_fetch" },
  { token: "gptbot", name: "GPTBot", engine: "ChatGPT", purpose: "training" },
  { token: "claude-searchbot", name: "Claude-SearchBot", engine: "Claude", purpose: "search_index" },
  { token: "claude-user", name: "Claude-User", engine: "Claude", purpose: "live_fetch" },
  { token: "claudebot", name: "ClaudeBot", engine: "Claude", purpose: "training" },
  { token: "anthropic-ai", name: "anthropic-ai", engine: "Claude", purpose: "training" },
  { token: "perplexity-user", name: "Perplexity-User", engine: "Perplexity", purpose: "live_fetch" },
  { token: "perplexitybot", name: "PerplexityBot", engine: "Perplexity", purpose: "search_index" },
  { token: "google-extended", name: "Google-Extended", engine: "Gemini", purpose: "training" },
  { token: "googleother", name: "GoogleOther", engine: "Google AI", purpose: "search_index" },
  { token: "applebot-extended", name: "Applebot-Extended", engine: "Apple Intelligence", purpose: "training" },
  { token: "applebot", name: "Applebot", engine: "Apple", purpose: "search_index" },
  { token: "meta-externalagent", name: "meta-externalagent", engine: "Meta AI", purpose: "training" },
  { token: "meta-externalfetcher", name: "meta-externalfetcher", engine: "Meta AI", purpose: "live_fetch" },
  { token: "bingbot", name: "bingbot", engine: "Copilot", purpose: "search_index" },
  { token: "ccbot", name: "CCBot", engine: "Common Crawl", purpose: "training" },
  { token: "bytespider", name: "Bytespider", engine: "Doubao", purpose: "training" },
  { token: "amazonbot", name: "Amazonbot", engine: "Alexa", purpose: "training" },
  { token: "youbot", name: "YouBot", engine: "You.com", purpose: "search_index" },
  { token: "mistralai-user", name: "MistralAI-User", engine: "Le Chat", purpose: "live_fetch" },
  { token: "cohere-ai", name: "cohere-ai", engine: "Cohere", purpose: "training" },
];

export function identifyCrawler(userAgent: string): CrawlerIdentity | null {
  const haystack = userAgent.toLocaleLowerCase();
  for (const crawler of KNOWN_CRAWLERS) {
    if (haystack.includes(crawler.token)) return crawler;
  }
  return null;
}

/**
 * A live fetch happens because someone asked a question right then, so it is
 * evidence of demand rather than of indexing.
 */
export function isLiveFetch(identity: CrawlerIdentity): boolean {
  return identity.purpose === "live_fetch";
}
