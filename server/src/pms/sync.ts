import { getPmsProvider } from './index';
import prisma from '../lib/prisma';
import crypto from 'crypto';
import { emitToHotel } from '../lib/sse';

export async function syncReservations(hotelId: string): Promise<{ created: number; updated: number; errors: string[] }> {
  const provider = getPmsProvider(hotelId);
  if (!provider) return { created: 0, updated: 0, errors: ['No PMS provider configured'] };

  const inHouse = await provider.getInHouseGuests();
  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const reservation of inHouse) {
    try {
      const room = await prisma.room.findFirst({
        where: { hotelId, roomNumber: reservation.roomNumber },
      });
      if (!room) { errors.push(`Room ${reservation.roomNumber} not found`); continue; }

      const existing = await prisma.guestSession.findFirst({
        where: {
          hotelId,
          roomId: room.id,
          guestName: `${reservation.guestFirstName} ${reservation.guestLastName}`,
          source: 'pms',
        },
      });

      if (existing) {
        await prisma.guestSession.update({
          where: { id: existing.id },
          data: { checkOutDate: new Date(reservation.departureDate) },
        });
        updated++;
      } else {
        const token = `pms-${crypto.randomBytes(16).toString('hex')}`;
        await prisma.guestSession.create({
          data: {
            hotelId,
            roomId: room.id,
            guestName: `${reservation.guestFirstName} ${reservation.guestLastName}`,
            email: reservation.email || `${reservation.confirmationNumber}@pms.sync`,
            phone: (reservation as any).phone || null,
            checkInDate:  new Date(reservation.arrivalDate),
            checkOutDate: new Date(reservation.departureDate),
            otpVerified: true,
            token,
            source: 'pms',
            preferredLanguage: 'en',
          },
        });
        created++;
      }
    } catch (err: any) {
      errors.push(`${reservation.confirmationNumber}: ${err.message}`);
    }
  }

  if (created > 0) emitToHotel(hotelId, 'pms:sync', { created, updated });
  return { created, updated, errors };
}
