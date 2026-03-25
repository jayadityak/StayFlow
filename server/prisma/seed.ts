import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clean up dependent data so seed can run multiple times
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.serviceRequest.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.qrScan.deleteMany();
  await prisma.guestSession.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.service.deleteMany();
  await prisma.amenity.deleteMany();

  console.log('🧹 Cleared existing data');

  const hotel = await prisma.hotel.upsert({
    where: { slug: 'royal-palm-suites' },
    update: {},
    create: {
      name: 'Royal Palm Suites',
      slug: 'royal-palm-suites',
      email: 'info@royalpalm.com',
      phone: '+91-294-2420101',
      frontDeskNumber: '+91-294-2420102',
      supportEmail: 'support@royalpalm.com',
      address: '12, Lake Palace Road, Fateh Sagar',
      city: 'Udaipur',
      state: 'Rajasthan',
      hotelType: 'luxury',
      totalRooms: 48,
      checkInTime: '14:00',
      checkOutTime: '12:00',
    },
  });

  console.log('✅ Hotel created:', hotel.name);

  const adminHash = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@royalpalm.com' },
    update: {},
    create: { hotelId: hotel.id, name: 'Rajiv Sharma', email: 'admin@royalpalm.com', passwordHash: adminHash, role: 'admin' },
  });

  const staffHash = await bcrypt.hash('staff123', 10);
  await prisma.user.upsert({
    where: { email: 'staff@royalpalm.com' },
    update: { role: 'restaurant' },
    create: { hotelId: hotel.id, name: 'Priya Mehta', email: 'staff@royalpalm.com', passwordHash: staffHash, role: 'restaurant' },
  });

  await prisma.user.upsert({
    where: { email: 'housekeeping@royalpalm.com' },
    update: { role: 'housekeeping' },
    create: { hotelId: hotel.id, name: 'Ramesh Verma', email: 'housekeeping@royalpalm.com', passwordHash: staffHash, role: 'housekeeping' },
  });

  await prisma.user.upsert({
    where: { email: 'concierge@royalpalm.com' },
    update: { role: 'frontdesk' },
    create: { hotelId: hotel.id, name: 'Anita Desai', email: 'concierge@royalpalm.com', passwordHash: staffHash, role: 'frontdesk' },
  });

  console.log('✅ Users created');

  const roomData = [
    { roomNumber: '101', roomType: 'standard', floor: 1, occupancy: 2 },
    { roomNumber: '102', roomType: 'standard', floor: 1, occupancy: 2 },
    { roomNumber: '103', roomType: 'deluxe', floor: 1, occupancy: 2 },
    { roomNumber: '104', roomType: 'deluxe', floor: 1, occupancy: 3 },
    { roomNumber: '201', roomType: 'standard', floor: 2, occupancy: 2 },
    { roomNumber: '202', roomType: 'deluxe', floor: 2, occupancy: 2 },
    { roomNumber: '203', roomType: 'suite', floor: 2, occupancy: 4 },
    { roomNumber: '204', roomType: 'suite', floor: 2, occupancy: 4 },
    { roomNumber: '301', roomType: 'deluxe', floor: 3, occupancy: 2 },
    { roomNumber: '302', roomType: 'suite', floor: 3, occupancy: 4 },
    { roomNumber: '303', roomType: 'villa', floor: 3, occupancy: 6 },
    { roomNumber: '401', roomType: 'villa', floor: 4, occupancy: 6 },
    { roomNumber: '402', roomType: 'suite', floor: 4, occupancy: 4 },
    { roomNumber: '403', roomType: 'deluxe', floor: 4, occupancy: 2 },
    { roomNumber: '501', roomType: 'villa', floor: 5, occupancy: 8 },
  ];

  const rooms: any[] = [];
  for (const r of roomData) {
    const room = await prisma.room.upsert({
      where: { hotelId_roomNumber: { hotelId: hotel.id, roomNumber: r.roomNumber } },
      update: {},
      create: { hotelId: hotel.id, ...r },
    });
    rooms.push(room);
  }

  console.log('✅ Rooms created');

  const amenitiesData = [
    { name: 'Swimming Pool', isAvailable: true, openingTime: '06:00', closingTime: '22:00', notes: 'Heated pool with lake view. Towels provided.' },
    { name: 'Spa & Wellness', isAvailable: true, openingTime: '09:00', closingTime: '21:00', notes: 'Prior booking required. Call front desk.' },
    { name: 'Fitness Center', isAvailable: true, openingTime: '05:30', closingTime: '23:00', notes: 'Personal trainer available 7am-7pm.' },
    { name: 'Restaurant - The Terrace', isAvailable: true, openingTime: '07:00', closingTime: '23:00', notes: 'Dress code: smart casual for dinner.' },
    { name: 'Breakfast Buffet', isAvailable: true, openingTime: '07:00', closingTime: '10:30', notes: 'Complimentary for suite and villa guests.' },
    { name: 'Parking', isAvailable: true, openingTime: '00:00', closingTime: '23:59', notes: 'Valet parking available. Complimentary for guests.' },
    { name: 'WiFi', isAvailable: true, openingTime: '00:00', closingTime: '23:59', notes: 'Network: RoyalPalm_Guest | Password: welcome2024' },
    { name: 'Airport Transfer', isAvailable: true, openingTime: '06:00', closingTime: '22:00', notes: 'Book 3 hours in advance. ₹1200 per trip.' },
    { name: 'Business Center', isAvailable: true, openingTime: '08:00', closingTime: '20:00', notes: 'Printing, scanning, and meeting rooms available.' },
    { name: 'Rooftop Lounge', isAvailable: true, openingTime: '17:00', closingTime: '00:00', notes: 'Live music Fri & Sat evenings.' },
  ];

  for (const a of amenitiesData) {
    await prisma.amenity.create({ data: { hotelId: hotel.id, ...a } });
  }

  console.log('✅ Amenities created');

  const servicesData = [
    { name: 'Room Service', isEnabled: true, openingTime: '06:00', closingTime: '23:00', notes: '30-45 min delivery time.', isBillable: true },
    { name: 'Housekeeping', isEnabled: true, openingTime: '08:00', closingTime: '20:00', notes: 'Daily turndown service at 6pm.', isBillable: false },
    { name: 'Laundry', isEnabled: true, openingTime: '07:00', closingTime: '19:00', notes: 'Same-day service before 10am.', isBillable: true },
    { name: 'Extra Towels', isEnabled: true, openingTime: '00:00', closingTime: '23:59', notes: 'Delivered within 15 minutes.', isBillable: false },
    { name: 'Toiletries', isEnabled: true, openingTime: '00:00', closingTime: '23:59', notes: 'Complimentary basic set.', isBillable: false },
    { name: 'Taxi / Cab', isEnabled: true, openingTime: '00:00', closingTime: '23:59', notes: 'Pre-book 30 min in advance.', isBillable: true },
    { name: 'Airport Pickup', isEnabled: true, openingTime: '00:00', closingTime: '23:59', notes: '₹1200 per trip.', isBillable: true },
    { name: 'Maintenance', isEnabled: true, openingTime: '07:00', closingTime: '22:00', notes: 'Emergency maintenance available 24x7.', isBillable: false },
    { name: 'Wake-up Call', isEnabled: true, openingTime: '00:00', closingTime: '23:59', notes: 'Request through this chat or call front desk.', isBillable: false },
  ];

  for (const s of servicesData) {
    await prisma.service.create({ data: { hotelId: hotel.id, ...s } });
  }

  console.log('✅ Services created');

  const menuData = [
    { name: 'Classic English Breakfast', category: 'breakfast', description: 'Eggs, bacon, sausages, toast, beans, tomato', isVegetarian: false, price: 750, isAvailable: true },
    { name: 'Masala Omelette', category: 'breakfast', description: 'Spiced eggs with onions, tomatoes, green chillies', isVegetarian: true, price: 350, isAvailable: true },
    { name: 'Idli Sambar', category: 'breakfast', description: 'Steamed rice cakes with lentil soup and chutneys', isVegetarian: true, price: 280, isAvailable: true },
    { name: 'Pancake Stack', category: 'breakfast', description: 'Fluffy pancakes with maple syrup and fresh berries', isVegetarian: true, price: 420, isAvailable: true },
    { name: 'Dal Bati Churma', category: 'lunch', description: 'Rajasthani specialty — lentils, baked wheat balls', isVegetarian: true, price: 580, isAvailable: true },
    { name: 'Chicken Biryani', category: 'lunch', description: 'Aromatic basmati rice with spiced chicken and saffron', isVegetarian: false, price: 680, isAvailable: true },
    { name: 'Club Sandwich', category: 'lunch', description: 'Triple-decker with chicken, lettuce, tomato, mayo', isVegetarian: false, price: 450, isAvailable: true },
    { name: 'Paneer Tikka Wrap', category: 'lunch', description: 'Marinated cottage cheese in a soft tortilla', isVegetarian: true, price: 380, isAvailable: true },
    { name: 'Laal Maas', category: 'dinner', description: 'Rajasthani mutton curry with red chillies', isVegetarian: false, price: 880, isAvailable: true },
    { name: 'Butter Chicken', category: 'dinner', description: 'Tender chicken in rich tomato-butter gravy', isVegetarian: false, price: 720, isAvailable: true },
    { name: 'Paneer Butter Masala', category: 'dinner', description: 'Cottage cheese in creamy tomato sauce', isVegetarian: true, price: 620, isAvailable: true },
    { name: 'Grilled Barramundi', category: 'dinner', description: 'Fish fillet with herb butter, asparagus, lemon', isVegetarian: false, price: 950, isAvailable: true },
    { name: 'Fresh Lime Soda', category: 'beverages', description: 'Sweet, salty, or masala', isVegetarian: true, price: 120, isAvailable: true },
    { name: 'Mango Lassi', category: 'beverages', description: 'Chilled yogurt drink blended with Alphonso mango', isVegetarian: true, price: 180, isAvailable: true },
    { name: 'Masala Chai', category: 'beverages', description: 'Traditional spiced milk tea', isVegetarian: true, price: 80, isAvailable: true },
    { name: 'Cold Coffee', category: 'beverages', description: 'Blended iced coffee with milk and cream', isVegetarian: true, price: 220, isAvailable: true },
    { name: 'Samosa Platter', category: 'snacks', description: 'Crispy pastry filled with spiced potatoes, with mint chutney', isVegetarian: true, price: 220, isAvailable: true },
    { name: 'Chicken Wings', category: 'snacks', description: 'Crispy wings with BBQ or buffalo sauce', isVegetarian: false, price: 480, isAvailable: true },
    { name: 'Gulab Jamun', category: 'desserts', description: 'Soft milk dumplings soaked in rose syrup', isVegetarian: true, price: 200, isAvailable: true },
    { name: 'Chocolate Lava Cake', category: 'desserts', description: 'Warm chocolate cake with a molten center, vanilla ice cream', isVegetarian: true, price: 380, isAvailable: true },
  ];

  const menuItems: any[] = [];
  for (const m of menuData) {
    const item = await prisma.menuItem.create({ data: { hotelId: hotel.id, ...m } });
    menuItems.push(item);
  }

  console.log('✅ Menu items created');

  // Use FUTURE dates so sessions show as active
  const now = new Date();
  const checkIn = new Date(now);
  const checkOut = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000); // 4 days from now

  const guestSession1 = await prisma.guestSession.create({
    data: {
      hotelId: hotel.id,
      roomId: rooms[2].id, // Room 103
      guestName: 'Arjun Kapoor',
      email: 'arjun.kapoor@email.com',
      checkInDate: checkIn,
      checkOutDate: checkOut,
      otpVerified: true,
      token: 'demo-guest-token-103',
    },
  });

  const checkOut2 = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const guestSession2 = await prisma.guestSession.create({
    data: {
      hotelId: hotel.id,
      roomId: rooms[6].id, // Room 203
      guestName: 'Sneha Joshi',
      email: 'sneha.joshi@email.com',
      checkInDate: checkIn,
      checkOutDate: checkOut2,
      otpVerified: true,
      token: 'demo-guest-token-203',
    },
  });

  const checkOut3 = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const guestSession3 = await prisma.guestSession.create({
    data: {
      hotelId: hotel.id,
      roomId: rooms[9].id, // Room 302
      guestName: 'Vikram Nair',
      email: 'vikram.nair@email.com',
      checkInDate: checkIn,
      checkOutDate: checkOut3,
      otpVerified: true,
      token: 'demo-guest-token-302',
    },
  });

  console.log('✅ Guest sessions created');

  // Conversations
  const conv1 = await prisma.conversation.create({
    data: { hotelId: hotel.id, roomId: rooms[2].id, guestSessionId: guestSession1.id, status: 'active' },
  });

  await prisma.message.createMany({
    data: [
      { conversationId: conv1.id, senderType: 'guest', content: 'Hi! What time does the pool open?', createdAt: new Date(Date.now() - 3600000) },
      { conversationId: conv1.id, senderType: 'assistant', content: 'The Swimming Pool is open from 06:00 AM to 10:00 PM. Towels are provided at the poolside. Enjoy your swim! 🏊', createdAt: new Date(Date.now() - 3590000) },
      { conversationId: conv1.id, senderType: 'guest', content: 'Can I get extra towels in my room?', createdAt: new Date(Date.now() - 1800000) },
      { conversationId: conv1.id, senderType: 'assistant', content: "Of course! I've raised a request for extra towels in Room 103. They will be delivered within 15 minutes.", createdAt: new Date(Date.now() - 1790000) },
    ],
  });

  const conv2 = await prisma.conversation.create({
    data: { hotelId: hotel.id, roomId: rooms[6].id, guestSessionId: guestSession2.id, status: 'active', hasEscalation: true },
  });

  await prisma.message.createMany({
    data: [
      { conversationId: conv2.id, senderType: 'guest', content: 'I want to order food', createdAt: new Date(Date.now() - 7200000) },
      { conversationId: conv2.id, senderType: 'assistant', content: "I'd be happy to help you order food! What would you like?", createdAt: new Date(Date.now() - 7190000) },
      { conversationId: conv2.id, senderType: 'guest', content: '2 butter chicken and 1 mango lassi', createdAt: new Date(Date.now() - 7000000) },
      { conversationId: conv2.id, senderType: 'assistant', content: 'Your order has been placed!\n\n• Butter Chicken × 2 — ₹1,440\n• Mango Lassi × 1 — ₹180\n\nTotal: ₹1,620\n\nEstimated delivery: 30–45 minutes.', createdAt: new Date(Date.now() - 6990000) },
      { conversationId: conv2.id, senderType: 'guest', content: 'My AC is making a loud noise', createdAt: new Date(Date.now() - 1800000) },
      { conversationId: conv2.id, senderType: 'assistant', content: "I've escalated this to our front desk team. They will assist you shortly.", createdAt: new Date(Date.now() - 1790000) },
    ],
  });

  const conv3 = await prisma.conversation.create({
    data: { hotelId: hotel.id, roomId: rooms[9].id, guestSessionId: guestSession3.id, status: 'active' },
  });

  await prisma.message.createMany({
    data: [
      { conversationId: conv3.id, senderType: 'guest', content: 'Mujhe housekeeping chahiye', createdAt: new Date(Date.now() - 900000) },
      { conversationId: conv3.id, senderType: 'assistant', content: '✅ Your request for **Housekeeping** has been registered! Our team will attend to you shortly.', createdAt: new Date(Date.now() - 890000) },
    ],
  });

  console.log('✅ Conversations created');

  // Fetch the newly created staff for assignment
  const ramesh = await prisma.user.findUnique({ where: { email: 'housekeeping@royalpalm.com' } });
  const anita = await prisma.user.findUnique({ where: { email: 'concierge@royalpalm.com' } });

  // Service Requests — with assignments for demo
  await prisma.serviceRequest.createMany({
    data: [
      { hotelId: hotel.id, roomId: rooms[2].id, guestSessionId: guestSession1.id, type: 'Extra Towels', details: 'Guest requested 2 extra bath towels', status: 'completed', isBillable: false, staffNotes: 'Delivered at 2:15 PM' },
      { hotelId: hotel.id, roomId: rooms[6].id, guestSessionId: guestSession2.id, type: 'Maintenance', details: 'AC making loud noise in room 203. Needs inspection.', status: 'in_progress', isBillable: false, assignedToId: ramesh?.id },
      { hotelId: hotel.id, roomId: rooms[9].id, guestSessionId: guestSession3.id, type: 'Housekeeping', details: 'Please clean the room', status: 'in_progress', isBillable: false, assignedToId: ramesh?.id },
      { hotelId: hotel.id, roomId: rooms[2].id, guestSessionId: guestSession1.id, type: 'Taxi / Cab', details: 'Need taxi to city center at 6pm', status: 'in_progress', isBillable: true, assignedToId: anita?.id },
    ],
  });

  console.log('✅ Service requests created');

  // Orders
  const order1 = await prisma.order.create({
    data: {
      hotelId: hotel.id,
      roomId: rooms[6].id,
      guestSessionId: guestSession2.id,
      totalAmount: 1620,
      status: 'preparing',
      isBillable: true,
      frontDeskAcknowledged: false,
    },
  });

  await prisma.orderItem.createMany({
    data: [
      { orderId: order1.id, menuItemId: menuItems[9].id, quantity: 2, itemNameSnapshot: 'Butter Chicken', itemPriceSnapshot: 720 },
      { orderId: order1.id, menuItemId: menuItems[13].id, quantity: 1, itemNameSnapshot: 'Mango Lassi', itemPriceSnapshot: 180 },
    ],
  });

  const order2 = await prisma.order.create({
    data: {
      hotelId: hotel.id,
      roomId: rooms[2].id,
      guestSessionId: guestSession1.id,
      totalAmount: 580,
      status: 'placed',
      isBillable: true,
      frontDeskAcknowledged: false,
    },
  });

  await prisma.orderItem.createMany({
    data: [
      { orderId: order2.id, menuItemId: menuItems[16].id, quantity: 2, itemNameSnapshot: 'Samosa Platter', itemPriceSnapshot: 220 },
      { orderId: order2.id, menuItemId: menuItems[14].id, quantity: 1, itemNameSnapshot: 'Masala Chai', itemPriceSnapshot: 80 },
      { orderId: order2.id, menuItemId: menuItems[14].id, quantity: 1, itemNameSnapshot: 'Masala Chai', itemPriceSnapshot: 80 },
    ],
  });

  console.log('✅ Orders created');

  await prisma.notification.createMany({
    data: [
      { hotelId: hotel.id, type: 'new_order', title: 'New Food Order — Room 203', body: 'Sneha Joshi ordered Butter Chicken (×2) and Mango Lassi. Total: ₹1,620. Please add to bill.', isRead: false, relatedEntityType: 'order', relatedEntityId: order1.id },
      { hotelId: hotel.id, type: 'escalation', title: 'Escalation — Room 203', body: 'Guest in Room 203 (Sneha Joshi) reported AC making a loud noise. Requires attention.', isRead: false, relatedEntityType: 'conversation', relatedEntityId: conv2.id },
      { hotelId: hotel.id, type: 'new_request', title: 'Maintenance Request — Room 203', body: 'AC inspection needed. Status: Pending.', isRead: false, relatedEntityType: 'serviceRequest' },
      { hotelId: hotel.id, type: 'new_request', title: 'Taxi Request — Room 103', body: 'Arjun Kapoor needs a taxi to city center at 6pm.', isRead: false, relatedEntityType: 'serviceRequest' },
      { hotelId: hotel.id, type: 'new_chat', title: 'New Guest — Room 302', body: 'Vikram Nair started a conversation from Room 302.', isRead: true, relatedEntityType: 'conversation', relatedEntityId: conv3.id },
      { hotelId: hotel.id, type: 'new_order', title: 'New Order — Room 103', body: 'Arjun Kapoor ordered Samosa Platter and Masala Chai. Total: ₹580.', isRead: false, relatedEntityType: 'order', relatedEntityId: order2.id },
    ],
  });

  console.log('✅ Notifications created');

  // QR Scans
  for (let i = 0; i < 24; i++) {
    await prisma.qrScan.create({
      data: { hotelId: hotel.id, scannedAt: new Date(Date.now() - i * 3600000), source: 'room_qr', deviceType: i % 3 === 0 ? 'desktop' : 'mobile' },
    });
  }

  console.log('✅ QR scans created');
  console.log('\n✨ Seed complete!\n');
  console.log('Demo Credentials:');
  console.log('─────────────────────────────────────');
  console.log('Admin:        admin@royalpalm.com  / admin123');
  console.log('Staff:        staff@royalpalm.com  / staff123');
  console.log('Housekeeping: housekeeping@royalpalm.com / staff123');
  console.log('Concierge:    concierge@royalpalm.com    / staff123');
  console.log('─────────────────────────────────────');
  console.log('Active guest rooms: 103, 203, 302');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
