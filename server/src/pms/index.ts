import { PmsProvider } from './types';

// One provider instance per hotel, keyed by hotelId.
// PMS connections are now configured via environment variables.
// To activate: set HOTELOGIX_HOTEL_ID, HOTELOGIX_HOTEL_CODE,
// HOTELOGIX_CONSUMER_SECRET, and HOTELOGIX_ACCESS_SECRET in .env
const providers = new Map<string, PmsProvider>();

export async function initializePmsProviders(): Promise<void> {
  const hotelId   = process.env.HOTELOGIX_HOTEL_ID;
  const hotelCode = process.env.HOTELOGIX_HOTEL_CODE;

  if (hotelId && hotelCode && process.env.HOTELOGIX_CONSUMER_SECRET) {
    const { HotelogixProvider } = await import('./providers/hotelogix');
    const provider = new HotelogixProvider({
      hotelCode,
      consumerSecret: process.env.HOTELOGIX_CONSUMER_SECRET ?? '',
      accessSecret:   process.env.HOTELOGIX_ACCESS_SECRET ?? '',
    });
    providers.set(hotelId, provider);
    console.log(`✓ PMS connected: hotelogix for hotel ${hotelCode}`);
  }
}

export function getPmsProvider(hotelId: string): PmsProvider | null {
  return providers.get(hotelId) || null;
}
