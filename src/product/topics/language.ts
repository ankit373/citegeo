// A buyer who asks in German gets a German answer naming different companies.
// Measuring only English measures one slice of a market and calls it the market.

export interface AnswerLanguage {
  id: string;
  label: string;
  /** How the language is named to the model, in English, so the instruction parses. */
  endonymFreeName: string;
}

export const DEFAULT_LANGUAGE: AnswerLanguage = { id: "en", label: "English", endonymFreeName: "English" };

export const LANGUAGES: AnswerLanguage[] = [
  DEFAULT_LANGUAGE,
  { id: "de", label: "German", endonymFreeName: "German" },
  { id: "fr", label: "French", endonymFreeName: "French" },
  { id: "es", label: "Spanish", endonymFreeName: "Spanish" },
  { id: "pt", label: "Portuguese", endonymFreeName: "Portuguese" },
  { id: "it", label: "Italian", endonymFreeName: "Italian" },
  { id: "nl", label: "Dutch", endonymFreeName: "Dutch" },
  { id: "ja", label: "Japanese", endonymFreeName: "Japanese" },
  { id: "ko", label: "Korean", endonymFreeName: "Korean" },
  { id: "zh", label: "Chinese", endonymFreeName: "Chinese" },
  { id: "hi", label: "Hindi", endonymFreeName: "Hindi" },
  { id: "ar", label: "Arabic", endonymFreeName: "Arabic" },
  { id: "id", label: "Indonesian", endonymFreeName: "Indonesian" },
  { id: "pl", label: "Polish", endonymFreeName: "Polish" },
  { id: "tr", label: "Turkish", endonymFreeName: "Turkish" },
  { id: "ru", label: "Russian", endonymFreeName: "Russian" },
  { id: "sv", label: "Swedish", endonymFreeName: "Swedish" },
  { id: "vi", label: "Vietnamese", endonymFreeName: "Vietnamese" },
  { id: "th", label: "Thai", endonymFreeName: "Thai" },
  { id: "he", label: "Hebrew", endonymFreeName: "Hebrew" },
];

export function language(id: string): AnswerLanguage | undefined {
  return LANGUAGES.find((row) => row.id === id);
}

/**
 * The answer is written in the buyer's language; the structured fields stay in
 * English. Translating the enums would break parsing, and translating a company
 * name would invent a second entity for one brand.
 */
export function languageInstruction(row: AnswerLanguage): string {
  if (row.id === DEFAULT_LANGUAGE.id) return "Use English for all string values.";
  return `Write the answer in ${row.endonymFreeName}, as you would for a ${row.endonymFreeName} speaker. Keep every other field in English, and keep company names exactly as they are normally written.`;
}

/** The language a market reads in by default, taken from its locale. */
export function languageForLocale(locale: string): AnswerLanguage {
  const base = locale.split("-")[0] || "";
  return language(base) || DEFAULT_LANGUAGE;
}
