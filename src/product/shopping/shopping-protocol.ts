import { sha256 } from "../../utils/hash.js";

type Schema = Record<string, unknown>;

export const SHOPPING_SCHEMA_NAME = "buying_answer";
export const SHOPPING_TOOL_DESCRIPTION = "Read which products, brands and retailers a buying answer actually named.";

const attribute: Schema = {
  type: "object",
  additionalProperties: false,
  required: ["field", "value"],
  properties: {
    field: { type: "string", description: "What the answer stated, such as price, plan, availability or rating." },
    value: { type: "string", description: "The value exactly as the answer stated it." },
  },
};

const product: Schema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "brand", "merchants", "attributes"],
  properties: {
    name: { type: "string", description: "The product as the answer named it." },
    brand: { type: ["string", "null"], description: "Whose product the answer said it is. Null when it did not say." },
    merchants: { type: "array", items: { type: "string" }, description: "Retailers the answer said it can be bought from. Empty when none." },
    attributes: { type: "array", items: attribute },
  },
};

export const shoppingResponseSchema: Schema = {
  type: "object",
  additionalProperties: false,
  required: ["analysisStatus", "intent", "products"],
  properties: {
    analysisStatus: { type: "string", enum: ["completed", "unreadable"] },
    intent: {
      type: ["string", "null"],
      enum: ["purchase", "compare", "price", "where_to_buy", null],
      description: "What the question was trying to do. Null when it was not a buying question.",
    },
    products: { type: "array", items: product },
  },
};

export const SHOPPING_SCHEMA_HASH = sha256(JSON.stringify(shoppingResponseSchema));

// An answer that stays generic is the finding, so inferring a product it did
// not name would erase exactly what is worth knowing.
const PROMPT_TEMPLATE = [
  "Read the buying answer below and record only what it actually named.",
  "A product counts when the answer names it as something to buy or compare. A category is not a product.",
  "Record the brand only where the answer attributes the product to one. Otherwise brand is null.",
  "Record a retailer only where the answer says the product can be bought there.",
  "Record an attribute only where the answer states it, using the answer's own value.",
  "Do not add a product, a brand, a retailer or a price the answer did not give. An answer that named nothing is a correct and useful result, and it is reported as an empty products list.",
  "Return analysisStatus unreadable only when the answer could not be read at all.",
  "Return only the requested JSON schema.",
].join("\n");

export const SHOPPING_PROMPT_HASH = sha256(PROMPT_TEMPLATE);

export function shoppingPrompt(input: { question: string; answer: string }): string {
  return [
    PROMPT_TEMPLATE,
    "",
    `Question: ${input.question}`,
    "",
    "Answer:",
    input.answer,
  ].join("\n");
}
