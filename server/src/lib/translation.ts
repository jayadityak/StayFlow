/**
 * Translation service — MVP implementation.
 *
 * Interface is designed so a real translation API (e.g. DeepL, Google Translate)
 * can be swapped in later without changing call sites.
 *
 * Current behaviour:
 *  - If sourceLanguage is 'en' (or missing), return text as-is.
 *  - Otherwise return a clearly-marked placeholder so staff know a translation
 *    is needed but the original content is never lost.
 *
 * To upgrade: replace the body of translateToEnglish with a real API call.
 * The signature must remain: (text: string, sourceLang: string) => Promise<string> | string
 */

const LANG_NAMES: Record<string, string> = {
  hi: 'Hindi',
  ar: 'Arabic',
  zh: 'Chinese',
  fr: 'French',
  de: 'German',
  es: 'Spanish',
  ru: 'Russian',
  ja: 'Japanese',
  ko: 'Korean',
  pt: 'Portuguese',
  it: 'Italian',
};

/**
 * Returns an English version of the text.
 * - If sourceLang is 'en' or absent, returns the original unchanged.
 * - Otherwise returns a placeholder that clearly marks it as needing
 *   translation, preserving the original text so nothing is lost.
 */
export function translateToEnglish(text: string, sourceLang: string): string {
  if (!sourceLang || sourceLang === 'en') return text;
  const langName = LANG_NAMES[sourceLang] || sourceLang.toUpperCase();
  return `[${langName} — translation pending] ${text}`;
}
