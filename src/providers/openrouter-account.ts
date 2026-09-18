export interface OpenRouterAccountBalance {
  purchased: number;
  used: number;
  remaining: number;
  paidModelsRunnable: boolean;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function amount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

// The catalog lists every hosted model whether or not the account can pay for
// one. Without this the first sign of an empty balance is an HTTP 402 part way
// through a run, repeated once per selected model.
export async function openRouterAccountBalance(apiKey: string): Promise<OpenRouterAccountBalance | null> {
  if (!apiKey.trim()) return null;
  let response: Response;
  try {
    response = await fetch("https://openrouter.ai/api/v1/credits", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return null;
  }
  const data = asObject(asObject(payload)?.data);
  const purchased = amount(data?.total_credits);
  const used = amount(data?.total_usage);
  if (purchased === null || used === null) return null;
  const remaining = purchased - used;
  return { purchased, used, remaining, paidModelsRunnable: remaining > 0 };
}
