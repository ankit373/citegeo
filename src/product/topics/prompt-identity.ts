// Whether a prompt names one of the brands being watched. The existing keyword
// check used plain substring containment, which reports a brand called "Ten" as
// named in "often". A prompt set is proposed to the user for review, so a false
// positive quietly removes a good prompt from the visibility numbers.
//
// Matching is therefore on whole tokens, not characters.

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

/**
 * A domain's distinguishing label: "screener.in" and "www.screener.co.uk" both
 * reduce to "screener". Matching the full host would miss a prompt that names
 * the brand without its suffix, which is how people actually write.
 */
export function domainLabel(domain: string): string {
  const tokens = tokenize(domain);
  const suffixes = new Set(["com", "net", "org", "io", "ai", "co", "in", "uk", "app", "dev", "so", "xyz"]);
  const meaningful = tokens.filter((token) => !suffixes.has(token) && token !== "www");
  return meaningful.length ? meaningful[meaningful.length - 1]! : (tokens[0] || "");
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
