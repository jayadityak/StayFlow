import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const services = await prisma.service.findMany({
      where: { hotelId: req.user!.hotelId },
      orderBy: { createdAt: 'asc' },
    });
    return res.json(services);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Public endpoint for guest chat
router.get('/public/:hotelSlug', async (req, res) => {
  try {
    const hotel = await prisma.hotel.findUnique({ where: { slug: req.params.hotelSlug } });
    if (!hotel) return res.status(404).json({ error: 'Hotel not found' });
    const services = await prisma.service.findMany({
      where: { hotelId: hotel.id, isEnabled: true },
      orderBy: { name: 'asc' },
    });
    return res.json(services);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

const serviceSchema = z.object({
  name: z.string().min(1),
  isEnabled: z.boolean().optional(),
  openingTime: z.string().optional().nullable(),
  closingTime: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  isBillable: z.boolean().optional(),
});

router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = serviceSchema.parse(req.body);
    const service = await prisma.service.create({
      data: { hotelId: req.user!.hotelId, ...data },
    });
    return res.status(201).json(service);
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Validation error', details: err.errors });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = serviceSchema.partial().parse(req.body);
    await prisma.service.updateMany({
      where: { id: req.params.id, hotelId: req.user!.hotelId },
      data,
    });
    const updated = await prisma.service.findUnique({ where: { id: req.params.id } });
    return res.json(updated);
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Validation error' });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.service.deleteMany({
      where: { id: req.params.id, hotelId: req.user!.hotelId },
    });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
