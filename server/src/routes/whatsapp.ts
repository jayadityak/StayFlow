import { Router, Request, Response } from 'express';
import twilio from 'twilio';
import prisma from '../lib/prisma';
import { emitToHotel } from '../lib/sse';
import { processGuestMessage } from './guest';
import { translateToEnglish } from '../lib/translation';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

function getTwilioClient() {
  const sid    = process.env.TWILIO_ACCOUNT_SID;
  const token  = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return twilio(sid, token);
}

async function sendWhatsApp(to: string, body: string) {
  const client = getTwilioClient();
  if (!client) { console.warn('[whatsapp] Twilio not configured — TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN missing'); return; }
  const from = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';
  try {
    const msg = await client.messages.create({ from, to, body });
    console.log(`[whatsapp] sent to ${to} — sid=${msg.sid} status=${msg.status}`);
  } catch (err: any) {
    console.error(`[whatsapp] Twilio send failed to ${to}:`, err?.message || err);
    throw err;
  }
}

// Normalise phone: keep + and digits only
function normalisePhone(raw: string): string {
  return raw.replace(/[^\d+]/g, '');
}

async function processInbound(from: string, body: string) {
  const phone = normalisePhone(from.replace('whatsapp:', ''));
  console.log(`[whatsapp] inbound from=${from} phone=${phone} body="${body.slice(0, 80)}"`);

  try {
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
      console.log(`[whatsapp] no active session for phone=${phone}`);
      await sendWhatsApp(from, "Hi! We couldn't find an active booking for your number. Please contact the front desk to get set up. 🏨");
      return;
    }

    console.log(`[whatsapp] session found: guestName=${session.guestName} hotel=${session.hotel?.name} room=${session.room?.roomNumber}`);

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
      console.log(`[whatsapp] created conversation=${conversation.id}`);
    } else {
      console.log(`[whatsapp] existing conversation=${conversation.id}`);
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
    console.log(`[whatsapp] calling processGuestMessage...`);
    const result = await processGuestMessage(englishContent, session, conversation);
    console.log(`[whatsapp] AI response ready, action=${result.action || 'none'}`);

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
  } catch (err: any) {
    console.error(`[whatsapp] processInbound failed for from=${from}:`, err?.message || err);
    // Best-effort fallback — tell the guest something went wrong
    try {
      await sendWhatsApp(from, "Sorry, I ran into a technical issue. Please try again in a moment or contact the front desk. 🙏");
    } catch {
      // Ignore — don't want to mask the original error
    }
  }
}

// POST /api/whatsapp/webhook — Twilio sends inbound messages here
router.post('/webhook', (req: Request, res: Response) => {
  // Validate Twilio signature in production only
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (authToken && process.env.NODE_ENV === 'production') {
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
    processInbound(from, body); // errors handled internally with fallback reply
  } else {
    console.warn('[whatsapp] webhook received with missing From or Body', { from, body });
  }
});

// POST /api/whatsapp/send — send a WhatsApp message from the staff dashboard
router.post('/send', authenticate, async (req: AuthRequest, res: Response) => {
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
