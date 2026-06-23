import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

import authRoutes from './routes/auth';
import hotelRoutes from './routes/hotel';
import roomRoutes from './routes/rooms';
import amenityRoutes from './routes/amenities';
import serviceRoutes from './routes/services';
import menuRoutes from './routes/menu';
import guestRoutes from './routes/guest';
import chatRoutes from './routes/chats';
import requestRoutes from './routes/requests';
import orderRoutes from './routes/orders';
import notificationRoutes from './routes/notifications';
import analyticsRoutes from './routes/analytics';
import qrRoutes from './routes/qr';
import eventsRoutes from './routes/events';
import importRoutes from './routes/import';
import whatsappRoutes from './routes/whatsapp';
import pmsRoutes from './routes/pms';
import { startCleanupJob } from './lib/cleanup';
import { initializePmsProviders } from './pms';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/hotel', hotelRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/amenities', amenityRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/menu-items', menuRoutes);
app.use('/api/guest', guestRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/import', importRoutes);
app.use('/api/whatsapp', express.urlencoded({ extended: false }), whatsappRoutes);
app.use('/api/pms', pmsRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, async () => {
  console.log(`🚀 StayFlow server running on port ${PORT}`);
  startCleanupJob();
  await initializePmsProviders();
});

export default app;
