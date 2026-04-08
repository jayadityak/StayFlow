import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const amenities = await prisma.amenity.findMany({
      where: { hotelId: req.user!.hotelId },
      orderBy: { createdAt: 'asc' },
    });
    return res.json(amenities);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Public endpoint for guest chat
router.get('/public/:hotelSlug', async (req, res) => {
  try {
    const hotel = await prisma.hotel.findUnique({ where: { slug: req.params.hotelSlug } });
    if (!hotel) return res.status(404).json({ error: 'Hotel not found' });
    const amenities = await prisma.amenity.findMany({
      where: { hotelId: hotel.id },
      orderBy: { name: 'asc' },
    });
    return res.json(amenities);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

const amenitySchema = z.object({
  name: z.string().min(1),
  isAvailable: z.boolean().optional(),
  openingTime: z.string().optional().nullable(),
  closingTime: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = amenitySchema.parse(req.body);
    const amenity = await prisma.amenity.create({
      data: { hotelId: req.user!.hotelId, ...data },
    });
    return res.status(201).json(amenity);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = amenitySchema.partial().parse(req.body);
    await prisma.amenity.updateMany({
      where: { id: req.params.id, hotelId: req.user!.hotelId },
      data,
    });
    const updated = await prisma.amenity.findUnique({ where: { id: req.params.id } });
    return res.json(updated);
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Validation error' });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.amenity.deleteMany({
      where: { id: req.params.id, hotelId: req.user!.hotelId },
    });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
