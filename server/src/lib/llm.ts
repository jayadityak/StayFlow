import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface GuestContext {
  hotelName: string;
  guestName: string;
  roomNumber: string;
  lang: string;
  amenities: string[];   // e.g. ['Spa & Wellness', 'Gym', 'Swimming Pool']
  serviceTypes: string[]; // e.g. ['Housekeeping', 'Extra Towels', ...]
}

const LANG_NAMES: Record<string, string> = {
  en: 'English', hi: 'Hindi', ar: 'Arabic', zh: 'Chinese (Simplified)',
  fr: 'French', de: 'German', es: 'Spanish', ru: 'Russian',
  ja: 'Japanese', ko: 'Korean', pt: 'Portuguese', it: 'Italian',
};

function buildSystemPrompt(ctx: GuestContext): string {
  const langName = LANG_NAMES[ctx.lang] || 'English';
  return `You are the AI concierge assistant for ${ctx.hotelName}, a luxury hotel. \
You are speaking with ${ctx.guestName}, staying in room ${ctx.roomNumber}.

You can help guests with:
- Hotel services: ${ctx.serviceTypes.slice(0, 10).join(', ')} and more
- Amenity bookings: ${ctx.amenities.join(', ')}
- Food and beverage orders from the in-room menu
- General hotel information, local recommendations, and FAQs

Guidelines:
- Be warm, concise, and professional. Keep replies to 2–3 sentences max.
- If the guest needs a specific service, tell them to use the chat menu or that you'll raise the request for them — never promise things outside the hotel's scope.
- Do NOT make up amenities, prices, or services not listed above.
- Do NOT ask for personal, payment, or card details.
- Respond entirely in ${langName}. If the guest writes in another language, still reply in ${langName}.`;
}

export async function askClaudeForGuest(
  message: string,
  ctx: GuestContext
): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  try {
    const systemPrompt = buildSystemPrompt(ctx);

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: message }],
    });

    const block = response.content[0];
    if (block.type === 'text') return block.text.trim();
    return null;
  } catch (err) {
    console.error('[llm] Claude call failed:', err);
    return null;
  }
}
