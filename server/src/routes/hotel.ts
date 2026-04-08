import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const hotel = await prisma.hotel.findUnique({ where: { id: req.user!.hotelId } });
    return res.json(hotel);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  frontDeskNumber: z.string().optional(),
  supportEmail: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  checkInTime: z.string().optional(),
  checkOutTime: z.string().optional(),
  voiceEnabled: z.boolean().optional(),
  voiceAutoSend: z.boolean().optional(),
  voiceLanguage: z.string().optional(),
});

router.put('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = updateSchema.parse(req.body);
    const hotel = await prisma.hotel.update({
      where: { id: req.user!.hotelId },
      data,
    });
    return res.json(hotel);
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Validation error', details: err.errors });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Public endpoint for guest - includes voice settings
router.get('/public/:slug', async (req, res) => {
  try {
    const hotel = await prisma.hotel.findUnique({
      where: { slug: req.params.slug },
      select: {
        id: true, name: true, slug: true, city: true, state: true,
        checkInTime: true, checkOutTime: true,
        voiceEnabled: true, voiceAutoSend: true, voiceLanguage: true,
      },
    });
    if (!hotel) return res.status(404).json({ error: 'Hotel not found' });
    return res.json(hotel);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
