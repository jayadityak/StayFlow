import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/overview', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.user!.hotelId;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalScans,
      totalChats,
      activeChats,
      pendingRequests,
      openOrders,
      unreadNotifications,
      totalRooms,
      activeGuests,
      requestsByType,
      ordersByCategory,
      recentOrders,
      weeklyScans,
      billableEvents,
      completedRequests,
    ] = await Promise.all([
      prisma.qrScan.count({ where: { hotelId } }),
      prisma.conversation.count({ where: { hotelId } }),
      prisma.conversation.count({ where: { hotelId, status: 'active' } }),
      prisma.serviceRequest.count({ where: { hotelId, status: 'pending' } }),
      prisma.order.count({ where: { hotelId, status: { in: ['placed', 'preparing'] } } }),
      prisma.notification.count({ where: { hotelId, isRead: false } }),
      prisma.room.count({ where: { hotelId, isActive: true } }),
      prisma.guestSession.count({
        where: { hotelId, otpVerified: true, checkOutDate: { gte: now } },
      }),
      prisma.serviceRequest.groupBy({
        by: ['type'],
        where: { hotelId, createdAt: { gte: monthAgo } },
        _count: true,
        orderBy: { _count: { type: 'desc' } },
        take: 8,
      }),
      prisma.orderItem.groupBy({
        by: ['itemNameSnapshot'],
        where: { order: { hotelId, createdAt: { gte: monthAgo } } },
        _count: true,
        orderBy: { _count: { itemNameSnapshot: 'desc' } },
        take: 6,
      }),
      prisma.order.findMany({
        where: { hotelId, createdAt: { gte: weekAgo } },
        include: { room: { select: { roomNumber: true } }, items: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.qrScan.groupBy({
        by: ['scannedAt'],
        where: { hotelId, scannedAt: { gte: weekAgo } },
        _count: true,
      }),
      prisma.order.count({
        where: { hotelId, isBillable: true, createdAt: { gte: monthAgo } },
      }),
      prisma.serviceRequest.findMany({
        where: { hotelId, status: { in: ['completed', 'fulfilled'] }, createdAt: { gte: monthAgo } },
        select: { type: true, createdAt: true, updatedAt: true },
      }),
    ]);

    // Build daily scans for chart (last 7 days)
    const dailyScans: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const key = d.toISOString().split('T')[0];
      dailyScans[key] = 0;
    }
    weeklyScans.forEach((s: any) => {
      const key = new Date(s.scannedAt).toISOString().split('T')[0];
      if (dailyScans[key] !== undefined) dailyScans[key] += s._count;
    });

    // Compute average resolution time (minutes) per service type
    const delayMap: Record<string, { total: number; count: number }> = {};
    (completedRequests as any[]).forEach((r: any) => {
      const mins = (new Date(r.updatedAt).getTime() - new Date(r.createdAt).getTime()) / 60000;
      if (!delayMap[r.type]) delayMap[r.type] = { total: 0, count: 0 };
      delayMap[r.type].total += mins;
      delayMap[r.type].count += 1;
    });
    const delayedByType = Object.entries(delayMap)
      .map(([type, { total, count }]) => ({ type, avgMinutes: Math.round(total / count) }))
      .sort((a, b) => b.avgMinutes - a.avgMinutes)
      .slice(0, 7);

    return res.json({
      summary: {
        totalScans,
        totalChats,
        activeChats,
        pendingRequests,
        openOrders,
        unreadNotifications,
        totalRooms,
        activeGuests,
        billableEvents,
      },
      charts: {
        requestsByType: requestsByType.map((r: any) => ({ type: r.type, count: r._count })),
        topMenuItems: ordersByCategory.map((o: any) => ({ name: o.itemNameSnapshot, count: o._count })),
        dailyScans: Object.entries(dailyScans).map(([date, count]) => ({ date, count })),
        delayedByType,
      },
      recentOrders,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

// Activity feed endpoint
router.get('/activity', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.user!.hotelId;
    const limit = parseInt(req.query.limit as string) || 20;

    const [recentOrders, recentRequests, recentChats] = await Promise.all([
      prisma.order.findMany({
        where: { hotelId },
        include: { room: { select: { roomNumber: true } }, items: { take: 2 } },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.serviceRequest.findMany({
        where: { hotelId },
        include: { room: { select: { roomNumber: true } }, guestSession: { select: { guestName: true } } },
        orderBy: { updatedAt: 'desc' },
        take: limit,
      }),
      prisma.conversation.findMany({
        where: { hotelId },
        include: {
          room: { select: { roomNumber: true } },
          guestSession: { select: { guestName: true } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),
    ]);

    // Combine and sort by time
    const activities: any[] = [];

    recentOrders.forEach((o: any) => {
      const itemNames = o.items.map((i: any) => i.itemNameSnapshot).join(', ');
      activities.push({
        id: `order-${o.id}`,
        type: 'order',
        icon: 'food',
        roomNumber: o.room.roomNumber,
        message: `Room ${o.room.roomNumber} ordered ${itemNames}`,
        amount: o.totalAmount,
        status: o.status,
        time: o.createdAt,
        entityId: o.id,
      });
    });

    recentRequests.forEach((r: any) => {
      activities.push({
        id: `req-${r.id}`,
        type: 'request',
        icon: 'service',
        roomNumber: r.room.roomNumber,
        message: `Room ${r.room.roomNumber} requested ${r.type}`,
        status: r.status,
        time: r.updatedAt,
        entityId: r.id,
      });
    });

    recentChats.forEach((c: any) => {
      if (c.messages[0]) {
        activities.push({
          id: `chat-${c.id}`,
          type: 'chat',
          icon: 'chat',
          roomNumber: c.room.roomNumber,
          message: `Room ${c.room.roomNumber} (${c.guestSession.guestName}): ${c.messages[0].content.substring(0, 50)}`,
          status: c.status,
          time: c.updatedAt,
          entityId: c.id,
        });
      }
    });

    activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    return res.json(activities.slice(0, limit));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Billing summary across all rooms
router.get('/billing', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.user!.hotelId;

    const pendingOrders = await prisma.order.findMany({
      where: { hotelId, isBillable: true, frontDeskAcknowledged: false, status: { not: 'cancelled' } },
      include: { room: { select: { roomNumber: true, id: true } } },
    });

    // Group by room
    const byRoom: Record<string, { roomNumber: string; roomId: string; total: number }> = {};
    pendingOrders.forEach((o: any) => {
      const key = o.room.roomNumber;
      if (!byRoom[key]) byRoom[key] = { roomNumber: key, roomId: o.room.id, total: 0 };
      byRoom[key].total += o.totalAmount;
    });

    const totalPending = pendingOrders.reduce((sum: number, o: any) => sum + o.totalAmount, 0);
    const topRooms = Object.values(byRoom)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    return res.json({ totalPending, topRooms, orderCount: pendingOrders.length });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Alert counts
router.get('/alerts', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.user!.hotelId;
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);

    const [delayedRequests, pendingOrders, taxiRequests, escalations] = await Promise.all([
      prisma.serviceRequest.count({ where: { hotelId, status: 'pending', createdAt: { lt: thirtyMinAgo } } }),
      prisma.order.count({ where: { hotelId, status: { in: ['placed', 'preparing'] } } }),
      prisma.serviceRequest.count({ where: { hotelId, type: { contains: 'Taxi' }, status: 'pending' } }),
      prisma.conversation.count({ where: { hotelId, hasEscalation: true, status: 'active' } }),
    ]);

    return res.json({ delayedRequests, pendingOrders, taxiRequests, escalations });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});
