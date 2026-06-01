import { PmsProvider, PmsReservation } from '../types';
import prisma from '../../lib/prisma';
import { format, addDays, subDays } from 'date-fns';

const GUEST_NAMES = [
  { first: 'Aarav', last: 'Sharma' },
  { first: 'Priya', last: 'Patel' },
  { first: 'Rohan', last: 'Mehta' },
  { first: 'Ananya', last: 'Gupta' },
  { first: 'Vikram', last: 'Malhotra' },
  { first: 'Neha', last: 'Reddy' },
  { first: 'Arjun', last: 'Singh' },
  { first: 'Kavya', last: 'Nair' },
  { first: 'Rahul', last: 'Iyer' },
  { first: 'Meera', last: 'Joshi' },
  { first: 'Aditya', last: 'Kumar' },
  { first: 'Ishaan', last: 'Bhat' },
  { first: 'Diya', last: 'Verma' },
  { first: 'Siddharth', last: 'Rao' },
  { first: 'Tara', last: 'Choudhury' },
];

const RATE_CODES = ['BAR', 'CORP', 'PKG', 'GOVT', 'OTA'];
const VIP_STATUSES = [null, null, null, 'VIP', 'VVIP'];
const SPECIAL_REQUESTS = [
  null,
  'Late check-in after 10 PM',
  'Extra pillows, hypoallergenic',
  'Airport pickup required',
  'Anniversary celebration — cake + flowers',
  'High floor preferred, non-smoking',
  'Early check-in if possible',
  null,
  'Wheelchair accessible room needed',
  null,
];

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

export class MockOperaProvider implements PmsProvider {
  readonly name = 'mock-opera';
  private hotelId: string;
  private hotelCode: string;
  private rooms: { roomNumber: string; roomType: string }[] = [];

  constructor(hotelId: string, hotelCode: string) {
    this.hotelId = hotelId;
    this.hotelCode = hotelCode;
  }

  async initialize(): Promise<void> {
    const rooms = await prisma.room.findMany({
      where: { hotelId: this.hotelId, isActive: true },
      select: { roomNumber: true, roomType: true },
      orderBy: { roomNumber: 'asc' },
    });
    this.rooms = rooms;
  }

  async healthCheck(): Promise<{ ok: boolean; message: string }> {
    return { ok: true, message: `Mock Opera PMS connected — ${this.hotelCode} (${this.rooms.length} rooms)` };
  }

  private generateReservation(roomIdx: number, arrivalDate: Date, stayDays: number, status: PmsReservation['status']): PmsReservation {
    const room = this.rooms[roomIdx % this.rooms.length];
    const guest = GUEST_NAMES[roomIdx % GUEST_NAMES.length];
    const rand = seededRandom(roomIdx + arrivalDate.getDate());

    const rateIdx = Math.floor(rand() * RATE_CODES.length);
    const vipIdx = Math.floor(rand() * VIP_STATUSES.length);
    const reqIdx = Math.floor(rand() * SPECIAL_REQUESTS.length);

    const baseRate: Record<string, number> = { standard: 5500, deluxe: 8500, suite: 14000, villa: 22000 };

    return {
      confirmationNumber: `RESV-${this.hotelCode}-${String(100000 + roomIdx * 7 + arrivalDate.getDate() * 13).slice(-6)}`,
      guestFirstName: guest.first,
      guestLastName: guest.last,
      email: `${guest.first.toLowerCase()}.${guest.last.toLowerCase()}@gmail.com`,
      phone: `+91 98${String(10000000 + roomIdx * 12345).slice(-8)}`,
      roomNumber: room.roomNumber,
      roomType: room.roomType,
      arrivalDate: format(arrivalDate, 'yyyy-MM-dd'),
      departureDate: format(addDays(arrivalDate, stayDays), 'yyyy-MM-dd'),
      status,
      adults: Math.floor(rand() * 2) + 1,
      children: Math.floor(rand() * 2),
      rateCode: RATE_CODES[rateIdx],
      rateAmount: baseRate[room.roomType] || 5500,
      vipStatus: VIP_STATUSES[vipIdx] ?? undefined,
      specialRequests: SPECIAL_REQUESTS[reqIdx] ?? undefined,
    };
  }

  async getArrivals(date: string): Promise<PmsReservation[]> {
    const targetDate = new Date(date);
    const arrivals: PmsReservation[] = [];
    const occupancyTarget = Math.floor(this.rooms.length * 0.3);

    for (let i = 0; i < occupancyTarget; i++) {
      const stayDays = 2 + (i % 4);
      arrivals.push(this.generateReservation(i + targetDate.getDate(), targetDate, stayDays, 'RESERVED'));
    }

    return arrivals;
  }

  async getDepartures(date: string): Promise<PmsReservation[]> {
    const targetDate = new Date(date);
    const departures: PmsReservation[] = [];
    const count = Math.floor(this.rooms.length * 0.25);

    for (let i = 0; i < count; i++) {
      const stayDays = 2 + (i % 3);
      const arrival = subDays(targetDate, stayDays);
      departures.push(this.generateReservation(i + 50 + targetDate.getDate(), arrival, stayDays, 'CHECKED_IN'));
    }

    return departures;
  }

  async getInHouseGuests(): Promise<PmsReservation[]> {
    const today = new Date();
    const guests: PmsReservation[] = [];
    const occupancy = Math.floor(this.rooms.length * 0.7);

    for (let i = 0; i < occupancy; i++) {
      const stayDays = 2 + (i % 5);
      const daysIn = i % stayDays;
      const arrival = subDays(today, daysIn);
      guests.push(this.generateReservation(i + 20, arrival, stayDays, 'CHECKED_IN'));
    }

    return guests;
  }

  async getReservation(confirmationNumber: string): Promise<PmsReservation | null> {
    const inHouse = await this.getInHouseGuests();
    return inHouse.find(r => r.confirmationNumber === confirmationNumber) || null;
  }
}
