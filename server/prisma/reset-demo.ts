/**
 * reset-demo.ts
 *
 * Resets ONLY operational / runtime data back to the demo state.
 * Configuration (hotel, rooms, menu, amenities, services, staff) is NOT touched.
 *
 * Run from server/:
 *   npx tsx prisma/reset-demo.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Resetting demo data...\n');

  // ── 1. Delete runtime tables in FK-safe order ─────────────────────────────
  // OrderItem → Order → (GuestSession)
  // Message, ConversationFlowState → Conversation → (GuestSession)
  // ServiceRequest → (GuestSession)
  // GuestFeedback → (GuestSession)
  // Notification, QrScan, OtpCode (standalone)
  // GuestSession last (everything above references it)

  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.conversationFlowState.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.serviceRequest.deleteMany();
  await prisma.guestFeedback.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.qrScan.deleteMany();
  await prisma.otpCode.deleteMany();
  await prisma.guestSession.deleteMany();

  console.log('🧹 Runtime data cleared\n');

  // ── 2. Resolve hotel & rooms ──────────────────────────────────────────────
  const hotel = await prisma.hotel.findUnique({ where: { slug: 'royal-palm-suites' } });
  if (!hotel) throw new Error('Hotel not found — run the full seed first (npm run db:seed)');

  const roomNumbers = ['103', '203', '302'];
  const rooms = await prisma.room.findMany({
    where: { hotelId: hotel.id, roomNumber: { in: roomNumbers } },
  });
  const room = (n: string) => {
    const r = rooms.find(r => r.roomNumber === n);
    if (!r) throw new Error(`Room ${n} not found`);
    return r;
  };

  const staff = await prisma.user.findMany({
    where: {
      hotelId: hotel.id,
      email: { in: ['housekeeping@royalpalm.com', 'concierge@royalpalm.com'] },
    },
  });
  const ramesh = staff.find(u => u.email === 'housekeeping@royalpalm.com');
  const anita  = staff.find(u => u.email === 'concierge@royalpalm.com');

  // ── 3. Menu items needed for orders ───────────────────────────────────────
  const menuItems = await prisma.menuItem.findMany({
    where: {
      hotelId: hotel.id,
      name: { in: ['Butter Chicken', 'Mango Lassi', 'Samosa Platter', 'Masala Chai'] },
    },
  });
  const menu = (name: string) => {
    const m = menuItems.find(m => m.name === name);
    if (!m) throw new Error(`Menu item "${name}" not found`);
    return m;
  };

  // ── 4. Guest sessions ─────────────────────────────────────────────────────
  const now      = new Date();
  const checkIn  = new Date(now);
  const checkOut1 = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000); // 4 days
  const checkOut2 = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 days
  const checkOut3 = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days

  const gs1 = await prisma.guestSession.create({
    data: {
      hotelId: hotel.id, roomId: room('103').id,
      guestName: 'Arjun Kapoor', email: 'arjun.kapoor@email.com',
      checkInDate: checkIn, checkOutDate: checkOut1,
      otpVerified: true, token: 'demo-guest-token-103',
    },
  });

  const gs2 = await prisma.guestSession.create({
    data: {
      hotelId: hotel.id, roomId: room('203').id,
      guestName: 'Sneha Joshi', email: 'sneha.joshi@email.com',
      checkInDate: checkIn, checkOutDate: checkOut2,
      otpVerified: true, token: 'demo-guest-token-203',
    },
  });

  const gs3 = await prisma.guestSession.create({
    data: {
      hotelId: hotel.id, roomId: room('302').id,
      guestName: 'Vikram Nair', email: 'vikram.nair@email.com',
      checkInDate: checkIn, checkOutDate: checkOut3,
      otpVerified: true, token: 'demo-guest-token-302',
    },
  });

  console.log('✅ Guest sessions created (103 · 203 · 302)');

  // ── 5. Conversations & messages ───────────────────────────────────────────
  const t = (minutesAgo: number) => new Date(now.getTime() - minutesAgo * 60 * 1000);

  const conv1 = await prisma.conversation.create({
    data: { hotelId: hotel.id, roomId: room('103').id, guestSessionId: gs1.id, status: 'active' },
  });
  await prisma.message.createMany({ data: [
    { conversationId: conv1.id, senderType: 'guest',     content: 'Hi! What time does the pool open?',                                                                           createdAt: t(60) },
    { conversationId: conv1.id, senderType: 'assistant', content: 'The Swimming Pool is open from 06:00 AM to 10:00 PM. Towels are provided at the poolside. Enjoy your swim! 🏊', createdAt: t(59) },
    { conversationId: conv1.id, senderType: 'guest',     content: 'Can I get extra towels in my room?',                                                                           createdAt: t(30) },
    { conversationId: conv1.id, senderType: 'assistant', content: "Of course! I've raised a request for extra towels in Room 103. They will be delivered within 15 minutes.",     createdAt: t(29) },
  ]});

  const conv2 = await prisma.conversation.create({
    data: { hotelId: hotel.id, roomId: room('203').id, guestSessionId: gs2.id, status: 'active', hasEscalation: true },
  });
  await prisma.message.createMany({ data: [
    { conversationId: conv2.id, senderType: 'guest',     content: 'I want to order food',                                                                                                                                      createdAt: t(120) },
    { conversationId: conv2.id, senderType: 'assistant', content: "I'd be happy to help you order food! What would you like?",                                                                                                   createdAt: t(119) },
    { conversationId: conv2.id, senderType: 'guest',     content: '2 butter chicken and 1 mango lassi',                                                                                                                         createdAt: t(116) },
    { conversationId: conv2.id, senderType: 'assistant', content: 'Your order has been placed!\n\n• Butter Chicken × 2 — ₹1,440\n• Mango Lassi × 1 — ₹180\n\nTotal: ₹1,620\n\nEstimated delivery: 30–45 minutes.',           createdAt: t(115) },
    { conversationId: conv2.id, senderType: 'guest',     content: 'My AC is making a loud noise',                                                                                                                               createdAt: t(30) },
    { conversationId: conv2.id, senderType: 'assistant', content: "I've escalated this to our front desk team. They will assist you shortly.",                                                                                   createdAt: t(29) },
  ]});

  const conv3 = await prisma.conversation.create({
    data: { hotelId: hotel.id, roomId: room('302').id, guestSessionId: gs3.id, status: 'active' },
  });
  await prisma.message.createMany({ data: [
    { conversationId: conv3.id, senderType: 'guest',     content: 'Mujhe housekeeping chahiye',                                                                                   createdAt: t(15) },
    { conversationId: conv3.id, senderType: 'assistant', content: '✅ Your request for **Housekeeping** has been registered! Our team will attend to you shortly.',               createdAt: t(14) },
  ]});

  console.log('✅ Conversations created');

  // ── 6. Service requests ───────────────────────────────────────────────────
  await prisma.serviceRequest.createMany({ data: [
    { hotelId: hotel.id, roomId: room('103').id, guestSessionId: gs1.id, type: 'Extra Towels',  details: 'Guest requested 2 extra bath towels',              status: 'completed',  isBillable: false, staffNotes: 'Delivered at 2:15 PM' },
    { hotelId: hotel.id, roomId: room('203').id, guestSessionId: gs2.id, type: 'Maintenance',   details: 'AC making loud noise in room 203. Needs inspection.', status: 'in_progress', isBillable: false, assignedToId: ramesh?.id },
    { hotelId: hotel.id, roomId: room('302').id, guestSessionId: gs3.id, type: 'Housekeeping',  details: 'Please clean the room',                            status: 'in_progress', isBillable: false, assignedToId: ramesh?.id },
    { hotelId: hotel.id, roomId: room('103').id, guestSessionId: gs1.id, type: 'Taxi / Cab',    details: 'Need taxi to city center at 6pm',                  status: 'in_progress', isBillable: true,  assignedToId: anita?.id  },
  ]});

  console.log('✅ Service requests created');

  // ── 7. Orders ─────────────────────────────────────────────────────────────
  const order1 = await prisma.order.create({
    data: {
      hotelId: hotel.id, roomId: room('203').id, guestSessionId: gs2.id,
      totalAmount: 1620, status: 'preparing', isBillable: true, frontDeskAcknowledged: false,
    },
  });
  await prisma.orderItem.createMany({ data: [
    { orderId: order1.id, menuItemId: menu('Butter Chicken').id, quantity: 2, itemNameSnapshot: 'Butter Chicken', itemPriceSnapshot: 720 },
    { orderId: order1.id, menuItemId: menu('Mango Lassi').id,    quantity: 1, itemNameSnapshot: 'Mango Lassi',    itemPriceSnapshot: 180 },
  ]});

  const order2 = await prisma.order.create({
    data: {
      hotelId: hotel.id, roomId: room('103').id, guestSessionId: gs1.id,
      totalAmount: 580, status: 'placed', isBillable: true, frontDeskAcknowledged: false,
    },
  });
  await prisma.orderItem.createMany({ data: [
    { orderId: order2.id, menuItemId: menu('Samosa Platter').id, quantity: 2, itemNameSnapshot: 'Samosa Platter', itemPriceSnapshot: 220 },
    { orderId: order2.id, menuItemId: menu('Masala Chai').id,    quantity: 2, itemNameSnapshot: 'Masala Chai',    itemPriceSnapshot: 80  },
  ]});

  console.log('✅ Orders created');

  // ── 8. Notifications ──────────────────────────────────────────────────────
  await prisma.notification.createMany({ data: [
    { hotelId: hotel.id, type: 'new_order',    title: 'New Food Order — Room 203',   body: 'Sneha Joshi ordered Butter Chicken (×2) and Mango Lassi. Total: ₹1,620. Please add to bill.',             isRead: false, relatedEntityType: 'order',          relatedEntityId: order1.id },
    { hotelId: hotel.id, type: 'escalation',   title: 'Escalation — Room 203',       body: 'Guest in Room 203 (Sneha Joshi) reported AC making a loud noise. Requires attention.',                      isRead: false, relatedEntityType: 'conversation',   relatedEntityId: conv2.id  },
    { hotelId: hotel.id, type: 'new_request',  title: 'Maintenance Request — Room 203', body: 'AC inspection needed. Assigned to Ramesh Verma.',                                                        isRead: false, relatedEntityType: 'serviceRequest'                         },
    { hotelId: hotel.id, type: 'new_request',  title: 'Taxi Request — Room 103',     body: 'Arjun Kapoor needs a taxi to city center at 6pm. Assigned to Anita Desai.',                                 isRead: false, relatedEntityType: 'serviceRequest'                         },
    { hotelId: hotel.id, type: 'new_chat',     title: 'New Guest — Room 302',         body: 'Vikram Nair started a conversation from Room 302.',                                                        isRead: true,  relatedEntityType: 'conversation',   relatedEntityId: conv3.id  },
    { hotelId: hotel.id, type: 'new_order',    title: 'New Order — Room 103',         body: 'Arjun Kapoor ordered Samosa Platter and Masala Chai. Total: ₹580.',                                       isRead: false, relatedEntityType: 'order',          relatedEntityId: order2.id },
  ]});

  console.log('✅ Notifications created');

  // ── 9. QR scans (analytics history) ──────────────────────────────────────
  for (let i = 0; i < 24; i++) {
    await prisma.qrScan.create({
      data: {
        hotelId: hotel.id,
        scannedAt: new Date(now.getTime() - i * 3600000),
        source: 'room_qr',
        deviceType: i % 3 === 0 ? 'desktop' : 'mobile',
      },
    });
  }

  console.log('✅ QR scans created');

  console.log('\n✨ Demo reset complete!\n');
  console.log('Active guest rooms : 103 · 203 · 302');
  console.log('Guest tokens       : demo-guest-token-103 · demo-guest-token-203 · demo-guest-token-302');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
