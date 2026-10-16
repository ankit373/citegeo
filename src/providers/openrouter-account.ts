export interface OpenRouterAccountBalance {
  purchased: number;
  used: number;
  remaining: number;
  /** A key can carry a spending limit of its own, which pays for paid models
   * with no account credit behind it. Null when the key declares no limit. */
  keyRemaining: number | null;
  paidModelsRunnable: boolean;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function amount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function readJson(path: string, apiKey: string): Promise<Record<string, unknown> | null> {
  let response: Response;
  try {
    response = await fetch(`https://openrouter.ai/api/v1/${path}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;
  try {
    return asObject(asObject(await response.json())?.data);
  } catch {
    return null;
  }
}

// The catalog lists every hosted model whether or not the account can pay for
// one. Without this the first sign of an empty balance is an HTTP 402 part way
// through a run, repeated once per selected model.
export async function openRouterAccountBalance(apiKey: string): Promise<OpenRouterAccountBalance | null> {
  if (!apiKey.trim()) return null;
  // Credits alone said no to a key holding its own budget, and the product
  // then refused every paid model the key could in fact have run.
  const [data, key] = await Promise.all([readJson("credits", apiKey), readJson("key", apiKey)]);
  const purchased = amount(data?.total_credits);
  const used = amount(data?.total_usage);
  if (purchased === null || used === null) return null;
  const remaining = purchased - used;
  const keyRemaining = amount(key?.limit_remaining);
  return {
    purchased,
    used,
    remaining,
    keyRemaining,
    paidModelsRunnable: remaining > 0 || (keyRemaining !== null && keyRemaining > 0),
  };
}
