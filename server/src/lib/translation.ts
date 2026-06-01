const GOOGLE_TRANSLATE_URL = 'https://translation.googleapis.com/language/translate/v2';

const cache = new Map<string, string>();
const CACHE_MAX = 500;

function cacheKey(text: string, source: string, target: string): string {
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
      body: JSON.stringify({
        q: text,
        source,
        target,
        format: 'text',
      }),
    });

    if (!res.ok) {
      console.error(`Google Translate API error: ${res.status}`);
      return text;
    }

    const data = await res.json() as {
      data: { translations: Array<{ translatedText: string }> };
    };

    const translated = data.data.translations[0]?.translatedText ?? text;

    if (cache.size >= CACHE_MAX) {
      const firstKey = cache.keys().next().value;
      if (firstKey) cache.delete(firstKey);
    }
    cache.set(key, translated);

    return translated;
  } catch (err) {
    console.error('Google Translate call failed:', err);
    return text;
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
