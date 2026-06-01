import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getCheckoutBoundary } from '../lib/checkoutUtils';
import { emitToHotel, emitToConversation } from '../lib/sse';
import { translateFromEnglish } from '../lib/translation';

const router = Router();

// Past conversations (checked-out guests or closed conversations)
router.get('/past', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const conversations = await prisma.conversation.findMany({
      where: {
        hotelId: req.user!.hotelId,
        OR: [
          { guestSession: { checkOutDate: { lt: getCheckoutBoundary() } } },
          { status: { not: 'active' } },
        ],
      },
      include: {
        guestSession: { select: { guestName: true, email: true } },
        room: { select: { roomNumber: true, roomType: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { content: true, senderType: true, createdAt: true },
        },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    return res.json(conversations);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const conversations = await prisma.conversation.findMany({
      where: {
        hotelId: req.user!.hotelId,
        status: 'active',
        guestSession: { checkOutDate: { gte: getCheckoutBoundary() } },
      },
      include: {
        guestSession: { select: { guestName: true, email: true } },
        room: { select: { roomNumber: true, roomType: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { content: true, senderType: true, createdAt: true },
        },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return res.json(conversations);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, hotelId: req.user!.hotelId },
      include: {
        guestSession: true,
        room: true,
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!conversation) return res.status(404).json({ error: 'Not found' });
    return res.json(conversation);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/reply', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Content required' });

    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, hotelId: req.user!.hotelId },
      include: { guestSession: { select: { preferredLanguage: true } } },
    });
    if (!conversation) return res.status(404).json({ error: 'Not found' });

    const guestLang = conversation.guestSession?.preferredLanguage || 'en';
    const translatedContent = await translateFromEnglish(content, guestLang);

    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderType: 'staff',
        content: translatedContent,
        englishContent: content,
        originalLanguage: 'en',
      },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    // Real-time: notify the guest that staff replied (include ID for deduplication)
    emitToConversation(conversation.id, 'staff_reply', {
      id: message.id,
      content: translatedContent,
      senderType: 'staff',
      createdAt: message.createdAt,
    });
    // Real-time: notify other staff that this chat was updated
    emitToHotel(req.user!.hotelId, 'message_created', { conversationId: conversation.id });

    return res.json(message);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id/status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;
    const validStatuses = ['active', 'closed', 'escalated'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    await prisma.conversation.updateMany({
      where: { id: req.params.id, hotelId: req.user!.hotelId },
      data: { status },
    });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
