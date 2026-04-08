import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const hotel = await prisma.hotel.findUnique({
      where: { id: req.user!.hotelId },
      select: { slug: true, name: true },
    });
    if (!hotel) return res.status(404).json({ error: 'Hotel not found' });

    const guestUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/hotel/${hotel.slug}/verify`;

    return res.json({
      hotelSlug: hotel.slug,
      hotelName: hotel.name,
      guestUrl,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
