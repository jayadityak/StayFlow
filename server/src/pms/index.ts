import { PmsProvider } from './types';
import { MockOperaProvider } from './providers/mock-opera';
import { HotelogixProvider } from './providers/hotelogix';
import prisma from '../lib/prisma';

// One provider instance per hotel, keyed by hotelId.
// Populated on server startup from PmsConnection records in the DB.
const providers = new Map<string, PmsProvider>();

export async function initializePmsProviders(): Promise<void> {
  const connections = await prisma.pmsConnection.findMany({
    where: { isActive: true },
  });

  for (const conn of connections) {
    // ── Mock Opera (used for demos and testing) ──────────────────
    if (conn.provider === 'mock-opera') {
      const provider = new MockOperaProvider(conn.hotelId, conn.hotelCode);
      await provider.initialize();
      providers.set(conn.hotelId, provider);
      console.log(`✓ PMS connected: ${conn.provider} for hotel ${conn.hotelCode}`);
    }

    // ── Hotelogix (real PMS — requires credentials from Hotelogix) ──
    // To activate: create a PmsConnection row with provider='hotelogix'
    // and store credentials in the config JSON column (or env vars).
    // For now credentials are read from environment variables.
    if (conn.provider === 'hotelogix') {
      const provider = new HotelogixProvider({
        hotelCode:      conn.hotelCode,
        consumerSecret: process.env.HOTELOGIX_CONSUMER_SECRET ?? '',
        accessSecret:   process.env.HOTELOGIX_ACCESS_SECRET ?? '',
      });
      providers.set(conn.hotelId, provider);
      console.log(`✓ PMS connected: hotelogix for hotel ${conn.hotelCode}`);
    }
  }
}

export function getPmsProvider(hotelId: string): PmsProvider | null {
  return providers.get(hotelId) || null;
}
