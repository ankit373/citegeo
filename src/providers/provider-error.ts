export type ProviderFailureCode =
  | "authentication"
  | "billing"
  | "rate_limited"
  | "timeout"
  | "upstream_unavailable"
  | "unsupported_capability"
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
