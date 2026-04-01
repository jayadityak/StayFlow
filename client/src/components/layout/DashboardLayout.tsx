import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { useSSEEvents } from '@/hooks/useSSEEvents'
import {
  LayoutDashboard, BedDouble, Waves, Wrench, UtensilsCrossed,
  MessageSquare, ClipboardList, ShoppingBag, Bell, QrCode,
  BarChart3, Settings, LogOut, Menu, X, User, ChevronDown,
  Search, Hotel, Users
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel
} from '@/components/ui/dropdown-menu'

const adminNavItems = [
  { path: '/app/overview', label: 'Control Panel', icon: LayoutDashboard },
  { path: '/app/rooms', label: 'Rooms', icon: BedDouble },
  { path: '/app/amenities', label: 'Amenities', icon: Waves },
  { path: '/app/services', label: 'Services', icon: Wrench },
  { path: '/app/menu', label: 'F&B Menu', icon: UtensilsCrossed },
  { path: '/app/chats', label: 'Guest Chats', icon: MessageSquare },
  { path: '/app/requests', label: 'Service Requests', icon: ClipboardList },
  { path: '/app/staff-board', label: 'Staff Board', icon: Users },
  { path: '/app/orders', label: 'Room Orders', icon: ShoppingBag },
  { path: '/app/notifications', label: 'Notifications', icon: Bell },
  { path: '/app/qr', label: 'QR Code', icon: QrCode },
  { path: '/app/analytics', label: 'Insights', icon: BarChart3 },
  { path: '/app/settings', label: 'Settings', icon: Settings },
]

// Housekeeping: requests + notifications only
const housekeepingNavItems = [
  { path: '/app/requests', label: 'Service Requests', icon: ClipboardList },
  { path: '/app/notifications', label: 'Notifications', icon: Bell },
]

// Front Desk: chats + requests + notifications
const frontdeskNavItems = [
  { path: '/app/chats', label: 'Guest Chats', icon: MessageSquare },
  { path: '/app/requests', label: 'Service Requests', icon: ClipboardList },
  { path: '/app/notifications', label: 'Notifications', icon: Bell },
]

// Restaurant: requests + notifications only
const restaurantNavItems = [
  { path: '/app/requests', label: 'Service Requests', icon: ClipboardList },
  { path: '/app/notifications', label: 'Notifications', icon: Bell },
]

// Legacy fallback for old 'staff' role
const staffNavItems = [
  { path: '/app/requests', label: 'Service Requests', icon: ClipboardList },
  { path: '/app/notifications', label: 'Notifications', icon: Bell },
]

export default function DashboardLayout() {
  const { user, hotel, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Real-time updates via SSE — invalidates TanStack Query caches on new events
  useSSEEvents()

  const isAdmin = user?.role === 'admin'

  const navItems = (() => {
    switch (user?.role) {
      case 'admin':      return adminNavItems
      case 'housekeeping': return housekeepingNavItems
      case 'frontdesk':  return frontdeskNavItems
      case 'restaurant': return restaurantNavItems
      default:           return staffNavItems
    }
  })()

  const roleLabel: Record<string, string> = {
    admin: 'Admin',
    housekeeping: 'Housekeeping',
    frontdesk: 'Front Desk',
    restaurant: 'Restaurant',
    staff: 'Staff',
  }

  const { data: notifications } = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: () => api.get<any[]>('/notifications?unread=true'),
    refetchInterval: 20000,
  })

  const { data: alerts } = useQuery({
    queryKey: ['analytics-alerts'],
    queryFn: () => api.get<any>('/analytics/alerts'),
    refetchInterval: 15000,
  })

  const unreadCount = notifications?.length || 0
  const totalAlerts = alerts ? (alerts.delayedRequests + alerts.pendingOrders + alerts.taxiRequests + alerts.escalations) : 0

  useEffect(() => { setSidebarOpen(false) }, [location.pathname])

  const handleLogout = () => { logout(); navigate('/login') }

  const getBadge = (label: string) => {
    if (label === 'Notifications') return unreadCount
    if (label === 'Service Requests') return alerts?.delayedRequests || 0
    if (label === 'Room Orders') return alerts?.pendingOrders || 0
    if (label === 'Guest Chats') return alerts?.escalations || 0
    return 0
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 h-full w-60 bg-[#1E293B] text-white z-30 flex flex-col transition-transform duration-300",
        "lg:relative lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#4F6EF7] to-[#818CF8] flex items-center justify-center flex-shrink-0 shadow-md shadow-[#4F6EF7]/30">
            <Hotel size={15} className="text-white" />
          </div>
          <div className="min-w-0">
            <div className="font-display text-sm font-semibold text-white leading-tight">StayFlow</div>
            <div className="text-xs text-white/50 truncate">{hotel?.name}</div>
          </div>
          <button className="ml-auto lg:hidden text-white/60 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 py-3 overflow-y-auto scrollbar-thin">
          {navItems.map(({ path, label, icon: Icon }) => {
            const badge = getBadge(label)
            return (
              <NavLink
                key={path}
                to={path}
                className={({ isActive }) => cn(
                  "flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm transition-colors",
                  isActive ? "bg-[#4F6EF7]/20 text-white font-medium" : "text-white/60 hover:text-white hover:bg-white/8"
                )}
              >
                <Icon size={16} className="flex-shrink-0" />
                <span className="truncate">{label}</span>
                {badge > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center flex-shrink-0">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </NavLink>
            )
          })}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#4F6EF7]/20 flex items-center justify-center text-[#818CF8] text-sm font-semibold flex-shrink-0">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">{user?.name}</div>
              <div className="text-xs text-white/40">{roleLabel[user?.role || ''] || user?.role}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-14 border-b bg-white flex items-center gap-3 px-4 lg:px-5 flex-shrink-0 z-10">
          <button className="lg:hidden text-foreground hover:text-primary" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>

          {isAdmin && (
            <div className="flex-1 max-w-sm relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                className="w-full pl-8 pr-4 h-8 rounded-lg border bg-muted/50 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Search rooms, guests..."
              />
            </div>
          )}

          <div className="flex items-center gap-1 ml-auto">
            {isAdmin && totalAlerts > 0 && (
              <button
                onClick={() => navigate('/app/overview')}
                className="flex items-center gap-1.5 text-xs bg-red-50 text-red-700 border border-red-200 rounded-full px-2.5 py-1 hover:bg-red-100 transition-colors mr-1"
              >
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                {totalAlerts} alert{totalAlerts > 1 ? 's' : ''}
              </button>
            )}

            <Button variant="ghost" size="icon" className="relative h-9 w-9" onClick={() => navigate('/app/notifications')}>
              <Bell size={17} />
              {unreadCount > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 h-9 px-2">
                  <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center text-primary text-xs font-semibold">
                    {user?.name?.charAt(0).toUpperCase()}
                  </div>
                  <span className="hidden sm:block text-sm font-medium max-w-[100px] truncate">{user?.name}</span>
                  <ChevronDown size={13} className="text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel>
                  <div className="font-medium text-sm">{user?.name}</div>
                  <div className="text-xs text-muted-foreground font-normal">{roleLabel[user?.role || ''] || user?.role}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/app/settings')}>
                  <User size={13} className="mr-2" /> Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/app/settings')}>
                  <Settings size={13} className="mr-2" /> Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
                  <LogOut size={13} className="mr-2" /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-muted/20">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
