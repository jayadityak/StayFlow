import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { randomUUID } from 'crypto';
import { sendPasswordResetEmail } from '../lib/email';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is not set');
  return secret;
}

const router = Router();

const signupSchema = z.object({
  hotelName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().min(8),
  city: z.string().min(2),
  state: z.string().min(2),
  hotelType: z.string(),
  totalRooms: z.number().int().positive(),
  adminName: z.string().min(2),
});

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

router.post('/signup', async (req: Request, res: Response) => {
  try {
    const data = signupSchema.parse(req.body);
    
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    let slug = generateSlug(data.hotelName);
    const existingHotel = await prisma.hotel.findUnique({ where: { slug } });
    if (existingHotel) {
      slug = `${slug}-${Date.now()}`;
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const hotel = await prisma.hotel.create({
      data: {
        name: data.hotelName,
        slug,
        email: data.email,
        phone: data.phone,
        city: data.city,
        state: data.state,
        hotelType: data.hotelType,
        totalRooms: data.totalRooms,
      },
    });

    const user = await prisma.user.create({
      data: {
        hotelId: hotel.id,
        name: data.adminName,
        email: data.email,
        passwordHash,
        role: 'admin',
      },
    });

    const token = jwt.sign(
      { userId: user.id },
      getJwtSecret(),
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      hotel: { id: hotel.id, name: hotel.name, slug: hotel.slug },
    });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { hotel: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id },
      getJwtSecret(),
      { expiresIn: '7d' }
    );

    if (!user.hotel) return res.status(500).json({ error: 'Hotel not found for this user' });

    return res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      hotel: { id: user.hotel.id, name: user.hotel.name, slug: user.hotel.slug },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { hotel: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.hotel) return res.status(500).json({ error: 'Hotel not found for this user' });

    return res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      hotel: { id: user.hotel.id, name: user.hotel.name, slug: user.hotel.slug },
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/forgot-password
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const user = await prisma.user.findUnique({ where: { email } });
    // Always return 200 to avoid email enumeration
    if (!user) return res.json({ success: true });

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.otpCode.create({ data: { email, code: token, expiresAt } });

    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${token}`;
    await sendPasswordResetEmail(email, resetUrl);

    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/reset-password
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token and password required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const record = await prisma.otpCode.findFirst({
      where: { code: token, verified: false, expiresAt: { gt: new Date() } },
    });
    if (!record) return res.status(400).json({ error: 'Invalid or expired reset link' });

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.update({ where: { email: record.email }, data: { passwordHash } });
    await prisma.otpCode.update({ where: { id: record.id }, data: { verified: true } });

    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
