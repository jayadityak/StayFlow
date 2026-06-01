import { PmsProvider } from './types';
import { MockOperaProvider } from './providers/mock-opera';
import prisma from '../lib/prisma';

const providers = new Map<string, PmsProvider>();

export async function initializePmsProviders(): Promise<void> {
  const connections = await prisma.pmsConnection.findMany({
    where: { isActive: true },
  });

  for (const conn of connections) {
    if (conn.provider === 'mock-opera') {
      const provider = new MockOperaProvider(conn.hotelId, conn.hotelCode);
      await provider.initialize();
      providers.set(conn.hotelId, provider);
      console.log(`✓ PMS connected: ${conn.provider} for hotel ${conn.hotelCode}`);
    }
  }
}

export function getPmsProvider(hotelId: string): PmsProvider | null {
  return providers.get(hotelId) || null;
}
