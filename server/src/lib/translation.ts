const GOOGLE_TRANSLATE_URL = 'https://translation.googleapis.com/language/translate/v2';

const cache = new Map<string, string>();
const CACHE_MAX = 500;

function cacheKey(text: string, source: string, target: string) {
  return `${source}:${target}:${text}`;
}

async function googleTranslate(text: string, source: string, target: string): Promise<string> {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!apiKey) return text;

  const key = cacheKey(text, source, target);
  const cached = cache.get(key);
  if (cached) return cached;

  try {
    const res = await fetch(`${GOOGLE_TRANSLATE_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text, source, target, format: 'text' }),
    });

    if (!res.ok) {
      console.error('Google Translate error:', res.status, await res.text());
      return text;
    }

    const data: any = await res.json();
    const translated = data.data?.translations?.[0]?.translatedText || text;

    if (cache.size >= CACHE_MAX) cache.clear();
    cache.set(key, translated);

    return translated;
  } catch (err) {
    console.error('Translation fetch failed:', err);
    return text;
  }
}

// Detect the language of a text using Google Translate's detection API.
// Returns a BCP-47-ish code like 'hi', 'ar', 'zh', etc. Falls back to 'en' on failure.
export async function detectLanguage(text: string): Promise<string> {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!apiKey) return 'en';
  try {
    const res = await fetch(
      `https://translation.googleapis.com/language/translate/v2/detect?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text }),
      },
    );
    if (!res.ok) return 'en';
    const data: any = await res.json();
    return data.data?.detections?.[0]?.[0]?.language ?? 'en';
  } catch {
    return 'en';
  }
}

export async function translateToEnglish(text: string, sourceLang: string): Promise<string> {
  if (!sourceLang || sourceLang === 'en') return text;
  return googleTranslate(text, sourceLang, 'en');
}

export async function translateFromEnglish(text: string, targetLang: string): Promise<string> {
  if (!targetLang || targetLang === 'en') return text;
  return googleTranslate(text, 'en', targetLang);
}
