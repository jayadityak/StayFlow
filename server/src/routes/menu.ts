import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const category = req.query.category as string | undefined;
    const items = await prisma.menuItem.findMany({
      where: {
        hotelId: req.user!.hotelId,
        ...(category ? { category } : {}),
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    return res.json(items);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Public endpoint for guest chat
router.get('/public/:hotelSlug', async (req, res) => {
  try {
    const hotel = await prisma.hotel.findUnique({ where: { slug: req.params.hotelSlug } });
    if (!hotel) return res.status(404).json({ error: 'Hotel not found' });
    const items = await prisma.menuItem.findMany({
      where: { hotelId: hotel.id, isAvailable: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    return res.json(items);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

const menuItemSchema = z.object({
  name: z.string().min(1),
  category: z.enum(['breakfast', 'lunch', 'dinner', 'beverages', 'snacks', 'desserts']),
  description: z.string().optional().nullable(),
  isVegetarian: z.boolean().optional(),
  price: z.number().positive(),
  isAvailable: z.boolean().optional(),
});

router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = menuItemSchema.parse(req.body);
    const item = await prisma.menuItem.create({
      data: { hotelId: req.user!.hotelId, ...data },
    });
    return res.status(201).json(item);
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Validation error', details: err.errors });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = menuItemSchema.partial().parse(req.body);
    await prisma.menuItem.updateMany({
      where: { id: req.params.id, hotelId: req.user!.hotelId },
      data,
    });
    const updated = await prisma.menuItem.findUnique({ where: { id: req.params.id } });
    return res.json(updated);
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Validation error' });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.menuItem.deleteMany({
      where: { id: req.params.id, hotelId: req.user!.hotelId },
    });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
