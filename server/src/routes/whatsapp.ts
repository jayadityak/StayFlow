import { Router, Request, Response } from 'express';
import twilio from 'twilio';
import prisma from '../lib/prisma';
import { emitToHotel } from '../lib/sse';
import { processGuestMessage } from './guest';
import { translateToEnglish } from '../lib/translation';

const router = Router();

function getTwilioClient() {
  const sid    = process.env.TWILIO_ACCOUNT_SID;
  const token  = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return twilio(sid, token);
}

async function sendWhatsApp(to: string, body: string) {
  const client = getTwilioClient();
  if (!client) { console.warn('[whatsapp] Twilio not configured'); return; }
  const from = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';
  await client.messages.create({ from, to, body });
}

// Normalise phone: keep + and digits only
function normalisePhone(raw: string): string {
  return raw.replace(/[^\d+]/g, '');
}

async function processInbound(from: string, body: string) {
  const phone = normalisePhone(from.replace('whatsapp:', ''));

  // Find active guest session by phone number
  const session = await prisma.guestSession.findFirst({
    where: {
      phone: { in: [phone, from.replace('whatsapp:', '')] },
      checkOutDate: { gte: new Date() },
    },
    include: {
      room: true,
      hotel: {
        include: { amenities: true, services: true, menuItems: { where: { isAvailable: true } } },
      },
    },
  });

  if (!session) {
    await sendWhatsApp(from, "Hi! We couldn't find an active booking for your number. Please contact the front desk to get set up. 🏨");
    return;
  }

  // Find or create active conversation
  let conversation = await prisma.conversation.findFirst({
    where: { guestSessionId: session.id, status: 'active' },
    include: { flowState: true },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        hotelId: session.hotelId,
        roomId: session.roomId,
        guestSessionId: session.id,
        status: 'active',
      },
      include: { flowState: true },
    });
  }

  // Translate to English for storage
  const lang = session.preferredLanguage || 'en';
  const englishContent = await translateToEnglish(body, lang);

  // Store guest message
  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderType: 'guest',
      content: body,
      englishContent,
      originalLanguage: lang,
      inputType: 'whatsapp',
    },
  });

  // Process through AI concierge
  const result = await processGuestMessage(englishContent, session, conversation);

  // Store AI response
  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderType: 'assistant',
      content: result.message,
      englishContent: result.englishMessage || result.message,
      originalLanguage: lang,
      inputType: 'whatsapp',
    },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { updatedAt: new Date() },
  });

  // Notify staff via SSE
  emitToHotel(session.hotelId, 'message_created', { conversationId: conversation.id });

  // Reply to guest on WhatsApp
  let replyText = result.message;
  if (result.buttons?.length) {
    const options = result.buttons.map((b, i) => `${i + 1}. ${b.label}`).join('\n');
    replyText = `${result.message}\n\n${options}`;
  }
  await sendWhatsApp(from, replyText);
}

// POST /api/whatsapp/webhook — Twilio sends inbound messages here
router.post('/webhook', (req: Request, res: Response) => {
  // Validate Twilio signature when configured
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (sid && authToken) {
    const signature = req.headers['x-twilio-signature'] as string;
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const valid = twilio.validateRequest(authToken, signature, url, req.body);
    if (!valid) {
      res.status(403).send('Forbidden');
      return;
    }
  }

  // Respond immediately — Twilio requires a response within 5 seconds
  res.set('Content-Type', 'text/xml');
  res.send('<Response></Response>');

  // Process async after responding
  const from = req.body.From as string;
  const body = req.body.Body as string;
  if (from && body) {
    processInbound(from, body).catch(err => console.error('[whatsapp]', err));
  }
});

// POST /api/whatsapp/send — send a WhatsApp message from the staff dashboard
router.post('/send', async (req: Request, res: Response) => {
  try {
    const { to, message } = req.body;
    if (!to || !message) return res.status(400).json({ error: 'to and message required' });
    await sendWhatsApp(to.startsWith('whatsapp:') ? to : `whatsapp:${to}`, message);
    return res.json({ success: true });
  } catch (err) {
    console.error('[whatsapp/send]', err);
    return res.status(500).json({ error: 'Failed to send message' });
  }
});

export default router;
