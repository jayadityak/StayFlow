import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { format, addDays, setHours, setMinutes, setSeconds, startOfDay } from 'date-fns';
import prisma from '../lib/prisma';
import { isSessionActive } from '../lib/checkoutUtils';
import { T, TEN } from '../lib/i18n';
import { translateToEnglish } from '../lib/translation';
import { emitToHotel, addGuestSSEClient, emitToConversation } from '../lib/sse';
import { askClaudeForGuest } from '../lib/llm';

// ── Conversation flow state types ──
interface AmenityBookingState {
  step: 'awaiting_time';
  amenityLabel: string;
  amenityDbSearch: string;
  serviceType: string;
  emoji: string;
  todaySlots: string[];
  tomorrowSlots: string[];
}

interface CancelState {
  step: 'awaiting_confirm';
  requestId: string;
  requestType: string;
}

interface TableBookingState {
  step: 'awaiting_pax_time';
  restaurantId: string;
  restaurantName: string;
}

// ── DB-backed flow state helpers (replaces in-memory Maps) ──
async function getFlowState(conversationId: string) {
  return prisma.conversationFlowState.findUnique({ where: { conversationId } });
}

async function setFlowState(conversationId: string, type: string, data: object) {
  return prisma.conversationFlowState.upsert({
    where: { conversationId },
    create: { conversationId, type, data },
    update: { type, data },
  });
}

async function clearFlowState(conversationId: string) {
  return prisma.conversationFlowState.deleteMany({ where: { conversationId } });
}

async function resetUnknownCount(conversationId: string) {
  return prisma.conversation.update({
    where: { id: conversationId },
    data: { unknownCount: 0 },
  });
}

async function incrementUnknownCount(conversationId: string): Promise<number> {
  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data: { unknownCount: { increment: 1 } },
    select: { unknownCount: true },
  });
  return updated.unknownCount;
}

// ── Bookable amenities — keyword → amenity config ──
const BOOKING_VERBS = [
  'book', 'reserve', 'slot', 'session', 'appointment', 'want', 'need',
  'can i', 'schedule', 'get a', 'get me', 'please', 'karna hai', 'chahiye', 'book karo',
];

interface BookableAmenity {
  label: string;
  dbSearch: string;
  serviceType: string;
  emoji: string;
  defaultOpen: number;
  defaultClose: number;
  keywords: string[];
}

const BOOKABLE_AMENITIES: BookableAmenity[] = [
  {
    label: 'Spa & Wellness', dbSearch: 'Spa', serviceType: 'Spa Appointment',
    emoji: '💆', defaultOpen: 9, defaultClose: 20,
    keywords: [
      'spa', 'massage', 'facial', 'wellness', 'body massage', 'head massage',
      'spa karna', 'spa chahiye', 'spa please',
    ],
  },
  {
    label: 'Gym', dbSearch: 'Gym', serviceType: 'Gym Session',
    emoji: '🏋️', defaultOpen: 6, defaultClose: 22,
    keywords: [
      'gym', 'fitness', 'workout', 'exercise', 'fitness center', 'fitness centre',
      'gym karna', 'gym chahiye',
    ],
  },
  {
    label: 'Swimming Pool', dbSearch: 'Pool', serviceType: 'Pool Session',
    emoji: '🏊', defaultOpen: 7, defaultClose: 20,
    keywords: [
      'pool', 'swimming', 'swim', 'swimming pool', 'pool session',
    ],
  },
  {
    label: 'Restaurant', dbSearch: 'Restaurant', serviceType: 'Restaurant Reservation',
    emoji: '🍽️', defaultOpen: 7, defaultClose: 23,
    keywords: [
      'restaurant', 'dining', 'book a table', 'reserve a table', 'book table',
      'reserve table', 'table reservation', 'dinner reservation', 'lunch reservation',
      'breakfast reservation', 'restaurant booking',
    ],
  },
  {
    label: 'Tennis Court', dbSearch: 'Tennis', serviceType: 'Tennis Court Booking',
    emoji: '🎾', defaultOpen: 6, defaultClose: 20,
    keywords: ['tennis', 'tennis court'],
  },
  {
    label: 'Rooftop', dbSearch: 'Rooftop', serviceType: 'Rooftop Booking',
    emoji: '🌇', defaultOpen: 17, defaultClose: 23,
    keywords: ['rooftop', 'rooftop lounge', 'roof top', 'rooftop bar'],
  },
];

function detectAmenityBookingIntent(lower: string): BookableAmenity | null {
  const hasBookingVerb = BOOKING_VERBS.some(v => lower.includes(v));
  for (const amenity of BOOKABLE_AMENITIES) {
    if (amenity.keywords.some(k => lower.includes(k)) && hasBookingVerb) {
      return amenity;
    }
  }
  return null;
}

const CANCEL_TRIGGERS = [
  'cancel', 'cancel it', 'cancel my booking', 'cancel my request', 'cancel request',
  'cancel my spa', 'cancel spa', 'cancel reservation', 'cancel order',
  'nevermind', 'never mind', 'don\'t need it', 'dont need it', 'not needed anymore',
  'forget it', 'no need', 'abort', 'cancel kar do', 'cancel karo', 'nahi chahiye',
  'nahi chahiye ab', 'rehne do', 'ruk jao',
];

