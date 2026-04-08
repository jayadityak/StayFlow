import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getCheckoutBoundary } from '../lib/checkoutUtils';

const router = Router();

// GET all rooms with full operational data (dashboard)
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const rooms = await prisma.room.findMany({
      where: { hotelId: req.user!.hotelId },
      include: {
        guestSessions: {
          where: { otpVerified: true, checkOutDate: { gte: getCheckoutBoundary() } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, guestName: true, checkInDate: true, checkOutDate: true, email: true },
        },
        conversations: { where: { status: 'active' }, select: { id: true, hasEscalation: true, updatedAt: true } },
        serviceRequests: {
          where: { status: { in: ['pending', 'in_progress'] } },
          select: { id: true, type: true, status: true, isBillable: true, createdAt: true },
        },
        orders: {
          where: { status: { in: ['placed', 'preparing'] } },
          select: { id: true, totalAmount: true, status: true, frontDeskAcknowledged: true, isBillable: true },
        },
      },
      orderBy: [{ floor: 'asc' }, { roomNumber: 'asc' }],
    });

    const enriched = rooms.map(room => {
      const pendingBilling = room.orders
        .filter((o: any) => o.isBillable && !o.frontDeskAcknowledged)
        .reduce((sum: number, o: any) => sum + o.totalAmount, 0);
      const hasDelayed = room.serviceRequests.some((r: any) => {
        const age = (now.getTime() - new Date(r.createdAt).getTime()) / 60000;
        return r.status === 'pending' && age > 30;
      });
      let statusColor = 'green';
      if (room.serviceRequests.length > 0 || room.orders.length > 0) statusColor = 'yellow';
      if (hasDelayed || room.conversations.some((c: any) => c.hasEscalation)) statusColor = 'red';

      return {
        ...room,
        isOccupied: room.guestSessions.length > 0,
        activeGuest: room.guestSessions[0] || null,
        activeChatsCount: room.conversations.length,
        pendingRequestsCount: room.serviceRequests.length,
        pendingOrdersCount: room.orders.length,
        pendingBilling,
        statusColor,
        hasEscalation: room.conversations.some((c: any) => c.hasEscalation),
      };
    });

    return res.json(enriched);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET single room control panel
router.get('/:id/panel', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const room = await prisma.room.findFirst({
      where: { id: req.params.id, hotelId: req.user!.hotelId },
      include: {
        guestSessions: {
          where: { otpVerified: true, checkOutDate: { gte: getCheckoutBoundary() } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        conversations: {
          where: { status: 'active' },
          include: { messages: { orderBy: { createdAt: 'asc' } } },
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
        serviceRequests: {
          where: { status: { not: 'cancelled' } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        orders: {
          where: { status: { not: 'cancelled' } },
          include: { items: true },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!room) return res.status(404).json({ error: 'Room not found' });

    const allOrders = await prisma.order.findMany({
      where: { roomId: room.id, isBillable: true, frontDeskAcknowledged: false, status: { not: 'cancelled' } },
      include: { items: true },
    });

    const foodTotal = allOrders.reduce((sum: number, o: any) => sum + o.totalAmount, 0);
    const billableRequests = await prisma.serviceRequest.findMany({
      where: { roomId: room.id, isBillable: true, status: { not: 'cancelled' } },
      select: { type: true, id: true, status: true },
    });

    return res.json({
      room,
      activeGuest: room.guestSessions[0] || null,
      conversation: room.conversations[0] || null,
      requests: room.serviceRequests,
      orders: room.orders,
      billing: { total: foodTotal, requests: billableRequests, unacknowledgedOrders: allOrders },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Acknowledge all orders for a room
router.post('/:id/acknowledge-all', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.order.updateMany({
      where: { roomId: req.params.id, hotelId: req.user!.hotelId, frontDeskAcknowledged: false },
      data: { frontDeskAcknowledged: true },
    });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Auto-expire checkouts
router.post('/expire-checkouts', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const expiredSessions = await prisma.guestSession.findMany({
      where: { hotelId: req.user!.hotelId, checkOutDate: { lt: now }, otpVerified: true },
    });
    if (expiredSessions.length > 0) {
      const expiredIds = expiredSessions.map((s: any) => s.id);
      await prisma.conversation.updateMany({
        where: { guestSessionId: { in: expiredIds }, status: 'active' },
        data: { status: 'closed' },
      });
    }
    return res.json({ expired: expiredSessions.length });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUBLIC: Get room by hotel slug + room number (for guest QR flow)
router.get('/by-number/:hotelSlug/:roomNumber', async (req, res) => {
  try {
    const hotel = await prisma.hotel.findUnique({ where: { slug: req.params.hotelSlug } });
    if (!hotel) return res.status(404).json({ error: 'Hotel not found' });

    const room = await prisma.room.findFirst({
      where: {
        hotelId: hotel.id,
        roomNumber: req.params.roomNumber,
        isActive: true,
      },
      select: { id: true, roomNumber: true, roomType: true, floor: true, occupancy: true },
    });

    if (!room) return res.status(404).json({ error: 'Room not found' });
    return res.json(room);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUBLIC: Get all active rooms for hotel (old flow fallback)
router.get('/public/:hotelSlug', async (req, res) => {
  try {
    const hotel = await prisma.hotel.findUnique({ where: { slug: req.params.hotelSlug } });
    if (!hotel) return res.status(404).json({ error: 'Hotel not found' });
    const rooms = await prisma.room.findMany({
      where: { hotelId: hotel.id, isActive: true },
      select: { roomNumber: true },
      orderBy: { roomNumber: 'asc' },
    });
    return res.json(rooms);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

const roomSchema = z.object({
  roomNumber: z.string().min(1),
  roomType: z.enum(['standard', 'deluxe', 'suite', 'villa']),
  floor: z.number().int().min(1),
  occupancy: z.number().int().min(1),
  isActive: z.boolean().optional(),
});

router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = roomSchema.parse(req.body);
    const room = await prisma.room.create({ data: { hotelId: req.user!.hotelId, ...data } });
    return res.status(201).json(room);
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'Room number already exists' });
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Validation error', details: err.errors });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = roomSchema.partial().parse(req.body);
    const result = await prisma.room.updateMany({ where: { id: req.params.id, hotelId: req.user!.hotelId }, data });
    if (result.count === 0) return res.status(404).json({ error: 'Room not found' });
    const updated = await prisma.room.findUnique({ where: { id: req.params.id } });
    return res.json(updated);
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Validation error' });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.room.updateMany({ where: { id: req.params.id, hotelId: req.user!.hotelId }, data: { isActive: false } });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
