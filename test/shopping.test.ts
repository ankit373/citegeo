import test from "node:test";
import assert from "node:assert/strict";
import {
  SHOPPING_CAVEAT,
  merchantStandings,
  namedRate,
  parseProduct,
  parseShoppingAnswer,
  standings,
  type ShoppingAnswer,
} from "../src/product/shopping/shopping-schema.js";
import { shoppingPrompt, shoppingResponseSchema } from "../src/product/shopping/shopping-protocol.js";

function answer(products: Array<{ name: string; brand?: string | null; merchants?: string[] }>): ShoppingAnswer {
  return {
    answerId: "a", promptId: "q", promptText: "best screener to buy", intent: "purchase",
    modelId: "m", modelDisplayName: "M", namedAnyProduct: products.length > 0,
    products: products.map((row) => ({ name: row.name, brand: row.brand ?? null, merchants: row.merchants || [], attributes: [] })),
  };
}

test("a product with no name is not a mention", () => {
  assert.equal(parseProduct({ name: "   ", brand: "B" }), null);
  assert.equal(parseProduct({ brand: "B" }), null);
  assert.equal(parseProduct(null), null);
  assert.equal(parseProduct({ name: "Pro plan" })?.name, "Pro plan");
});

test("a brand the answer did not attribute stays null rather than guessed", () => {
  assert.equal(parseProduct({ name: "Pro plan" })?.brand, null);
  assert.equal(parseProduct({ name: "Pro plan", brand: "  " })?.brand, null);
  assert.equal(parseProduct({ name: "Pro plan", brand: "Acme" })?.brand, "Acme");
});

test("an attribute without both halves is dropped", () => {
  const parsed = parseProduct({ name: "P", attributes: [{ field: "price", value: "" }, { field: "", value: "9" }, { field: "price", value: "9" }] });
  assert.deepEqual(parsed?.attributes, [{ field: "price", value: "9" }]);
});

test("an answer that named nothing is a completed reading, not a failure", () => {
  const parsed = parseShoppingAnswer({ analysisStatus: "completed", intent: "purchase", products: [] });
  assert.equal(parsed.status, "completed");
  assert.deepEqual(parsed.products, []);
  assert.equal(parsed.intent, "purchase");
});

test("an unreadable answer yields nothing rather than an empty success", () => {
  assert.equal(parseShoppingAnswer({ analysisStatus: "unreadable", products: [{ name: "x" }] }).status, "unreadable");
  assert.equal(parseShoppingAnswer("nope").status, "unreadable");
});

test("an intent outside the four is not accepted as one of them", () => {
  assert.equal(parseShoppingAnswer({ analysisStatus: "completed", intent: "browsing", products: [] }).intent, null);
  assert.equal(parseShoppingAnswer({ analysisStatus: "completed", intent: "price", products: [] }).intent, "price");
});

test("a product named twice in one answer counts once for that answer", () => {
  const rows = [answer([{ name: "Pro" }, { name: "pro" }])];
  assert.equal(standings(rows, "Acme")[0]?.appearances, 1);
});

test("share is measured against the answers that named anything", () => {
  const rows = [answer([{ name: "A" }]), answer([{ name: "A" }]), answer([])];
  const [top] = standings(rows, "Acme");
  // Two of the two answers that named a product named A, so the share is 1.
  assert.equal(top?.appearances, 2);
  assert.equal(top?.shareOfAnswers, 1);
});

test("with nothing named at all a share is null rather than zero", () => {
  const rows = [answer([]), answer([])];
  assert.deepEqual(standings(rows, "Acme"), []);
  assert.equal(namedRate(rows, "Acme"), 0, "asked and never named is a real zero");
  assert.equal(namedRate([], "Acme"), null, "never asked is not zero");
});

test("the brand's own product is marked as the target, whatever the case", () => {
  const rows = [answer([{ name: "Pro", brand: "ACME" }, { name: "Rival", brand: "Other" }])];
  const found = standings(rows, "Acme");
  assert.equal(found.find((row) => row.name === "Pro")?.isTarget, true);
  assert.equal(found.find((row) => row.name === "Rival")?.isTarget, false);
});

test("a merchant is counted once per answer but keeps every product it carried", () => {
  const rows = [answer([{ name: "A", merchants: ["Shop"] }, { name: "B", merchants: ["Shop"] }])];
  const [shop] = merchantStandings(rows);
  assert.equal(shop?.appearances, 1, "one answer pointed at this merchant, not two");
  assert.deepEqual(shop?.products, ["A", "B"]);
});

test("merchants are ranked by how many answers pointed at them", () => {
  const rows = [answer([{ name: "A", merchants: ["Big"] }]), answer([{ name: "B", merchants: ["Big", "Small"] }])];
  assert.deepEqual(merchantStandings(rows).map((row) => row.name), ["Big", "Small"]);
});

test("the report states that it read words and not a shopping surface", () => {
  assert.ok(SHOPPING_CAVEAT.includes("not a reading of a shopping surface"));
  assert.ok(SHOPPING_CAVEAT.includes("under-counted"));
});

test("the prompt refuses to supply a product the answer did not name", () => {
  const prompt = shoppingPrompt({ question: "Q", answer: "A" });
  assert.ok(prompt.includes("Do not add a product"));
  assert.ok(prompt.includes("named nothing is a correct"), "a generic answer is the finding, not a miss");
  assert.ok(prompt.includes("A category is not a product"));
});

test("the schema allows a null intent, so a non-buying question can say so", () => {
  const intent = (shoppingResponseSchema as any).properties.intent;
  assert.ok(intent.type.includes("null"));
  assert.ok(intent.enum.includes(null));
});

test("a report says how much of the run it could actually read", async () => {
  const { ProductShoppingService } = await import("../src/product/shopping/shopping-service.js");
  const rows = [1, 2, 3].map((n) => ({
    id: `a${n}`, promptId: "q", promptText: "what should I buy", modelId: "m", modelDisplayName: "M",
    status: "completed", text: "an answer", createdAt: `2026-01-0${n}T00:00:00.000Z`,
  }));
  let saved: any = null;
  const service = new ProductShoppingService(
    { get: async () => ({ brandName: "Acme" }) } as any,
    { listAnswers: async () => rows } as any,
    { save: async (r: any) => { saved = r; }, load: async () => null } as any,
  );
  let call = 0;
  await service.run("p", async () => {
    call += 1;
    if (call === 1) throw new Error("provider refused");
    if (call === 2) return { analysisStatus: "completed", intent: null, products: [] };
    return { analysisStatus: "completed", intent: "purchase", products: [{ name: "Thing", brand: "Acme", merchants: [], attributes: [] }] };
  });
  assert.equal(saved.considered, 3, "three answers were put to a model");
  assert.equal(saved.unreadable, 1, "one failed and that has to be visible");
  assert.equal(saved.answers.length, 1, "one was not a buying question, so it is not a shopping answer");
  assert.equal(saved.namedRate, 1);
});
