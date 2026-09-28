// What a buying answer named. This reads the text of an answer, not a shopping
// widget, and every figure here carries that limit with it.

export const SHOPPING_CAVEAT = "Measured from the words of an answer to a buying question, asked through a provider API. It is not a reading of a shopping surface inside any assistant, and an assistant that shows products in a panel rather than in prose will be under-counted here.";

export type BuyingIntent = "purchase" | "compare" | "price" | "where_to_buy";

export const BUYING_INTENTS: BuyingIntent[] = ["purchase", "compare", "price", "where_to_buy"];

export interface ProductMention {
  /** The product as the answer wrote it. */
  name: string;
  /** Whose product the answer said it is. Null when it did not say. */
  brand: string | null;
  /** A retailer the answer said it can be bought from. */
  merchants: string[];
  /** Attributes the answer stated, as it stated them. */
  attributes: Array<{ field: string; value: string }>;
}

export interface ShoppingAnswer {
  answerId: string;
  promptId: string;
  promptText: string;
  intent: BuyingIntent;
  modelId: string;
  modelDisplayName: string;
  /** False when the answer stayed generic and named no product at all. */
  namedAnyProduct: boolean;
  products: ProductMention[];
}

export interface ProductStanding {
  name: string;
  isTarget: boolean;
  /** Answers that named this product. */
  appearances: number;
  /** Null when nothing was named at all, which is not the same as zero share. */
  shareOfAnswers: number | null;
  merchants: string[];
}

export interface MerchantStanding {
  name: string;
  /** Answers that pointed a buyer at this merchant. */
  appearances: number;
  /** Products it was named as carrying. */
  products: string[];
}

export interface ShoppingReport {
  projectId: string;
  brandName: string;
  answers: ShoppingAnswer[];
  /** Answers to a buying question that named no product at all. */
  genericAnswers: number;
  /** Answers that were asked about and could not be read. A report built from
   * three of thirty answers must not read like one built from thirty. */
  unreadable: number;
  /** Answers considered before any were discarded. */
  considered: number;
  products: ProductStanding[];
  merchants: MerchantStanding[];
  /** Null when no buying question has a completed answer yet. */
  namedRate: number | null;
  caveat: string;
  checkedAt: string;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function intentOf(value: unknown): BuyingIntent | null {
  return BUYING_INTENTS.find((item) => item === value) || null;
}

function attributesOf(value: unknown): Array<{ field: string; value: string }> {
  if (!Array.isArray(value)) return [];
  const rows: Array<{ field: string; value: string }> = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const row = entry as Record<string, unknown>;
    const field = text(row.field);
    const stated = text(row.value);
    if (field && stated) rows.push({ field, value: stated });
  }
  return rows;
}

function stringsOf(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const rows: string[] = [];
  for (const entry of value) {
    const name = text(entry);
    if (name && !rows.includes(name)) rows.push(name);
  }
  return rows;
}

/** A product with no name is not a mention. It would count toward a share
 * without ever being something a reader could look up. */
export function parseProduct(value: unknown): ProductMention | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const name = text(row.name);
  if (!name) return null;
  return {
    name,
    brand: text(row.brand) || null,
    merchants: stringsOf(row.merchants),
    attributes: attributesOf(row.attributes),
  };
}

export interface ParsedShoppingAnswer {
  status: "completed" | "unreadable";
  intent: BuyingIntent | null;
  products: ProductMention[];
}

export function parseShoppingAnswer(value: unknown): ParsedShoppingAnswer {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { status: "unreadable", intent: null, products: [] };
  const row = value as Record<string, unknown>;
  if (row.analysisStatus !== "completed") return { status: "unreadable", intent: null, products: [] };
  const rows = Array.isArray(row.products) ? row.products : [];
  const products: ProductMention[] = [];
  for (const entry of rows) {
    const parsed = parseProduct(entry);
    if (parsed) products.push(parsed);
  }
  return { status: "completed", intent: intentOf(row.intent), products };
}

function matches(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

/** Ties share a place and the next place skips, so two products level on two
 * answers are both second and the next is fourth. */
export function standings(answers: ShoppingAnswer[], brandName: string): ProductStanding[] {
  const counted = answers.filter((row) => row.namedAnyProduct).length;
  const groups = new Map<string, { name: string; isTarget: boolean; appearances: number; merchants: string[] }>();
  for (const answer of answers) {
    const seen = new Set<string>();
    for (const product of answer.products) {
      const key = product.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const existing = groups.get(key) || {
        name: product.name,
        isTarget: Boolean(product.brand && matches(product.brand, brandName)),
        appearances: 0,
        merchants: [] as string[],
      };
      existing.appearances += 1;
      if (product.brand && matches(product.brand, brandName)) existing.isTarget = true;
      for (const merchant of product.merchants) {
        if (!existing.merchants.includes(merchant)) existing.merchants.push(merchant);
      }
      groups.set(key, existing);
    }
  }
  return [...groups.values()]
    .map((row) => ({ ...row, shareOfAnswers: counted ? row.appearances / counted : null }))
    .sort((left, right) => right.appearances - left.appearances);
}

export function merchantStandings(answers: ShoppingAnswer[]): MerchantStanding[] {
  const groups = new Map<string, MerchantStanding>();
  for (const answer of answers) {
    const seen = new Set<string>();
    for (const product of answer.products) {
      for (const merchant of product.merchants) {
        const key = merchant.toLowerCase();
        const existing = groups.get(key) || { name: merchant, appearances: 0, products: [] as string[] };
        if (!seen.has(key)) {
          existing.appearances += 1;
          seen.add(key);
        }
        if (!existing.products.includes(product.name)) existing.products.push(product.name);
        groups.set(key, existing);
      }
    }
  }
  return [...groups.values()].sort((left, right) => right.appearances - left.appearances);
}

/** Null rather than zero when no buying question was answered at all, because
 * nothing asked is not the same as asked and never named. */
export function namedRate(answers: ShoppingAnswer[], brandName: string): number | null {
  if (!answers.length) return null;
  const named = answers.filter((answer) => answer.products.some((product) => product.brand && matches(product.brand, brandName)));
  return named.length / answers.length;
}
