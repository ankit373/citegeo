export type ProviderFailureCode =
  | "authentication"
  | "billing"
  | "rate_limited"
  | "timeout"
  | "upstream_unavailable"
  | "unsupported_capability"
  | "model_unavailable"
  | "empty_answer"
  | "invalid_response"
  | "unknown";

export class ProviderRequestError extends Error {
  readonly code: ProviderFailureCode;
  readonly status: number | null;

  constructor(input: { code: ProviderFailureCode; message: string; status?: number | null | undefined; cause?: unknown }) {
    super(input.message, input.cause === undefined ? undefined : { cause: input.cause });
    this.name = "ProviderRequestError";
    this.code = input.code;
    this.status = input.status ?? null;
  }
}

const WITHDRAWN = ["unavailable for free", "no endpoints found for", "only available through the batch api"];

/** A model the provider will not serve on this account however often it is
 * asked. Retrying burns the run; the only lever is the model list. */
export function modelWithdrawn(message: string): boolean {
  const said = message.toLocaleLowerCase();
  for (const marker of WITHDRAWN) {
    if (said.indexOf(marker) >= 0) return true;
  }
  return false;
}

const SLUG_MARKER = "use this slug instead: ";

/** The replacement the provider named, so the fix is the slug rather than a
 * search. Absent when it only says no. */
export function replacementSlug(message: string): string | null {
  const at = message.indexOf(SLUG_MARKER);
  if (at < 0) return null;
  const rest = message.slice(at + SLUG_MARKER.length).trim();
  const end = rest.indexOf(" ");
  const slug = (end > 0 ? rest.slice(0, end) : rest).trim();
  return slug || null;
}

export function failureCodeForStatus(status: number): ProviderFailureCode {
  if (status === 401 || status === 403) return "authentication";
  if (status === 402) return "billing";
  if (status === 408) return "timeout";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "upstream_unavailable";
  if (status >= 400) return "invalid_response";
  return "unknown";
}

export function providerFailureCode(error: unknown): ProviderFailureCode {
  return error instanceof ProviderRequestError ? error.code : "unknown";
}

/** Parameters this will drop and ask again without. Both change how an answer
 * is sampled and neither changes what is being asked, so dropping is honest. */
export const DROPPABLE_PARAMETERS = new Set(["temperature", "top_p"]);

const UNSUPPORTED = "unsupported parameter: '";
const UNSUPPORTED_VALUE = "unsupported value: '";

/** The parameter a provider refused, taken from the field it reports it in and
 * otherwise read out of the message. A model list here would go stale. */
export function refusedParameter(error: { param?: unknown; message?: unknown } | null | undefined): string | null {
  if (!error) return null;
  if (typeof error.param === "string" && error.param) return error.param;
  const message = typeof error.message === "string" ? error.message.toLocaleLowerCase() : "";
  for (const marker of [UNSUPPORTED, UNSUPPORTED_VALUE]) {
    const start = message.indexOf(marker);
    if (start === -1) continue;
    const from = start + marker.length;
    const end = message.indexOf("'", from);
    if (end > from) return message.slice(from, end);
  }
  return null;
}
