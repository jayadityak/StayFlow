import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/features/auth/AuthContext'
import { ToastProvider } from '@/components/ui/toast'
import DashboardLayout from '@/components/layout/DashboardLayout'
import LoginPage from '@/features/auth/LoginPage'
import SignupPage from '@/features/auth/SignupPage'
import LandingPage from '@/features/auth/LandingPage'
import OverviewPage from '@/features/overview/OverviewPage'
import RoomsPage from '@/features/rooms/RoomsPage'
import RoomPanel from '@/features/rooms/RoomPanel'
import AmenitiesPage from '@/features/amenities/AmenitiesPage'
import ServicesPage from '@/features/services/ServicesPage'
import MenuPage from '@/features/menu/MenuPage'
import ChatsPage from '@/features/chats/ChatsPage'
import RequestsPage from '@/features/requests/RequestsPage'
import OrdersPage from '@/features/orders/OrdersPage'
import NotificationsPage from '@/features/notifications/NotificationsPage'
import QrPage from '@/features/qr/QrPage'
import AnalyticsPage from '@/features/analytics/AnalyticsPage'
import SettingsPage from '@/features/settings/SettingsPage'
import StaffBoardPage from '@/features/staffboard/StaffBoardPage'
import PmsPage from '@/features/pms/PmsPage'
import GuestVerifyPage from '@/features/guest/GuestVerifyPage'
import GuestChatPage from '@/features/guest/GuestChatPage'
import GuestRoomPage from '@/features/guest/GuestRoomPage'
import ForgotPasswordPage from '@/features/auth/ForgotPasswordPage'
import ResetPasswordPage from '@/features/auth/ResetPasswordPage'
import ImportPage from '@/features/import/ImportPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

// Admin-only route
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  if (user?.role !== 'admin') return <Navigate to="/app/requests" replace />
  return <>{children}</>
}

// Admin + Front Desk route (for Guest Chats)
function ChatsRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  if (user?.role !== 'admin' && user?.role !== 'frontdesk') return <Navigate to="/app/requests" replace />
  return <>{children}</>
}

// Landing redirect based on role
function RoleBasedIndex() {
  const { user } = useAuth()
  if (user?.role === 'admin') return <Navigate to="/app/overview" replace />
  if (user?.role === 'frontdesk') return <Navigate to="/app/chats" replace />
  return <Navigate to="/app/requests" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* Guest routes — old flow (fallback) */}
            <Route path="/hotel/:slug/verify" element={<GuestVerifyPage />} />

            {/* Guest routes — new per-room QR flow */}
            <Route path="/hotel/:slug/room/:roomNumber" element={<GuestRoomPage />} />

            {/* Shared chat route */}
            <Route path="/hotel/:slug/chat" element={<GuestChatPage />} />

            {/* Protected dashboard */}
            <Route path="/app" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
              <Route index element={<RoleBasedIndex />} />
              {/* Admin-only routes */}
              <Route path="overview" element={<AdminRoute><OverviewPage /></AdminRoute>} />
              <Route path="rooms" element={<AdminRoute><RoomsPage /></AdminRoute>} />
              <Route path="rooms/:id" element={<AdminRoute><RoomPanel /></AdminRoute>} />
              <Route path="amenities" element={<AdminRoute><AmenitiesPage /></AdminRoute>} />
              <Route path="services" element={<AdminRoute><ServicesPage /></AdminRoute>} />
              <Route path="menu" element={<AdminRoute><MenuPage /></AdminRoute>} />
              <Route path="chats" element={<ChatsRoute><ChatsPage /></ChatsRoute>} />
              <Route path="staff-board" element={<AdminRoute><StaffBoardPage /></AdminRoute>} />
              <Route path="orders" element={<AdminRoute><OrdersPage /></AdminRoute>} />
              <Route path="qr" element={<AdminRoute><QrPage /></AdminRoute>} />
              <Route path="analytics" element={<AdminRoute><AnalyticsPage /></AdminRoute>} />
              <Route path="pms" element={<AdminRoute><PmsPage /></AdminRoute>} />
              <Route path="import" element={<AdminRoute><ImportPage /></AdminRoute>} />
              <Route path="settings" element={<AdminRoute><SettingsPage /></AdminRoute>} />
              {/* Shared routes (admin + staff) */}
              <Route path="requests" element={<RequestsPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  )
}
