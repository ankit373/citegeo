// Matched on whole tokens, not substrings: containment reports a brand called
// "Ten" as named by the word "often", quietly dropping a good prompt.

function isWordCharacter(character: string): boolean {
  const code = character.charCodeAt(0);
  const digit = code >= 48 && code <= 57;
  const lower = code >= 97 && code <= 122;
  const upper = code >= 65 && code <= 90;
  return digit || lower || upper;
}

/** Lowercase word tokens. Punctuation, spacing and dots all separate. */
export function tokenize(text: string): string[] {
  const tokens: string[] = [];
  let current = "";
  for (const character of text.toLocaleLowerCase()) {
    if (isWordCharacter(character)) {
      current += character;
      continue;
    }
    if (current) tokens.push(current);
    current = "";
  }
  if (current) tokens.push(current);
  return tokens;
}

function containsSequence(haystack: string[], needle: string[]): boolean {
  if (!needle.length || needle.length > haystack.length) return false;
  for (let start = 0; start <= haystack.length - needle.length; start += 1) {
    let matched = true;
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (haystack[start + offset] !== needle[offset]) {
        matched = false;
        break;
      }
    }
    if (matched) return true;
  }
  return false;
}

// Suffixes stripped from the end of a host. ".one" belongs here: without it
// tradomate.one reduced to the label "one" and every prompt containing the
// word "one" read as naming the brand.
const HOST_SUFFIXES = new Set([
  "com", "net", "org", "io", "ai", "co", "in", "uk", "us", "app", "dev", "so", "xyz", "one",
  "tech", "site", "online", "store", "cloud", "me", "tv", "gg", "sh", "fm", "to", "info", "biz",
  "au", "ca", "de", "fr", "es", "it", "nl", "jp", "kr", "cn", "br", "sg", "ae", "ch", "se", "pl",
]);

/** The label that distinguishes a host: "screener.in" and "www.screener.co.uk"
 * both reduce to "screener", because people name a brand without its suffix. */
export function domainLabel(domain: string): string {
  const parts = domain.trim().toLocaleLowerCase().split(".").filter(Boolean);
  while (parts.length && parts[0] === "www") parts.shift();
  // Only from the end, or a suffix-looking word inside the name is lost.
  while (parts.length > 1 && HOST_SUFFIXES.has(parts[parts.length - 1] || "")) parts.pop();
  const label = parts[parts.length - 1] || "";
  return tokenize(label).join(" ");
}

/** True when the text names any of these identities as whole words. */
export function namesIdentity(text: string, identities: string[]): boolean {
  const tokens = tokenize(text);
  for (const identity of identities) {
    const trimmed = identity.trim();
    if (!trimmed) continue;
    const needle = trimmed.includes(".") ? [domainLabel(trimmed)] : tokenize(trimmed);
    if (!needle.length || !needle[0]) continue;
    if (containsSequence(tokens, needle)) return true;
  }
  return false;
}