function generateHourlySlots(openHour: number, closeHour: number): string[] {
  const slots: string[] = [];
  for (let h = openHour; h < closeHour; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`);
  }
  return slots;
}

function parseTimeFromMessage(lower: string): { hour: number; minute: number } | null {
  // Match patterns: "3pm", "3 pm", "15:00", "15", "3:30pm", "at 3", "at 15"
  const patterns = [
    { re: /(\d{1,2}):(\d{2})\s*(am|pm)?/, fn: (m: RegExpMatchArray) => {
      let h = parseInt(m[1]); const min = parseInt(m[2]); const ampm = m[3];
      if (ampm === 'pm' && h < 12) h += 12;
      if (ampm === 'am' && h === 12) h = 0;
      return { hour: h, minute: min };
    }},
    { re: /(\d{1,2})\s*(am|pm)/, fn: (m: RegExpMatchArray) => {
      let h = parseInt(m[1]); const ampm = m[2];
      if (ampm === 'pm' && h < 12) h += 12;
      if (ampm === 'am' && h === 12) h = 0;
      return { hour: h, minute: 0 };
    }},
    { re: /\bat\s+(\d{1,2})\b/, fn: (m: RegExpMatchArray) => {
      let h = parseInt(m[1]);
      // If no am/pm and hour < 9, assume pm (spa context)
      if (h < 9) h += 12;
      return { hour: h, minute: 0 };
    }},
  ];
  for (const { re, fn } of patterns) {
    const m = lower.match(re);
    if (m) return fn(m);
  }
  return null;
}

const router = Router();

// Send OTP
router.post('/send-otp', async (req: Request, res: Response) => {
  try {
    const { email, hotelSlug, roomNumber, guestName, checkInDate, checkOutDate } = req.body;

    if (!email || !hotelSlug || !roomNumber || !guestName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const hotel = await prisma.hotel.findUnique({ where: { slug: hotelSlug } });
    if (!hotel) return res.status(404).json({ error: 'Hotel not found' });

    const room = await prisma.room.findFirst({
      where: { hotelId: hotel.id, roomNumber, isActive: true },
    });
    if (!room) return res.status(400).json({ error: 'Room not found or inactive' });

    // Generate 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Clean up old unverified OTPs
    await prisma.otpCode.deleteMany({
      where: { email, verified: false },
    });

    await prisma.otpCode.create({
      data: { email, code, expiresAt },
    });

    // In production, send email. In dev, return code in response.
    console.log(`📧 OTP for ${email}: ${code}`);

    return res.json({
      success: true,
      message: 'OTP sent successfully',
      // Only expose in dev mode
      ...(process.env.NODE_ENV !== 'production' && { devOtp: code }),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify OTP and create guest session
router.post('/verify-otp', async (req: Request, res: Response) => {
  try {
    const { email, code, hotelSlug, roomNumber, guestName, checkInDate, checkOutDate, preferredLanguage } = req.body;

    if (!email || !code || !hotelSlug || !roomNumber) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const hotel = await prisma.hotel.findUnique({ where: { slug: hotelSlug } });
    if (!hotel) return res.status(404).json({ error: 'Hotel not found' });

    const room = await prisma.room.findFirst({
      where: { hotelId: hotel.id, roomNumber, isActive: true },
    });
    if (!room) return res.status(400).json({ error: 'Room not found' });

    // Verify OTP
    const otp = await prisma.otpCode.findFirst({
      where: {
        email,
        code,
        verified: false,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    // Mark OTP as verified
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { verified: true },
    });

    // Create guest session
    const token = crypto.randomBytes(32).toString('hex');
    const guestSession = await prisma.guestSession.create({
      data: {
        hotelId: hotel.id,
        roomId: room.id,
        guestName: guestName || 'Guest',
        email,
        checkInDate: checkInDate ? new Date(checkInDate) : new Date(),
        checkOutDate: checkOutDate ? new Date(checkOutDate) : new Date(Date.now() + 86400000),
        otpVerified: true,
        token,
        preferredLanguage: preferredLanguage || 'en',
      },
    });

    // Log QR scan
    await prisma.qrScan.create({
      data: { hotelId: hotel.id, source: 'room_qr', deviceType: 'mobile' },
    });

    // Create notification for new chat
    await prisma.notification.create({
      data: {
        hotelId: hotel.id,
        type: 'new_chat',
        title: `New Guest — Room ${roomNumber}`,
        body: `${guestName} has checked into the guest chat from Room ${roomNumber}.`,
        relatedEntityType: 'guestSession',
        relatedEntityId: guestSession.id,
      },
    });

    return res.json({
      success: true,
      guestToken: token,
      guestSession: {
        id: guestSession.id,
        guestName: guestSession.guestName,
        roomNumber,
        hotelName: hotel.name,
        hotelSlug: hotel.slug,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Middleware to verify guest token
const verifyGuestToken = async (req: any, res: Response, next: any) => {
  const token = req.headers['x-guest-token'];
  if (!token) return res.status(401).json({ error: 'No guest token' });

  const session = await prisma.guestSession.findUnique({
    where: { token: token as string },
    include: { room: true, hotel: true },
  });

  if (!session || !session.otpVerified) {
    return res.status(401).json({ error: 'Invalid guest session' });
  }

  // Block access at noon on checkout day
  if (!isSessionActive(session.checkOutDate)) {
    return res.status(403).json({ error: 'session_expired', message: 'Your chat session has ended. Thank you for staying with us! We hope to see you again soon. 🙏' });
  }

  req.guestSession = session;
  next();
};

// Start or get conversation
router.post('/chat/start', verifyGuestToken, async (req: any, res: Response) => {
  try {
    const session = req.guestSession;
    // Use client-provided lang if present (handles old sessions where DB has wrong lang)
    const lang = req.body?.lang || session.preferredLanguage || 'en';
    session.preferredLanguage = lang;

    // Use a transaction to prevent duplicate conversation creation under concurrent requests
    const { conversation, isNew } = await prisma.$transaction(async (tx) => {
      const allActive = await tx.conversation.findMany({
        where: { guestSessionId: session.id, status: 'active' },
        orderBy: { createdAt: 'desc' },
      });

      // Close any duplicates (e.g. from React Strict Mode double-invoke)
      if (allActive.length > 1) {
        const idsToClose = allActive.slice(1).map((c: { id: string }) => c.id);
        await tx.conversation.updateMany({
          where: { id: { in: idsToClose } },
          data: { status: 'closed' },
        });
      }

      if (allActive.length > 0) {
        const existing = await tx.conversation.findUnique({
          where: { id: allActive[0].id },
          include: { messages: { orderBy: { createdAt: 'asc' } } },
        });
        return { conversation: existing, isNew: false };
      }

      const welcomeText = T(lang, 'welcome', { name: session.guestName });
      const welcomeTextEn = TEN('welcome', { name: session.guestName });
      const created = await tx.conversation.create({
        data: {
          hotelId: session.hotelId,
          roomId: session.roomId,
          guestSessionId: session.id,
          messages: {
            create: {
              senderType: 'assistant',
              content: welcomeText,
              englishContent: welcomeTextEn,
              originalLanguage: lang,
              inputType: 'text',
            },
          },
        },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });
      return { conversation: created, isNew: true };
    });

    if (isNew) {
      emitToHotel(session.hotelId, 'new_chat', { roomNumber: session.room.roomNumber, guestName: session.guestName });
    }

    return res.json({ conversation, session });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get conversation messages
router.get('/conversations/:id', verifyGuestToken, async (req: any, res: Response) => {
  try {
    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, guestSessionId: req.guestSession.id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conversation) return res.status(404).json({ error: 'Not found' });
    return res.json(conversation);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// SSE stream — guest receives real-time staff replies without polling
router.get('/conversations/:id/events', verifyGuestToken, async (req: any, res: Response) => {
  const session = req.guestSession;
  const conversationId = req.params.id;

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, guestSessionId: session.id },
    select: { id: true },
  });
  if (!conversation) return res.status(404).json({ error: 'Not found' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  res.write('event: connected\ndata: {}\n\n');

  const cleanup = addGuestSSEClient(conversationId, res);
  const ping = setInterval(() => {
    try { res.write(':ping\n\n'); } catch { clearInterval(ping); cleanup(); }
  }, 25000);

  req.on('close', () => { clearInterval(ping); cleanup(); });
});

// Process guest message - the chat assistant logic
router.post('/conversations/:id/message', verifyGuestToken, async (req: any, res: Response) => {
  try {
    const { content, lang: clientLang } = req.body;
    if (!content) return res.status(400).json({ error: 'Message content required' });

    const session = req.guestSession;
    // Client-provided lang takes priority over DB value (handles old sessions and lang changes)
    if (clientLang && clientLang !== session.preferredLanguage) {
      session.preferredLanguage = clientLang;
    }
    // Resolved language for this message — used for translation and i18n
    const lang: string = session.preferredLanguage || 'en';

    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, guestSessionId: session.id },
      include: { flowState: true },
    });
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    // Save guest message — store English equivalent for staff view
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderType: 'guest',
        content,
        englishContent: translateToEnglish(content, lang),
        originalLanguage: lang,
      },
    });

    // Process with rules engine
    const response = await processGuestMessage(content, session, conversation);

    // Save assistant response — englishMessage is the pre-computed English equivalent
    const assistantMsg = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderType: 'assistant',
        content: response.message,
        englishContent: response.englishMessage ?? (lang === 'en' ? response.message : undefined),
        originalLanguage: lang,
      },
    });

    // Update conversation timestamp (and escalation flag if needed)
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        updatedAt: new Date(),
        ...(response.escalated ? { hasEscalation: true } : {}),
      },
    });

    // Real-time: push message_created event to all staff of this hotel
    emitToHotel(session.hotelId, 'message_created', {
      conversationId: conversation.id,
      roomNumber: session.room?.roomNumber || '',
    });

    return res.json({
      message: assistantMsg,
      action: response.action || null,
      buttons: response.buttons || null,
      orderCreated: response.orderCreated || null,
      requestCreated: response.requestCreated || null,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Place food order
router.post('/orders', verifyGuestToken, async (req: any, res: Response) => {
  try {
    const { items } = req.body; // [{ menuItemId, quantity }]
    const session = req.guestSession;

    if (!items || !items.length) return res.status(400).json({ error: 'No items provided' });

    for (const item of items) {
      if (!item.quantity || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) {
        return res.status(400).json({ error: 'Quantity must be an integer between 1 and 99' });
      }
    }

    const menuItems = await prisma.menuItem.findMany({
      where: {
        id: { in: items.map((i: any) => i.menuItemId) },
        hotelId: session.hotelId,
        isAvailable: true,
      },
    });

    let total = 0;
    const orderItemsData = items.map((i: any) => {
      const mi = menuItems.find((m) => m.id === i.menuItemId);
      if (!mi) throw new Error(`Menu item ${i.menuItemId} not found`);
      const subtotal = mi.price * i.quantity;
      total += subtotal;
      return {
        menuItemId: mi.id,
        quantity: i.quantity,
        itemNameSnapshot: mi.name,
        itemPriceSnapshot: mi.price,
      };
    });

    const order = await prisma.order.create({
      data: {
        hotelId: session.hotelId,
        roomId: session.roomId,
        guestSessionId: session.id,
        totalAmount: total,
        isBillable: true,
        items: { create: orderItemsData },
      },
      include: { items: true },
    });

    // Create notification for front desk
    const itemsSummary = orderItemsData.map((i: any) => `${i.itemNameSnapshot} ×${i.quantity}`).join(', ');
    await prisma.notification.create({
      data: {
        hotelId: session.hotelId,
        type: 'new_order',
        title: `New Order — Room ${session.room.roomNumber}`,
        body: `${session.guestName} ordered: ${itemsSummary}. Total: ₹${total}. Please add to bill.`,
        relatedEntityType: 'order',
        relatedEntityId: order.id,
      },
    });
    emitToHotel(session.hotelId, 'new_order', { roomNumber: session.room.roomNumber, total });

    return res.status(201).json(order);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Create service request
router.post('/requests', verifyGuestToken, async (req: any, res: Response) => {
  try {
    const { type, details } = req.body;
    const session = req.guestSession;

    const billableTypes = ['Laundry', 'Taxi / Cab', 'Airport Pickup', 'Room Service'];
    const isBillable = billableTypes.includes(type);

    const serviceRequest = await prisma.serviceRequest.create({
      data: {
        hotelId: session.hotelId,
        roomId: session.roomId,
        guestSessionId: session.id,
        type,
        details,
        isBillable,
      },
    });

    // Create notification
    await prisma.notification.create({
      data: {
        hotelId: session.hotelId,
        type: 'new_request',
        title: `${type} Request — Room ${session.room.roomNumber}`,
        body: `${session.guestName} requested ${type}${details ? ': ' + details : ''}.`,
        relatedEntityType: 'serviceRequest',
        relatedEntityId: serviceRequest.id,
      },
    });
    emitToHotel(session.hotelId, 'new_request', { roomNumber: session.room.roomNumber, type });

    return res.status(201).json(serviceRequest);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get guest session by token
router.get('/session', verifyGuestToken, async (req: any, res: Response) => {
  const s = req.guestSession;
  return res.json({
    id: s.id,
    guestName: s.guestName,
    email: s.email,
    roomNumber: s.room.roomNumber,
    hotelName: s.hotel.name,
    hotelSlug: s.hotel.slug,
    checkInDate: s.checkInDate,
    checkOutDate: s.checkOutDate,
  });
});

// Update guest session language (client may have a more recent preference than DB)
router.patch('/session/language', verifyGuestToken, async (req: any, res: Response) => {
  try {
    const { preferredLanguage } = req.body;
    if (!preferredLanguage) return res.status(400).json({ error: 'preferredLanguage required' });
    await prisma.guestSession.update({
      where: { id: req.guestSession.id },
      data: { preferredLanguage },
    });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ──────────────────────────────────────────────
// Rules Engine — Comprehensive Hotel Guest Needs
// ──────────────────────────────────────────────

// Every real thing a guest needs in a hotel, mapped to a service type
// Priority order matters — more specific entries first
const SERVICE_KEYWORDS: Array<{
  type: string;
  billable: boolean;
  priority: number;
  hints: string[];
  responseKey?: string; // optional i18n key for custom response
  infoOnly?: boolean;  // if true: return message only, do NOT create a DB service request
}> = [

  // ── ROOM COMFORT ──
  {
    type: 'AC / Temperature Issue', billable: false, priority: 10,
    hints: [
      'ac not working', 'air conditioning not', 'ac nahi chal', 'ac band hai', 'ac off hai',
      'too hot', 'room is hot', 'very hot', 'bahut garmi', 'garmi hai', 'room mein garmi',
      'too cold', 'room is cold', 'very cold', 'bahut thandi', 'thandi hai', 'freezing',
      'ac making noise', 'ac loud', 'ac smell', 'temperature not', 'heater not', 'heater band',
      'ac chalao', 'ac theek karo', 'temperature change', 'ac set karo'
    ],
  },
  {
    type: 'Maintenance', billable: false, priority: 9,
    hints: [
      'not working', 'broken', 'repair', 'fix it', 'issue in room', 'problem in room',
      'maintenance', 'nahi chal raha', 'kharab hai', 'toot gaya', 'band ho gaya',
      'light not working', 'bulb fused', 'light band hai', 'bijli nahi', 'switch not working',
      'tv not working', 'tv band hai', 'remote not working', 'remote nahi chal raha',
      'toilet not flushing', 'flush nahi chal', 'toilet blocked', 'drain blocked', 'drain slow',
      'tap leaking', 'pipe leaking', 'water leaking', 'paani tap se', 'sink blocked',
      'shower not working', 'shower band hai', 'door not closing', 'door stuck', 'lock not working',
      'safe not opening', 'locker issue', 'curtain stuck', 'blind stuck', 'window stuck',
      'fan not working', 'fan band hai', 'mirror broken', 'socket not working', 'plug not working',
      'no electricity', 'power cut', 'power issue', 'geyser nahi', 'geyser band'
    ],
  },
  {
    type: 'No Hot Water', billable: false, priority: 10,
    hints: [
      'no hot water', 'hot water not coming', 'garam paani nahi', 'garam paani nahi aa raha',
      'cold water in shower', 'water not hot', 'paani thanda hai', 'hot water issue',
      'geyser not working', 'geyser band hai', 'boiler issue'
    ],
  },
  {
    type: 'Noise Complaint', billable: false, priority: 9,
    hints: [
      'noise', 'noisy', 'too loud', 'disturbing noise', 'noise from outside', 'noise from next room',
      'awaz aa rahi', 'bahut shor', 'shor hai', 'neend nahi aa rahi', 'sound coming',
      'neighbours loud', 'construction noise', 'music too loud', 'party noise'
    ],
    responseKey: 'srNoiseComplaint',
  },

  // ── HOUSEKEEPING ──
  {
    type: 'Housekeeping', billable: false, priority: 8,
    hints: [
      'housekeeping', 'clean my room', 'clean the room', 'room cleaning', 'room saaf',
      'safai chahiye', 'saaf karo', 'saaf kar do', 'kamra saaf karo', 'room clean karo',
      'change bedsheets', 'fresh sheets', 'bedsheet badlo', 'chadar badlo',
      'vacuum', 'mop', 'sweep', 'dusting', 'room not cleaned', 'room dirty',
      'garbage', 'dustbin full', 'trash', 'kachra', 'kachra uthao',
      'turndown service', 'evening service', 'bed turndown'
    ],
  },
  {
    type: 'Extra Towels', billable: false, priority: 8,
    hints: [
      'towel', 'towels', 'bath towel', 'hand towel', 'face towel', 'pool towel',
      'extra towel', 'more towels', 'towel chahiye', 'towel bhejo', 'towel do',
      'towel nahi hai', 'no towel', 'tawel'
    ],
  },
  {
    type: 'Toiletries', billable: false, priority: 8,
    hints: [
      'toiletries', 'shampoo', 'conditioner', 'soap', 'body wash', 'shower gel',
      'toothbrush', 'toothpaste', 'razor', 'shaving kit', 'moisturizer', 'lotion',
      'cotton', 'sanitary', 'dental kit', 'comb', 'hair dryer', 'dryer not working',
      'toiletry', 'bathroom supplies', 'bathroom kit', 'amenities kit'
    ],
  },
  {
    type: 'Laundry', billable: true, priority: 9,
    hints: [
      'laundry', 'wash clothes', 'wash my clothes', 'clothes washing', 'laundry service',
      'dhulai', 'kapde dhone', 'kapde wash karo', 'laundry bag', 'washing',
      'dry cleaning', 'dry clean', 'pressing only', 'iron only'
    ],
  },
  {
    type: 'Iron & Ironing Board', billable: false, priority: 8,
    hints: [
      'iron', 'ironing board', 'press clothes', 'press my clothes', 'press shirt',
      'istri', 'press karna', 'iron chahiye', 'kapde press karo', 'ironing'
    ],
  },
  {
    type: 'Shoe Shine', billable: false, priority: 6,
    hints: [
      'shoe shine', 'polish shoes', 'shoe polish', 'boot polish', 'joote', 'joote saaf'
    ],
  },

  // ── BEDDING & COMFORT ──
  {
    type: 'Extra Bedding', billable: false, priority: 8,
    hints: [
      'pillow', 'pillows', 'extra pillow', 'more pillows', 'soft pillow', 'hard pillow',
      'takiya', 'takiya chahiye', 'extra takiya',
      'blanket', 'blankets', 'extra blanket', 'more blankets', 'warm blanket',
      'rajai', 'rajai chahiye', 'quilt', 'duvet', 'comforter',
      'mattress topper', 'bed too hard', 'bed uncomfortable'
    ],
  },
  {
    type: 'Do Not Disturb', billable: false, priority: 9,
    hints: [
      'do not disturb', 'dnd', 'dont disturb', 'do not knock', 'no housekeeping today',
      'disturb mat karo', 'privacy', 'no entry', 'please do not disturb',
      'skip cleaning today', 'no service today', 'dont come in'
    ],
    responseKey: 'srDnd',
  },

  // ── FOOD & BEVERAGES ──
  {
    type: 'Water / Beverages', billable: false, priority: 9,
    hints: [
      'water', 'mineral water', 'drinking water', 'water bottle', 'bottle of water',
      'paani', 'paani chahiye', 'paani bhejo', 'paani do', 'paani nahi hai',
      'no water', 'water finished', 'refill water'
    ],
  },
  {
    type: 'Ice Bucket', billable: false, priority: 8,
    hints: [
      'ice bucket', 'ice cubes', 'ice tray', 'need ice', 'want ice', 'send ice',
      'some ice', 'get ice', 'ice please', 'barf chahiye', 'ice chahiye', 'barf lao'
    ],
  },
  {
    type: 'Minibar Restock', billable: true, priority: 7,
    hints: [
      'minibar', 'mini bar', 'minibar empty', 'restock', 'fridge empty', 'room fridge',
      'cold drinks', 'soft drinks', 'soda', 'juice refill', 'minibar refill'
    ],
  },

  // ── TRANSPORT ──
  {
    type: 'Airport Transfer', billable: true, priority: 10,
    hints: [
      'airport', 'airport drop', 'drop to airport', 'airport transfer', 'airport pickup',
      'airport taxi', 'airport cab', 'airport jaana', 'flight', 'pick up from airport',
      'airport shuttle'
    ],
  },
  {
    type: 'Limo / Car Service', billable: true, priority: 10,
    hints: [
      'limo', 'limousine', 'limo service', 'chauffeur', 'luxury car',
      'private car', 'executive car', 'business car', 'chauffeur driven',
      'limo chahiye', 'luxury vehicle'
    ],
    responseKey: 'srLimo',
  },
  {
    type: 'Taxi / Cab', billable: true, priority: 9,
    hints: [
      'taxi', 'cab', 'need a car', 'book a car', 'car service', 'send a car',
      'uber', 'ola', 'rapido', 'ride', 'gaadi',
      'gaadi chahiye', 'taxi chahiye', 'cab chahiye', 'vehicle chahiye',
      'book a cab', 'book a taxi', 'need a car', 'drop me', 'need transport',
      'city tour', 'sightseeing', 'local tour'
    ],
  },
  {
    type: 'Currency Exchange', billable: false, priority: 8,
    hints: [
      'currency exchange', 'exchange currency', 'foreign exchange', 'forex',
      'change money', 'exchange money', 'money exchange', 'foreign currency',
      'dollars', 'euros', 'pounds', 'convert currency', 'currency convert',
      'currency chahiye', 'paisa exchange', 'dollar chahiye', 'euro chahiye'
    ],
    responseKey: 'srCurrencyExchange',
  },
  {
    type: 'Hotel Shuttle', billable: false, priority: 8,
    hints: [
      'shuttle', 'hotel shuttle', 'hotel transport', 'hotel bus', 'hotel car',
      'complimentary drop', 'hotel cab', 'free transfer'
    ],
  },

  // ── WELLNESS & RECREATION ──
  {
    type: 'Spa Appointment', billable: true, priority: 8,
    hints: [
      'spa', 'massage', 'spa appointment', 'book spa', 'spa booking', 'body massage',
      'head massage', 'facial', 'wellness', 'spa timing', 'spa available',
      'spa mein jaana', 'massage chahiye', 'spa book karo'
    ],
  },
  {
    type: 'Doctor / Medical Assistance', billable: false, priority: 10,
    hints: [
      'doctor', 'medical', 'not feeling well', 'sick', 'feeling ill', 'i am ill',
      'very ill', 'quite ill', 'medicine', 'first aid',
      'tabiyat theek nahi', 'bimar hoon', 'dawai chahiye', 'nurse', 'ambulance',
      'emergency medical', 'headache', 'fever', 'stomach pain', 'injury', 'hurt',
      'dawa chahiye', 'doctor bulao', 'hospital'
    ],
    responseKey: 'srMedical',
  },

  // ── SLEEP & WAKE ──
  {
    type: 'Wake-up Call', billable: false, priority: 9,
    hints: [
      'wake up', 'wake-up', 'wakeup', 'morning call', 'wake me up', 'wake me at',
      'alarm', 'wake up call', 'jagao', 'jagana', 'subah jagana', 'kal jagana',
      'set alarm', 'reminder call', 'morning wake', 'wake up at'
    ],
  },

  // ── BUSINESS SERVICES ──
  {
    type: 'Printing / Scanning', billable: false, priority: 7,
    hints: [
      'print', 'printing', 'scan', 'scanning', 'photocopy', 'xerox', 'fax',
      'print document', 'scan document', 'business center', 'print chahiye'
    ],
  },
  {
    type: 'Stationery', billable: false, priority: 6,
    hints: [
      'need a pen', 'want a pen', 'pen please', 'i need pen', 'send pen',
      'paper please', 'notepad', 'stationery', 'writing pad', 'envelope',
      'pen chahiye', 'paper chahiye', 'notebook'
    ],
  },
  {
    type: 'Meeting Room', billable: true, priority: 7,
    hints: [
      'meeting room', 'conference room', 'board room', 'meeting space', 'meeting hall',
      'meeting chahiye', 'conference chahiye', 'presentation room'
    ],
  },

  // ── CONNECTIVITY ──
  {
    type: 'Charger / Adapter', billable: false, priority: 8,
    hints: [
      'charger', 'phone charger', 'laptop charger', 'adapter', 'plug adapter',
      'charging cable', 'usb cable', 'charger chahiye', 'charge nahi ho raha',
      'power adapter', 'travel adapter', 'converter'
    ],
  },
  {
    type: 'TV / Entertainment Issue', billable: false, priority: 7,
    hints: [
      'tv channels', 'channel list', 'tv guide', 'how to use tv', 'tv remote',
      'netflix', 'how to connect', 'cast to tv', 'hdmi', 'tv sound', 'tv picture',
      'channel not working', 'tv setup', 'entertainment'
    ],
  },

  // ── CHECKOUT & BILLING ──
  {
    type: 'Late Check-out', billable: false, priority: 9,
    hints: [
      'late checkout', 'late check out', 'late check-out', 'extend stay', 'stay longer',
      'checkout extend', 'checkout late', 'thoda late checkout', 'checkout time extend',
      'can i stay longer', 'extra hour', 'few more hours', 'delay checkout',
      'late check out please', 'request late checkout',
    ],
    responseKey: 'srLateCheckout',
  },
  {
    type: 'Early Check-out', billable: false, priority: 9,
    hints: [
      'early checkout', 'early check out', 'early check-out', 'check out early',
      'checkout early', 'want to checkout early', 'leaving early', 'early departure',
    ],
    responseKey: 'srEarlyCheckout',
  },
  {
    type: 'Electrical Issue', billable: false, priority: 10,
    hints: [
      'electrical issue', 'electrical maintenance', 'electrical problem',
      'lights not working', 'power not working', 'no electricity in room',
    ],
  },
  {
    type: 'Plumbing Issue', billable: false, priority: 10,
    hints: [
      'plumbing issue', 'plumbing maintenance', 'plumbing problem',
      'tap problem', 'drain problem', 'pipe problem',
    ],
  },
  {
    type: 'Cooling System Issue', billable: false, priority: 10,
    hints: [
      'cooling system', 'ac issue', 'cooling issue',
    ],
  },
  {
    type: 'Bill / Invoice Query', billable: false, priority: 8,
    hints: [
      'bill', 'invoice', 'receipt', 'billing', 'charges', 'extra charge',
      'bill query', 'bill issue', 'wrong charge', 'bill mein galti', 'bill check',
      'folio', 'account statement', 'payment', 'how much', 'total bill'
    ],
    responseKey: 'srBilling',
  },
  {
    type: 'Early Check-in', billable: false, priority: 8,
    // infoOnly: no DB request created — guest is redirected to front desk directly
    infoOnly: true,
    hints: [
      'early check in', 'early checkin', 'early check-in', 'check in early',
      'room ready', 'is room ready', 'can i check in', 'arrive early', 'early arrival',
      'pehle check in', 'room abhi mil sakta'
    ],
    responseKey: 'srEarlyCheckin',
  },
  {
    type: 'Luggage Storage', billable: false, priority: 7,
    hints: [
      'luggage storage', 'store luggage', 'keep bags', 'store bags', 'luggage room',
      'bag storage', 'samaan rakhna', 'bags rakhne', 'cloak room', 'left luggage'
    ],
    responseKey: 'srLuggage',
  },

  // ── LOST & FOUND / SAFETY ──
  {
    type: 'Lost Key Card', billable: false, priority: 10,
    hints: [
      'lost key', 'key card lost', 'key missing', 'room key lost', 'lost my key',
      'card not working', 'key not opening', 'key expired', 'new key card',
      'chabi kho gayi', 'key kho gaya', 'door nahi khul raha'
    ],
    responseKey: 'srLostKey',
  },
  {
    type: 'Lost & Found', billable: false, priority: 9,
    hints: [
      'lost', 'missing', 'cant find', 'left behind', 'forgot', 'lost item',
      'kho gaya', 'nahi mil raha', 'lost something', 'found something',
      'lost wallet', 'lost phone', 'lost passport', 'lost jewellery'
    ],
    responseKey: 'srLostFound',
  },
  {
    type: 'Safety Concern', billable: false, priority: 10,
    hints: [
      'safety', 'security', 'unsafe', 'scared', 'suspicious', 'emergency',
      'please help', 'need help urgently', 'help me please', 'someone help',
      'urgent help', 'danger', 'fire', 'smoke', 'flood',
      'suraksha', 'darr lag raha', 'koi aa gaya', 'intruder'
    ],
    responseKey: 'srSecurity',
  },

  // ── SPECIAL REQUESTS ──
  {
    type: 'Extra Amenities', billable: false, priority: 6,
    hints: [
      'extra cup', 'extra glass', 'extra plate', 'cutlery', 'spoon', 'fork',
      'cup chahiye', 'glass chahiye', 'extra crockery', 'kettle', 'electric kettle',
      'tea bag', 'coffee sachet', 'sugar', 'milk', 'creamer'
    ],
  },
  {
    type: 'Baby / Child Amenities', billable: false, priority: 8,
    hints: [
      'baby cot', 'crib', 'baby bed', 'extra bed', 'child bed', 'rollaway bed',
      'baby chair', 'high chair', 'baby amenities', 'child menu', 'baby food',
      'nappy', 'diaper', 'baby supplies', 'bacche ke liye'
    ],
  },
  {
    type: 'Special Celebration', billable: false, priority: 7,
    hints: [
      'birthday', 'anniversary', 'celebration', 'surprise', 'cake', 'flowers',
      'decoration', 'romantic setup', 'candles', 'rose petals',
      'birthday celebrate karna', 'anniversary hai', 'surprise arrange karo'
    ],
    responseKey: 'srCelebration',
  },
  {
    type: 'Dietary Requirements', billable: false, priority: 7,
    hints: [
      'vegetarian', 'vegan', 'jain food', 'jain', 'gluten free', 'gluten-free',
      'dairy free', 'nut allergy', 'allergy', 'halal', 'kosher',
      'no onion', 'no garlic', 'diabetic food', 'low sugar', 'low salt',
      'special diet', 'diet requirement', 'khana without'
    ],
    responseKey: 'srDietary',
  },
];

// Food detection keywords
const FOOD_KEYWORDS = [
  'order', 'food', 'hungry', 'eat', 'drink', 'menu', 'breakfast', 'lunch', 'dinner',
  'beverage', 'snack', 'dessert', 'room service',
  'bhookh', 'khana', 'khaana', 'peena', 'chai', 'coffee', 'juice', 'pizza', 'burger',
  'sandwich', 'biryani', 'dal', 'roti', 'rice', 'noodles', 'soup', 'salad',
  'kuch khana', 'kuch peena', 'khana mangwana', 'food order'
];

// Amenity keywords
const AMENITY_KEYWORDS = [
  'pool', 'swimming', 'spa', 'gym', 'fitness', 'restaurant', 'parking', 'rooftop',
  'wifi', 'wi-fi', 'internet', 'password', 'lounge', 'business center', 'bar',
  'timing', 'timings', 'open', 'hours', 'what time', 'when does', 'kab khulta',
  'kab band', 'kab tak', 'open hai kya', 'facilities', 'amenities'
];

// Info keywords
const INFO_KEYWORDS = {
  checkinout: [
    'check-in time', 'check in time', 'check out time', 'checkout time', 'check-out time',
    'when is checkout', 'what time checkout', 'kab checkout', 'checkout kab hai',
    'checkin kab', 'check in kab'
  ],
  wifi: [
    'wifi password', 'wi-fi password', 'internet password', 'wifi code', 'network password',
    'wifi ka password', 'password kya hai', 'wifi name', 'network name', 'wifi details'
  ],
  frontdesk: [
    'front desk number', 'reception number', 'contact number', 'hotel number',
    'call front desk', 'front desk ka number', 'reception ka number'
  ],
};

// Greeting detection
const GREETINGS = [
  'hi', 'hello', 'hey', 'hii', 'helo', 'heya', 'howdy',
  'good morning', 'good afternoon', 'good evening', 'good night',
  'namaste', 'namaskar', 'sat sri akal', 'jai hind', 'pranam',
  'assalamualaikum', 'salaam'
];

// Thank you detection
const THANKS = [
  'thank you', 'thanks', 'thankyou', 'thx', 'ty', 'thank u',
  'shukriya', 'dhanyawad', 'bahut shukriya', 'bahut dhanyawad', 'aabhar'
];

// Affirmative acknowledgments — guest confirming or saying "ok" after a response
const AFFIRMATIVES = [
  'ok', 'okay', 'ok ok', 'sure', 'alright', 'got it', 'noted', 'understood',
  'sounds good', 'perfect', 'great', 'nice', 'cool', 'fine', 'good',
  'theek hai', 'theek', 'accha', 'acha', 'bilkul', 'haan ji', 'ji haan',
  'わかりました', '了解', '好的', 'ok merci', 'd\'accord', 'super', 'bien',
];

// Explicit escalation triggers — guest directly asking for a human
const EXPLICIT_ESCALATION_TRIGGERS = [
  'talk to front desk', 'speak to front desk', 'connect to front desk', 'call front desk',
  'talk to staff', 'speak to staff', 'connect to staff', 'talk to a person',
  'talk to someone', 'speak to someone', 'human please', 'real person',
  'speak to reception', 'talk to reception', 'call reception',
  'front desk please', 'need help from staff', 'escalate',
  '__escalate__',
];

// ── Main menu buttons — shown on greeting and welcome ──
const MAIN_MENU_BUTTONS = [
  { label: '🧹 Housekeeping', value: '__housekeeping__' },
  { label: '🍽️ F&B Order', value: '__fnb_menu__' },
  { label: '🚗 Limo Service', value: '__limo__' },
  { label: '💱 Currency Exchange', value: 'I need currency exchange please.' },
  { label: '🛎️ Checkout', value: '__checkout__' },
  { label: '👕 Laundry', value: '__laundry__' },
  { label: '🏊 Amenities', value: '__amenities__' },
  { label: '🔧 Maintenance', value: '__maintenance__' },
];

function detectServiceIntent(lower: string): typeof SERVICE_KEYWORDS[0] | null {
  // Sort by priority descending so higher priority matches win
  const sorted = [...SERVICE_KEYWORDS].sort((a, b) => b.priority - a.priority);
  for (const config of sorted) {
    if (config.hints.some(hint => lower.includes(hint))) {
      return config;
    }
  }
  return null;
}

async function createServiceRequest(
  hotelId: string,
  session: any,
  serviceType: string,
  isBillable: boolean,
  content: string,
  lang: string = 'en'
) {
  // For staff-facing fields (details, notification), always store English.
  // translateToEnglish returns original text if lang is 'en', or a
  // "[Language — translation pending] <original>" placeholder otherwise.
  const englishContent = translateToEnglish(content, lang);

  const request = await prisma.serviceRequest.create({
    data: {
      hotelId,
      roomId: session.roomId,
      guestSessionId: session.id,
      type: serviceType,
      details: englishContent,
      isBillable,
    },
  });

  await prisma.notification.create({
    data: {
      hotelId,
      type: 'new_request',
      title: `${serviceType} — Room ${session.room.roomNumber}`,
      body: `${session.guestName}: "${englishContent}"`,
      relatedEntityType: 'serviceRequest',
      relatedEntityId: request.id,
    },
  });

  return request;
}

async function processGuestMessage(
  content: string,
  session: any,
  conversation: any
): Promise<{ message: string; englishMessage?: string; action?: string; escalated?: boolean; orderCreated?: any; requestCreated?: any; buttons?: { label: string; value: string }[] }> {
  const lang: string = session.preferredLanguage || 'en';
  const lower = content.toLowerCase().trim();
  const hotelId = session.hotelId;
  const roomNumber = session.room.roomNumber;

  // ── 0. Load persisted flow state from DB (single fetch, replaces all in-memory Maps) ──
  const flowStateRecord = (conversation.flowState && typeof conversation.flowState === 'object')
    ? conversation.flowState as { type: string; data: any }
    : null;
  // Validate each state has the required step field before using it
  const pendingCancel   = (flowStateRecord?.type === 'cancellation'    && flowStateRecord.data?.step) ? flowStateRecord.data as CancelState         : null;
  const pendingTable    = (flowStateRecord?.type === 'table_booking'   && flowStateRecord.data?.step) ? flowStateRecord.data as TableBookingState   : null;
  const pendingBooking  = (flowStateRecord?.type === 'amenity_booking' && flowStateRecord.data?.step) ? flowStateRecord.data as AmenityBookingState : null;

  // ── 0a. Pending cancellation — awaiting yes/no ──
  if (pendingCancel && pendingCancel.step === 'awaiting_confirm') {
    const isYes = ['yes', 'yes_cancel', 'yeah', 'yep', 'confirm', 'cancel it', 'yes cancel', 'haan', 'ha'].some(w => lower === w || lower.includes(w));
    const isNo = ['no', 'no_cancel', 'nope', 'keep', 'keep it', 'don\'t cancel', 'nahi', 'na'].some(w => lower === w || lower.includes(w));

    if (isYes) {
      await prisma.serviceRequest.updateMany({
        where: { id: pendingCancel.requestId },
        data: { status: 'cancelled' },
      });
      await clearFlowState(conversation.id);
      return { message: T(lang, 'cancelConfirmed', { type: pendingCancel.requestType }), englishMessage: TEN('cancelConfirmed', { type: pendingCancel.requestType }) };
    }
    if (isNo) {
      await clearFlowState(conversation.id);
      return { message: T(lang, 'cancelRejected', { type: pendingCancel.requestType }), englishMessage: TEN('cancelRejected', { type: pendingCancel.requestType }) };
    }
    // Still not clear — re-prompt with buttons
    return {
      message: T(lang, 'cancelConfirmPrompt', { type: pendingCancel.requestType }),
      englishMessage: TEN('cancelConfirmPrompt', { type: pendingCancel.requestType }),
      buttons: [
        { label: T(lang, 'btnYesCancel'), value: 'yes_cancel' },
        { label: T(lang, 'btnNoKeep'), value: 'no_cancel' },
      ],
    };
  }

  // ── 0b-1. Pending table booking — awaiting pax + time ──
  if (pendingTable && pendingTable.step === 'awaiting_pax_time') {
    const paxMatch = lower.match(/(\d+)\s*(guest|pax|people|person|persons|adult)?/);
    const pax = paxMatch ? parseInt(paxMatch[1]) : null;
    const parsed = parseTimeFromMessage(lower);

    if (!pax || !parsed) {
      return { message: T(lang, 'tableAskPaxTime'), englishMessage: TEN('tableAskPaxTime') };
    }

    await clearFlowState(conversation.id);

    const { hour, minute } = parsed;
    const timeStr = `${String(hour).padStart(2, '0')}:${String(minute || 0).padStart(2, '0')}`;
    const details = `Table at ${pendingTable.restaurantName} — ${pax} guest${pax > 1 ? 's' : ''} at ${timeStr}`;

    const request = await createServiceRequest(hotelId, session, 'Restaurant Reservation', false, details);
    emitToHotel(hotelId, 'new_request', { roomNumber, type: 'Restaurant Reservation' });

    return {
      message: T(lang, 'tableReserved', { restaurant: pendingTable.restaurantName, pax, paxS: pax > 1 ? 's' : '', time: timeStr }),
      englishMessage: TEN('tableReserved', { restaurant: pendingTable.restaurantName, pax, paxS: pax > 1 ? 's' : '', time: timeStr }),
      requestCreated: request,
    };
  }

  // ── 0b-2. Restaurant selected from button ──
  if (lower.startsWith('restaurant_book:')) {
    const parts = content.split(':');
    const restaurantId = parts[1];
    const restaurantName = parts.slice(2).join(':');

    await setFlowState(conversation.id, 'table_booking', {
      step: 'awaiting_pax_time',
      restaurantId,
      restaurantName,
    });

    return { message: T(lang, 'tableChosen', { restaurant: restaurantName }), englishMessage: TEN('tableChosen', { restaurant: restaurantName }) };
  }

  // ── 0b. Cancellation intent ──
  if (CANCEL_TRIGGERS.some(t => lower.includes(t))) {
    const recentRequest = await prisma.serviceRequest.findFirst({
      where: {
        guestSessionId: session.id,
        status: { in: ['pending', 'in_progress'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!recentRequest) {
      return { message: T(lang, 'noRequestsToCancel'), englishMessage: TEN('noRequestsToCancel') };
    }

    await setFlowState(conversation.id, 'cancellation', {
      step: 'awaiting_confirm',
      requestId: recentRequest.id,
      requestType: recentRequest.type,
    });

    return {
      message: T(lang, 'cancelConfirmPrompt', { type: recentRequest.type }),
      englishMessage: TEN('cancelConfirmPrompt', { type: recentRequest.type }),
      buttons: [
        { label: T(lang, 'btnYesCancel'), value: 'yes_cancel' },
        { label: T(lang, 'btnNoKeep'), value: 'no_cancel' },
      ],
    };
  }

  // ── 1. Greetings ──
  if (GREETINGS.some(g => lower === g || lower.startsWith(g + ' ') || lower.startsWith(g + '!') || lower.startsWith(g + ','))) {
    if (conversation.unknownCount > 0) await resetUnknownCount(conversation.id);
    return {
      message: T(lang, 'welcome', { name: session.guestName }),
      englishMessage: TEN('welcome', { name: session.guestName }),
      action: 'show_main_menu',
    };
  }

  // ── 2. Thank you ──
  if (THANKS.some(t => lower === t || lower.startsWith(t + ' ') || lower.startsWith(t + '!'))) {
    if (conversation.unknownCount > 0) await resetUnknownCount(conversation.id);
    return { message: T(lang, 'youreWelcome'), englishMessage: TEN('youreWelcome') };
  }

  // ── 2b. Affirmative acknowledgments ("ok", "got it", "sure") ──
  if (AFFIRMATIVES.some(a => lower === a || lower === a + '.' || lower === a + '!')) {
    if (conversation.unknownCount > 0) await resetUnknownCount(conversation.id);
    return { message: T(lang, 'youreWelcome'), englishMessage: TEN('youreWelcome') };
  }

  // ── 3. Check-in / Check-out info ──
  if (INFO_KEYWORDS.checkinout.some(k => lower.includes(k))) {
    const hotel = await prisma.hotel.findUnique({ where: { id: hotelId } });
    const timingVars = { checkIn: hotel?.checkInTime || '2:00 PM', checkOut: hotel?.checkOutTime || '12:00 PM' };
    return {
      message: T(lang, 'hotelTimings', timingVars),
      englishMessage: TEN('hotelTimings', timingVars),
    };
  }

  // ── 4. WiFi ──
  if (INFO_KEYWORDS.wifi.some(k => lower.includes(k))) {
    const wifi = await prisma.amenity.findFirst({ where: { hotelId, name: { contains: 'WiFi' } } });
    if (wifi?.notes) return { message: T(lang, 'wifiDetails', { notes: wifi.notes }), englishMessage: TEN('wifiDetails', { notes: wifi.notes }) };
    return { message: T(lang, 'wifiNoDetails'), englishMessage: TEN('wifiNoDetails') };
  }

  // ── 5. Front desk contact ──
  if (INFO_KEYWORDS.frontdesk.some(k => lower.includes(k))) {
    const hotel = await prisma.hotel.findUnique({ where: { id: hotelId } });
    const phone = hotel?.frontDeskNumber || hotel?.phone || '';
    return {
      message: T(lang, 'frontDesk', { phone }),
      englishMessage: TEN('frontDesk', { phone }),
    };
  }

  // ── 5b. Pending amenity booking — awaiting time selection ──
  if (pendingBooking && pendingBooking.step === 'awaiting_time') {
    const isTomorrow = lower.includes('tomorrow') || lower.includes('kal');
    const parsed = parseTimeFromMessage(lower);

    if (parsed) {
      const { hour } = parsed;
      const hourSlot = `${String(hour).padStart(2, '0')}:00`;
      const endKey = `${String(hour + 1).padStart(2, '0')}:00`;
      const validSlots = isTomorrow ? pendingBooking.tomorrowSlots : pendingBooking.todaySlots;

      if (!validSlots.includes(hourSlot)) {
        const slotList = validSlots.join(', ');
        return { message: T(lang, 'amenitySlotUnavailable', { slots: slotList }), englishMessage: TEN('amenitySlotUnavailable', { slots: slotList }) };
      }

      await clearFlowState(conversation.id);

      const dayLabel = isTomorrow ? 'Tomorrow' : 'Today';
      const dateStr = format(isTomorrow ? addDays(new Date(), 1) : new Date(), 'dd MMM yyyy');
      const details = `${pendingBooking.amenityLabel} — ${dayLabel} (${dateStr}) — ${hourSlot} to ${endKey}`;

      const request = await createServiceRequest(hotelId, session, pendingBooking.serviceType, true, details);

      await prisma.notification.create({
        data: {
          hotelId,
          type: 'new_request',
          title: `${pendingBooking.amenityLabel} Booking — Room ${roomNumber}`,
          body: `${session.guestName}: ${details}`,
          relatedEntityType: 'serviceRequest',
          relatedEntityId: request.id,
        },
      });
      emitToHotel(hotelId, 'new_request', { roomNumber, type: pendingBooking.serviceType });

      const amenityBookedVars = { emoji: pendingBooking.emoji, amenity: pendingBooking.amenityLabel, day: dayLabel, date: dateStr, start: hourSlot, end: endKey };
      return {
        message: T(lang, 'amenityBooked', amenityBookedVars),
        englishMessage: TEN('amenityBooked', amenityBookedVars),
        requestCreated: request,
      };
    }

    // Didn't understand — re-show slots
    const todayList = pendingBooking.todaySlots.length > 0 ? pendingBooking.todaySlots.join('  |  ') : '_No more slots today_';
    const tomorrowList = pendingBooking.tomorrowSlots.join('  |  ');
    return {
      message: T(lang, 'amenityTimePrompt', { today: todayList, tomorrow: tomorrowList }),
      englishMessage: TEN('amenityTimePrompt', { today: todayList, tomorrow: tomorrowList }),
    };
  }

  // ── 5b-1. Table reservation — show restaurant list ──
  const TABLE_RESERVATION_TRIGGERS = [
    'table reservation', 'book a table', 'reserve a table', 'table booking',
    'restaurant booking', 'book table', 'reserve table',
    'i would like to make a table reservation',
  ];
  if (TABLE_RESERVATION_TRIGGERS.some(t => lower.includes(t))) {
    const restaurants = await prisma.amenity.findMany({
      where: {
        hotelId,
        isAvailable: true,
        OR: [
          { name: { contains: 'restaurant', mode: 'insensitive' } },
          { name: { contains: 'dining', mode: 'insensitive' } },
          { name: { contains: 'café', mode: 'insensitive' } },
          { name: { contains: 'cafe', mode: 'insensitive' } },
          { name: { contains: 'bar', mode: 'insensitive' } },
          { name: { contains: 'grill', mode: 'insensitive' } },
          { name: { contains: 'brasserie', mode: 'insensitive' } },
        ],
      },
    });

    if (restaurants.length === 0) {
      return { message: T(lang, 'noRestaurants'), englishMessage: TEN('noRestaurants') };
    }

    const buttons = restaurants.map(r => ({
      label: `🍽️ ${r.name}`,
      value: `restaurant_book:${r.id}:${r.name}`,
    }));

    return {
      message: T(lang, 'selectRestaurant'),
      englishMessage: TEN('selectRestaurant'),
      buttons,
    };
  }

  // ── 5c. Amenity booking intent — show available slots ──
  const bookingIntent = detectAmenityBookingIntent(lower);
  if (bookingIntent) {
    const amenityRecord = await prisma.amenity.findFirst({
      where: { hotelId, name: { contains: bookingIntent.dbSearch, mode: 'insensitive' }, isAvailable: true },
    });

    let openHour = bookingIntent.defaultOpen;
    let closeHour = bookingIntent.defaultClose;
    if (amenityRecord?.openingTime) {
      const oh = parseInt(amenityRecord.openingTime.split(':')[0]);
      if (!isNaN(oh)) openHour = oh;
    }
    if (amenityRecord?.closingTime) {
      const ch = parseInt(amenityRecord.closingTime.split(':')[0]);
      if (!isNaN(ch)) closeHour = ch;
    }

    const currentHour = new Date().getHours();
    const todaySlots = generateHourlySlots(openHour, closeHour).filter(s => parseInt(s) > currentHour);
    const tomorrowSlots = generateHourlySlots(openHour, closeHour);

    await setFlowState(conversation.id, 'amenity_booking', {
      step: 'awaiting_time',
      amenityLabel: bookingIntent.label,
      amenityDbSearch: bookingIntent.dbSearch,
      serviceType: bookingIntent.serviceType,
      emoji: bookingIntent.emoji,
      todaySlots,
      tomorrowSlots,
    });

    const todayLine = todaySlots.length > 0 ? todaySlots.join('  |  ') : '_No more slots today_';
    const tomorrowLine = tomorrowSlots.join('  |  ');
    const amenitySlotsVars = { emoji: bookingIntent.emoji, amenity: bookingIntent.label, today: todayLine, tomorrow: tomorrowLine };

    return {
      message: T(lang, 'amenitySlots', amenitySlotsVars),
      englishMessage: TEN('amenitySlots', amenitySlotsVars),
    };
  }

  // ── 6. Amenity timings ──
  const matchedAmenityKw = AMENITY_KEYWORDS.find(k => lower.includes(k));
  if (matchedAmenityKw) {
    const amenities = await prisma.amenity.findMany({ where: { hotelId } });
    const specificAmenityKws = ['pool', 'swimming', 'spa', 'gym', 'fitness', 'restaurant', 'parking', 'lounge', 'bar', 'rooftop', 'business center'];
    const specificMatch = specificAmenityKws.find(k => lower.includes(k));
    if (specificMatch) {
      const found = amenities.find(a => a.name.toLowerCase().includes(specificMatch));
      if (found) {
        // Build both guest-facing (localized) and staff-facing (English) versions
        const namePrefix = `**${found.name}**\n`; // name is from DB (English)
        let msg = namePrefix;
        let enMsg = namePrefix;
        if (!found.isAvailable) {
          msg += T(lang, 'amenityUnavailable');
          enMsg += TEN('amenityUnavailable');
        } else {
          if (found.openingTime && found.closingTime) {
            msg += T(lang, 'amenityOpen', { open: found.openingTime, close: found.closingTime }) + '\n';
            enMsg += TEN('amenityOpen', { open: found.openingTime, close: found.closingTime }) + '\n';
          }
          if (found.notes) {
            msg += `📝 ${found.notes}`; // notes are hotel-configured (English), shown as-is
            enMsg += `📝 ${found.notes}`;
          }
        }
        return { message: msg, englishMessage: enMsg };
      }
    }
    const available = amenities.filter(a => a.isAvailable);
    const list = available.map(a =>
      `• **${a.name}**: ${a.openingTime || 'Open'} to ${a.closingTime || 'Close'}${a.notes ? ` — ${a.notes}` : ''}`
    ).join('\n');
    return { message: T(lang, 'allAmenities', { list }), englishMessage: TEN('allAmenities', { list }) };
  }

  // ── 7. Service request detection ──
  const detected = detectServiceIntent(lower);
  if (detected) {
    const { type: serviceType, billable, responseKey: customResponseKey, infoOnly } = detected;

    // infoOnly types (e.g. Early Check-in) are informational — no request is created,
    // guest is redirected to contact front desk directly.
    if (infoOnly) {
      const msg = customResponseKey ? T(lang, customResponseKey) : T(lang, 'requestDefault', { type: serviceType });
      const enMsg = customResponseKey ? TEN(customResponseKey) : TEN('requestDefault', { type: serviceType });
      if (conversation.unknownCount > 0) await resetUnknownCount(conversation.id);
      return { message: msg, englishMessage: enMsg };
    }

    // Create the service request
    const request = await createServiceRequest(hotelId, session, serviceType, billable, content, lang);

    // Step 1 — Immediate "received" ping to guest
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderType: 'hotel',
        content: T(lang, 'requestReceived'),
        englishContent: TEN('requestReceived'),
        originalLanguage: lang,
      },
    });

    // Get service notes if available
    const serviceNameToCheck = serviceType.split('/')[0].split('&')[0].trim();
    const service = await prisma.service.findFirst({
      where: { hotelId, name: { contains: serviceNameToCheck }, isEnabled: true },
    });

    // Step 2 — Confirmation with details
    let confirmMessage = customResponseKey
      ? T(lang, customResponseKey)
      : T(lang, 'requestDefault', { type: serviceType });

    // Build confirmation messages — guest gets localized version, staff gets English via englishContent
    let englishConfirmMessage: string;
    if (!customResponseKey && service?.notes) {
      // Use T() so guest gets localized wrapper; notes from DB stay in English (hotel-configured)
      confirmMessage = T(lang, 'requestWithNotes', { type: serviceType, notes: service.notes });
      englishConfirmMessage = TEN('requestWithNotes', { type: serviceType, notes: service.notes });
    } else {
      englishConfirmMessage = customResponseKey ? TEN(customResponseKey) : TEN('requestDefault', { type: serviceType });
    }

    if (conversation.unknownCount > 0) await resetUnknownCount(conversation.id);
    emitToHotel(hotelId, 'new_request', { roomNumber, type: serviceType });
    return { message: confirmMessage, englishMessage: englishConfirmMessage, requestCreated: request };
  }

  // ── 7b. ETA / "how long" queries ──
  const ETA_KEYWORDS = [
    'how long', 'when will', 'how much time', 'how much longer', 'how soon',
    'when will it', 'when will you', 'when are you', 'when will my',
    'kitna time', 'kitna waqt', 'kab aayenge', 'kab aayega', 'kab milega',
    'kab tak', 'kitni der', 'kitna der', 'abhi tak nahi', 'still waiting',
    'been waiting', 'where is my', 'where is the', 'status of my',
    'any update', 'any eta', 'update on my', 'whats taking', "what's taking",
  ];
  if (ETA_KEYWORDS.some(k => lower.includes(k))) {
    const recentRequest = await prisma.serviceRequest.findFirst({
      where: {
        guestSessionId: session.id,
        status: { in: ['pending', 'in_progress'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (recentRequest) {
      // Look up the service record for timing notes
      const serviceNameToCheck = recentRequest.type.split('/')[0].split('&')[0].trim();
      const service = await prisma.service.findFirst({
        where: { hotelId, name: { contains: serviceNameToCheck }, isEnabled: true },
      });

      if (service?.notes) {
        const etaKnownVars = { type: recentRequest.type, notes: service.notes };
        return { message: T(lang, 'etaKnown', etaKnownVars), englishMessage: TEN('etaKnown', etaKnownVars) };
      }

      const etaKey = recentRequest.status === 'in_progress' ? 'etaInProgress' : 'etaPending';
      return { message: T(lang, etaKey, { type: recentRequest.type }), englishMessage: TEN(etaKey, { type: recentRequest.type }) };
    }

    return { message: T(lang, 'noActiveRequests'), englishMessage: TEN('noActiveRequests') };
  }

  // ── 8. Food ordering ──
  const isFoodRequest = FOOD_KEYWORDS.some(k => lower.includes(k));
  if (isFoodRequest) {
    const menuItems = await prisma.menuItem.findMany({
      where: { hotelId, isAvailable: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    // Try to match specific items mentioned
    const mentionedItems = menuItems.filter(item =>
      lower.includes(item.name.toLowerCase()) ||
      item.name.toLowerCase().split(' ').some(word => word.length > 3 && lower.includes(word))
    );

    if (mentionedItems.length > 0) {
      const itemList = mentionedItems.map(i =>
        `• ${i.name} — ₹${i.price} ${i.isVegetarian ? '🟢' : '🔴'}`
      ).join('\n');
      // Menu item names come from DB (English); template wrapper is translated
      return {
        message: T(lang, 'menuSearch', { items: itemList }),
        englishMessage: TEN('menuSearch', { items: itemList }),
        action: 'show_menu_items',
      };
    }

    // Show by category
    const categories = ['breakfast', 'lunch', 'dinner', 'beverages', 'snacks', 'desserts'];
    const requestedCategory = categories.find(c => lower.includes(c));
    const filteredItems = requestedCategory
      ? menuItems.filter(i => i.category === requestedCategory)
      : menuItems.slice(0, 8);

    const categoryDisplay = requestedCategory || 'popular items';
    const itemList = filteredItems.map(i =>
      `• ${i.name} — ₹${i.price} ${i.isVegetarian ? '🟢' : '🔴'}`
    ).join('\n');

    if (conversation.unknownCount > 0) await resetUnknownCount(conversation.id);
    return {
      message: T(lang, 'menuCategory', { category: categoryDisplay, items: itemList }),
      englishMessage: TEN('menuCategory', { category: categoryDisplay, items: itemList }),
      action: 'open_menu',
    };
  }

  // ── 9. Fallback / Escalation ──

  // 9a. Explicit escalation request — guest directly asked for front desk or human
  const isExplicitEscalation = EXPLICIT_ESCALATION_TRIGGERS.some(t => lower === t || lower.includes(t));
  if (isExplicitEscalation) {
    if (conversation.unknownCount > 0) await resetUnknownCount(conversation.id);
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { hasEscalation: true },
    });
    await prisma.notification.create({
      data: {
        hotelId,
        type: 'escalation',
        title: `Front Desk Requested — Room ${roomNumber}`,
        body: `${session.guestName} requested to speak with front desk.`,
        relatedEntityType: 'conversation',
        relatedEntityId: conversation.id,
      },
    });
    emitToHotel(hotelId, 'escalation', { roomNumber });
    return { message: T(lang, 'escalated'), englishMessage: TEN('escalated'), escalated: true };
  }

  // 9b. Two-step fallback for genuinely unrecognised messages (persisted in DB)
  const currentCount = await incrementUnknownCount(conversation.id);

  if (currentCount === 1) {
    // First unknown — try Claude before falling back to canned clarify
    const llmReply = await askClaudeForGuest(content, {
      hotelName: session.hotel.name,
      guestName: session.guestName,
      roomNumber,
      lang,
      amenities: BOOKABLE_AMENITIES.map(a => a.label),
      serviceTypes: SERVICE_KEYWORDS.filter(s => !s.infoOnly).map(s => s.type),
    });

    if (llmReply) {
      // LLM responds in guest's language. englishMessage is the same if English,
      // otherwise mark as needing translation (placeholder until real API is wired).
      return { message: llmReply, englishMessage: translateToEnglish(llmReply, lang) };
    }

    // Claude unavailable or no key — fall back to existing behaviour
    return {
      message: T(lang, 'clarify'),
      englishMessage: TEN('clarify'),
      action: 'show_main_menu',
    };
  }

  // Second unknown — offer front desk button (soft, no notification yet)
  if (currentCount === 2) {
    return {
      message: T(lang, 'offerFrontDesk'),
      englishMessage: TEN('offerFrontDesk'),
      buttons: [
        { label: T(lang, 'btnFrontDesk'), value: '__escalate__' },
      ],
    };
  }

  // Third+ unknown in a row — true escalation
  await resetUnknownCount(conversation.id);
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { hasEscalation: true },
  });
  await prisma.notification.create({
    data: {
      hotelId,
      type: 'escalation',
      title: `Needs Attention — Room ${roomNumber}`,
      body: `${session.guestName}: "${content}"`,
      relatedEntityType: 'conversation',
      relatedEntityId: conversation.id,
    },
  });
  emitToHotel(hotelId, 'escalation', { roomNumber });
  return { message: T(lang, 'escalated'), englishMessage: TEN('escalated'), escalated: true };
}

// ── Feedback (allows expired sessions — shown at checkout) ────────────────
const verifyGuestTokenAny = async (req: any, res: Response, next: any) => {
  const token = req.headers['x-guest-token'];
  if (!token) return res.status(401).json({ error: 'No guest token' });

  const session = await prisma.guestSession.findUnique({
    where: { token: token as string },
    include: { room: true, hotel: true },
  });

  if (!session || !session.otpVerified) {
    return res.status(401).json({ error: 'Invalid guest session' });
  }

  req.guestSession = session;
  next();
};

router.post('/feedback', verifyGuestTokenAny, async (req: any, res: Response) => {
  try {
    const session = req.guestSession;
    const { overallStay, roomCleanliness, staffService, stayflowRating, comments } = req.body;

    // Basic validation
    const ratings = [overallStay, roomCleanliness, staffService, stayflowRating];
    if (ratings.some(r => typeof r !== 'number' || r < 1 || r > 5 || !Number.isInteger(r))) {
      return res.status(400).json({ error: 'All ratings must be integers between 1 and 5.' });
    }

    // Only one feedback per session
    const existing = await prisma.guestFeedback.findFirst({
      where: { guestSessionId: session.id },
    });
    if (existing) {
      return res.status(409).json({ error: 'Feedback already submitted for this stay.' });
    }

    const feedback = await prisma.guestFeedback.create({
      data: {
        hotelId: session.hotelId,
        guestSessionId: session.id,
        overallStay,
        roomCleanliness,
        staffService,
        stayflowRating,
        comments: comments?.trim().slice(0, 500) || null,
      },
    });

    return res.status(201).json(feedback);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

// Per-room QR session — no OTP needed
router.post('/room-session', async (req: Request, res: Response) => {
  try {
    const { hotelSlug, roomNumber, guestName, preferredLanguage } = req.body;
    if (!hotelSlug || !roomNumber || !guestName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const hotel = await prisma.hotel.findUnique({ where: { slug: hotelSlug } });
    if (!hotel) return res.status(404).json({ error: 'Hotel not found' });

    const room = await prisma.room.findFirst({
      where: { hotelId: hotel.id, roomNumber, isActive: true },
    });
    if (!room) return res.status(404).json({ error: 'Room not found or inactive' });

    // Create guest session — no email, no OTP, just name
    const token = crypto.randomBytes(32).toString('hex');
    const guestSession = await prisma.guestSession.create({
      data: {
        hotelId: hotel.id,
        roomId: room.id,
        guestName: guestName.trim(),
        email: `room-${roomNumber}-${Date.now()}@stayflow.internal`, // placeholder
        checkInDate: new Date(),
        checkOutDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days default
        otpVerified: true,
        token,
        preferredLanguage: preferredLanguage || 'en',
      },
    });

    // Log QR scan
    await prisma.qrScan.create({
      data: { hotelId: hotel.id, source: 'room_qr', deviceType: 'mobile' },
    });

    // Notify front desk
    await prisma.notification.create({
      data: {
        hotelId: hotel.id,
        type: 'new_chat',
        title: `Guest in Room ${roomNumber}`,
        body: `${guestName} has joined the chat from Room ${roomNumber}.`,
        relatedEntityType: 'guestSession',
        relatedEntityId: guestSession.id,
      },
    });

    return res.json({
      success: true,
      guestToken: token,
      guestSession: {
        id: guestSession.id,
        guestName: guestSession.guestName,
        roomNumber,
        hotelName: hotel.name,
        hotelSlug: hotel.slug,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
