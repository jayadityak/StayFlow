import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { ROLE_SERVICE_TYPES } from './requests';

const router = Router();

// Notification types visible to non-admin staff
const STAFF_NOTIFICATION_TYPES = ['new_request', 'request_assigned'];

router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { type, unread } = req.query;
    const role = req.user!.role;
    const isAdmin = role === 'admin';
    const roleTypes = !isAdmin ? ROLE_SERVICE_TYPES[role] ?? [] : null;

    // Fetch notifications; for non-admins only request-related types
    const notifications = await prisma.notification.findMany({
      where: {
        hotelId: req.user!.hotelId,
        ...(!isAdmin ? { type: { in: STAFF_NOTIFICATION_TYPES } } : {}),
        ...(type ? { type: type as string } : {}),
        ...(unread === 'true' ? { isRead: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    // For role-based staff, further filter: only show notifications whose
    // linked service request matches their role's service types.
    let filtered = notifications;
    if (roleTypes && roleTypes.length > 0) {
      const SERVICE_REQUEST_TYPES = ['serviceRequest', 'service_request'];
      const requestIds = notifications
        .filter(n => n.relatedEntityType && SERVICE_REQUEST_TYPES.includes(n.relatedEntityType) && n.relatedEntityId)
        .map(n => n.relatedEntityId!);

      if (requestIds.length > 0) {
        const matchingRequests = await prisma.serviceRequest.findMany({
          where: { id: { in: requestIds }, type: { in: roleTypes } },
          select: { id: true },
        });
        const matchingIds = new Set(matchingRequests.map(r => r.id));
        filtered = notifications.filter(
          n => !n.relatedEntityType
            || !SERVICE_REQUEST_TYPES.includes(n.relatedEntityType)
            || matchingIds.has(n.relatedEntityId!)
        );
      }
    }

    return res.json(filtered);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id/read', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.notification.updateMany({
      where: { id: req.params.id, hotelId: req.user!.hotelId },
      data: { isRead: true },
    });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/read-all', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.notification.updateMany({
      where: { hotelId: req.user!.hotelId, isRead: false },
      data: { isRead: true },
    });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
