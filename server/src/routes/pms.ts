import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getPmsProvider } from '../pms';
import { syncReservations } from '../pms/sync';
import { format } from 'date-fns';
import prisma from '../lib/prisma';

const router = Router();

router.get('/status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const provider = getPmsProvider(req.user!.hotelId);
    if (!provider) {
      return res.json({ connected: false, provider: null, message: 'No PMS configured' });
    }

    const health = await provider.healthCheck();
    const connection = await prisma.pmsConnection.findUnique({
      where: { hotelId: req.user!.hotelId },
    });

    return res.json({
      connected: health.ok,
      provider: provider.name,
      message: health.message,
      lastSyncAt: connection?.lastSyncAt,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/arrivals', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const provider = getPmsProvider(req.user!.hotelId);
    if (!provider) return res.status(404).json({ error: 'No PMS configured' });

    const date = (req.query.date as string) || format(new Date(), 'yyyy-MM-dd');
    const arrivals = await provider.getArrivals(date);
    return res.json(arrivals);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/departures', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const provider = getPmsProvider(req.user!.hotelId);
    if (!provider) return res.status(404).json({ error: 'No PMS configured' });

    const date = (req.query.date as string) || format(new Date(), 'yyyy-MM-dd');
    const departures = await provider.getDepartures(date);
    return res.json(departures);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/in-house', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const provider = getPmsProvider(req.user!.hotelId);
    if (!provider) return res.status(404).json({ error: 'No PMS configured' });

    const guests = await provider.getInHouseGuests();
    return res.json(guests);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/sync/reservations', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Admin only' });
    }

    const result = await syncReservations(req.user!.hotelId);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
