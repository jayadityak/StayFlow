import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query;
    const validStatuses = ['placed', 'preparing', 'delivered', 'cancelled'];
    if (status && !validStatuses.includes(status as string)) {
      return res.status(400).json({ error: 'Invalid status filter' });
    }
    const orders = await prisma.order.findMany({
      where: {
        hotelId: req.user!.hotelId,
        ...(status ? { status: status as string } : {}),
      },
      include: {
        room: { select: { roomNumber: true } },
        guestSession: { select: { guestName: true } },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(orders);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id/status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;
    const validStatuses = ['placed', 'preparing', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    await prisma.order.updateMany({
      where: { id: req.params.id, hotelId: req.user!.hotelId },
      data: { status },
    });
    const updated = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { items: true },
    });
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id/acknowledge', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.order.updateMany({
      where: { id: req.params.id, hotelId: req.user!.hotelId },
      data: { frontDeskAcknowledged: true },
    });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
