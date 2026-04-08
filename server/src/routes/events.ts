import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { addSSEClient } from '../lib/sse';

const router = Router();

/**
 * GET /api/events
 * Server-Sent Events stream for real-time staff dashboard updates.
 * Authenticated via Authorization: Bearer <token> header (fetch-based client, not EventSource).
 */
router.get('/', authenticate, (req: AuthRequest, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx/proxy buffering
  res.flushHeaders();

  // Confirm connection to client
  res.write('event: connected\ndata: {}\n\n');

  const hotelId = req.user!.hotelId;
  const cleanup = addSSEClient(hotelId, res);

  // Keep-alive ping every 25s (below most proxy 30s idle timeouts)
  const ping = setInterval(() => {
    try {
      res.write(':ping\n\n');
    } catch {
      clearInterval(ping);
      cleanup();
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(ping);
    cleanup();
  });
});

export default router;
