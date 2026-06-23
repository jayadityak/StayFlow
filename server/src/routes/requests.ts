import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getCheckoutBoundary } from '../lib/checkoutUtils';
import { T, TEN } from '../lib/i18n';
import { emitToConversation } from '../lib/sse';

const router = Router();

// Service types each role is responsible for
export const ROLE_SERVICE_TYPES: Record<string, string[]> = {
  housekeeping: [
    'Housekeeping', 'Extra Towels', 'Toiletries', 'Extra Bedding', 'Do Not Disturb',
    'Laundry', 'Iron & Ironing Board', 'Shoe Shine',
    'Maintenance', 'Electrical Issue', 'Plumbing Issue', 'Cooling System Issue',
    'AC / Temperature Issue', 'No Hot Water', 'TV / Entertainment Issue', 'Noise Complaint',
  ],
  frontdesk: [
    'Currency Exchange', 'Limo / Car Service', 'Taxi / Cab', 'Airport Transfer', 'Hotel Shuttle',
    'Late Check-out', 'Early Check-out', 'Luggage Storage',
    'Lost Key Card', 'Lost & Found', 'Bill / Invoice Query',
    'Wake-up Call', 'Doctor / Medical Assistance',
    'Charger / Adapter', 'Stationery', 'Printing / Scanning', 'Meeting Room',
    'Spa Appointment', 'Gym Session', 'Pool Session', 'Tennis Court Booking', 'Rooftop Booking',
  ],
  restaurant: [
    'Restaurant Reservation', 'Water / Beverages', 'Ice Bucket',
    'Minibar Restock', 'Dietary Requirements',
  ],
};

// Get all requests
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query;
    const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
    if (status && !validStatuses.includes(status as string)) {
      return res.status(400).json({ error: 'Invalid status filter' });
    }
    const role = req.user!.role;
    const roleTypes = role !== 'admin' ? ROLE_SERVICE_TYPES[role] ?? [] : null;

    const requests = await prisma.serviceRequest.findMany({
      where: {
        hotelId: req.user!.hotelId,
        // Only show requests from guests within the noon-checkout window
        guestSession: { checkOutDate: { gte: getCheckoutBoundary() } },
        ...(status ? { status: status as string } : {}),
        // Non-admin roles only see their own service types
        ...(roleTypes ? { type: { in: roleTypes } } : {}),
      },
      include: {
        room: { select: { roomNumber: true } },
        guestSession: { select: { guestName: true } },
        assignedTo: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(requests);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update status
router.patch('/:id/status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const existing = await prisma.serviceRequest.findFirst({
      where: { id: req.params.id, hotelId: req.user!.hotelId },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Prevent transitions from terminal states
    if (existing.status === 'completed' || existing.status === 'cancelled') {
      return res.status(400).json({ error: `Cannot change status from ${existing.status}` });
    }

    if (status === 'completed' && !existing.assignedToId) {
      return res.status(400).json({ error: 'Assign a staff member before completing this request.' });
    }

    await prisma.serviceRequest.updateMany({
      where: { id: req.params.id, hotelId: req.user!.hotelId },
      data: { status },
    });
    const updated = await prisma.serviceRequest.findUnique({
      where: { id: req.params.id },
      include: {
        room: { select: { roomNumber: true } },
        guestSession: { select: { guestName: true } },
        assignedTo: { select: { id: true, name: true, role: true } },
      },
    });

    // If completed, send guest a completion message
    if (status === 'completed' && updated) {
      await sendGuestMessage(updated.guestSessionId, 'requestCompleted');
    }

    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update notes
router.patch('/:id/notes', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { staffNotes } = req.body;
    await prisma.serviceRequest.updateMany({
      where: { id: req.params.id, hotelId: req.user!.hotelId },
      data: { staffNotes },
    });
    const updated = await prisma.serviceRequest.findUnique({ where: { id: req.params.id } });
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Assign a request to a staff member
router.patch('/:id/assign', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { staffId } = req.body;

    if (staffId) {
      const staff = await prisma.user.findFirst({
        where: { id: staffId, hotelId: req.user!.hotelId },
      });
      if (!staff) {
        return res.status(400).json({ error: 'Staff member not found' });
      }
    }

    const request = await prisma.serviceRequest.findFirst({
      where: { id: req.params.id, hotelId: req.user!.hotelId },
    });
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const isFirstAssignment = !request.assignedToId && staffId;

    await prisma.serviceRequest.update({
      where: { id: req.params.id },
      data: {
        assignedToId: staffId || null,
        status: staffId ? 'in_progress' : 'pending',
      },
    });

    const updated = await prisma.serviceRequest.findUnique({
      where: { id: req.params.id },
      include: {
        room: { select: { roomNumber: true } },
        guestSession: { select: { guestName: true } },
        assignedTo: { select: { id: true, name: true, role: true } },
      },
    });

    // Send guest a message when first assigned
    if (isFirstAssignment && updated) {
      await sendGuestMessage(updated.guestSessionId, 'requestAssigned');

      // Create a notification visible to all staff
      await prisma.notification.create({
        data: {
          hotelId: req.user!.hotelId,
          type: 'request_assigned',
          title: 'Staff Assigned to Request',
          body: `${updated.assignedTo!.name} has been assigned to a ${updated.type} request in Room ${updated.room.roomNumber} (${updated.guestSession.guestName}).`,
          relatedEntityType: 'service_request',
          relatedEntityId: updated.id,
        },
      });
    }

    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all staff for this hotel
router.get('/staff', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const staff = await prisma.user.findMany({
      where: { hotelId: req.user!.hotelId, role: { not: 'admin' } },
      select: {
        id: true,
        name: true,
        role: true,
        assignedRequests: {
          where: { status: { in: ['pending', 'in_progress'] } },
          select: { id: true, type: true, status: true, room: { select: { roomNumber: true } } },
        },
      },
      orderBy: { name: 'asc' },
    });
    return res.json(staff);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper: send an automatic hotel message (i18n key) to guest's active conversation
async function sendGuestMessage(guestSessionId: string, msgKey: string) {
  try {
    const [conversation, session] = await Promise.all([
      prisma.conversation.findFirst({
        where: { guestSessionId, status: 'active' },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.guestSession.findUnique({ where: { id: guestSessionId }, select: { preferredLanguage: true } }),
    ]);
    if (!conversation) return;

    const lang = session?.preferredLanguage || 'en';
    const content = T(lang, msgKey);
    const englishContent = TEN(msgKey);
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderType: 'hotel',
        content,
        englishContent,
        originalLanguage: lang,
        inputType: 'text',
      },
    });
    emitToConversation(conversation.id, 'hotel_message', { conversationId: conversation.id });
  } catch (err) {
    console.error('Failed to send guest message:', err);
  }
}

export default router;
