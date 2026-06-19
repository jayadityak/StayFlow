import { Router, Response } from 'express';
import multer from 'multer';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Parse a CSV buffer into rows. Handles CRLF + LF, trims whitespace.
function parseCSV(buffer: Buffer): Record<string, string>[] {
  const text = buffer.toString('utf-8');
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
    return row;
  });
}

// POST /api/import/guests
// CSV columns: room_number, guest_name, phone, email, check_in, check_out
// check_in / check_out: YYYY-MM-DD
router.post('/guests', authenticate, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const rows = parseCSV(req.file.buffer);
    if (rows.length === 0) return res.status(400).json({ error: 'CSV is empty or malformed' });

    const hotelId = req.user!.hotelId;
    const results = { created: 0, skipped: 0, errors: [] as string[] };

    for (const row of rows) {
      try {
        const roomNumber  = row['room_number'];
        const guestName   = row['guest_name'] || row['guest'] || row['name'];
        const phone       = row['phone'] || row['mobile'] || row['phone_number'] || '';
        const email       = row['email'] || `${Date.now()}@csv.import`;
        const checkIn     = row['check_in'] || row['checkin'] || row['check_in_date'];
        const checkOut    = row['check_out'] || row['checkout'] || row['check_out_date'];

        if (!roomNumber || !guestName || !checkIn || !checkOut) {
          results.errors.push(`Row skipped — missing required field: ${JSON.stringify(row)}`);
          results.skipped++;
          continue;
        }

        const room = await prisma.room.findFirst({ where: { hotelId, roomNumber } });
        if (!room) {
          results.errors.push(`Room ${roomNumber} not found`);
          results.skipped++;
          continue;
        }

        const checkInDate  = new Date(checkIn);
        const checkOutDate = new Date(checkOut);
        if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
          results.errors.push(`Invalid dates for room ${roomNumber}`);
          results.skipped++;
          continue;
        }

        // Upsert: if an active session already exists for this room+guest, skip
        const existing = await prisma.guestSession.findFirst({
          where: {
            hotelId,
            roomId: room.id,
            guestName,
            checkOutDate: { gte: new Date() },
          },
        });

        if (existing) {
          results.skipped++;
          continue;
        }

        await prisma.guestSession.create({
          data: {
            hotelId,
            roomId: room.id,
            guestName,
            phone: phone || null,
            email,
            checkInDate,
            checkOutDate,
            source: 'csv',
            otpVerified: true,
          },
        });

        results.created++;
      } catch (rowErr: any) {
        results.errors.push(rowErr.message);
        results.skipped++;
      }
    }

    return res.json(results);
  } catch (err) {
    console.error('[import]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/import/template — download a sample CSV
router.get('/template', authenticate, (_req: AuthRequest, res: Response) => {
  const csv = [
    'room_number,guest_name,phone,email,check_in,check_out',
    '101,Rahul Sharma,+919876543210,rahul@example.com,2026-06-18,2026-06-21',
    '102,Priya Patel,+919123456789,priya@example.com,2026-06-18,2026-06-20',
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="stayflow_import_template.csv"');
  return res.send(csv);
});

export default router;
