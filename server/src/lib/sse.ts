import { Response } from 'express';

interface SSEClient {
  res: Response;
  hotelId: string;
}

interface GuestSSEClient {
  res: Response;
  conversationId: string;
}

// Active SSE connections indexed by hotelId (staff)
const clients = new Set<SSEClient>();
// Active SSE connections indexed by conversationId (guests)
const guestClients = new Set<GuestSSEClient>();

/**
 * Register a new staff SSE client. Returns a cleanup function.
 */
export function addSSEClient(hotelId: string, res: Response): () => void {
  const client: SSEClient = { res, hotelId };
  clients.add(client);
  return () => clients.delete(client);
}

/**
 * Emit a named event to all staff connected to a specific hotel.
 */
export function emitToHotel(hotelId: string, event: string, data: Record<string, unknown> = {}): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    if (client.hotelId !== hotelId) continue;
    try {
      client.res.write(payload);
    } catch {
      clients.delete(client);
    }
  }
}

/**
 * Register a new guest SSE client for a conversation. Returns a cleanup function.
 */
export function addGuestSSEClient(conversationId: string, res: Response): () => void {
  const client: GuestSSEClient = { res, conversationId };
  guestClients.add(client);
  return () => guestClients.delete(client);
}

/**
 * Emit a named event to the guest listening on a specific conversation.
 */
export function emitToConversation(conversationId: string, event: string, data: Record<string, unknown> = {}): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of guestClients) {
    if (client.conversationId !== conversationId) continue;
    try {
      client.res.write(payload);
    } catch {
      guestClients.delete(client);
    }
  }
}
