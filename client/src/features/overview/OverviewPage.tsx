import { useQuery, useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import {
  MessageSquare, ClipboardList, ShoppingBag, AlertTriangle,
  BedDouble, Users, IndianRupee, Car, UtensilsCrossed,
  Clock, Zap, ChevronRight
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export default function OverviewPage() {
  const navigate = useNavigate()

  const { data: analytics } = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: () => api.get<any>('/analytics/overview'),
    refetchInterval: 30000,
  })

  const { data: billing } = useQuery({
    queryKey: ['analytics-billing'],
    queryFn: () => api.get<any>('/analytics/billing'),
    refetchInterval: 20000,
  })

  const { data: alerts } = useQuery({
    queryKey: ['analytics-alerts'],
    queryFn: () => api.get<any>('/analytics/alerts'),
    refetchInterval: 15000,
  })

  const { data: activity = [] } = useQuery({
    queryKey: ['analytics-activity'],
    queryFn: () => api.get<any[]>('/analytics/activity?limit=15'),
    refetchInterval: 10000,
  })

  const s = analytics?.summary || {}

  const alertItems = [
    { count: alerts?.delayedRequests, label: 'delayed requests', icon: Clock, color: 'text-red-600 bg-red-50 border-red-200', path: '/app/requests' },
    { count: alerts?.pendingOrders, label: 'orders pending', icon: UtensilsCrossed, color: 'text-orange-600 bg-orange-50 border-orange-200', path: '/app/orders' },
    { count: alerts?.taxiRequests, label: 'taxi requests', icon: Car, color: 'text-blue-600 bg-blue-50 border-blue-200', path: '/app/requests' },
    { count: alerts?.escalations, label: 'escalated chats', icon: AlertTriangle, color: 'text-purple-600 bg-purple-50 border-purple-200', path: '/app/chats' },
  ].filter(a => a.count > 0)

  const activityIcon: Record<string, any> = {
    order: UtensilsCrossed,
    request: ClipboardList,
    chat: MessageSquare,
  }

  const activityColor: Record<string, string> = {
    order: 'bg-orange-100 text-orange-700',
    request: 'bg-yellow-100 text-yellow-700',
    chat: 'bg-blue-100 text-blue-700',
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Control Panel</h1>
          <p className="text-muted-foreground text-sm mt-1">Live hotel operations overview</p>
        </div>
        {/* Quick actions */}
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate('/app/requests')}>
            <ClipboardList size={14} /> Add Request
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate('/app/orders')}>
            <ShoppingBag size={14} /> View Orders
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate('/app/chats')}>
            <MessageSquare size={14} /> Open Chats
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => navigate('/app/rooms')}>
            <BedDouble size={14} /> Room View
          </Button>
        </div>
      </div>

      {/* Priority alerts */}
      {alertItems.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {alertItems.map(({ count, label, icon: Icon, color, path }) => (
            <button
              key={label}
              onClick={() => navigate(path)}
              className={`flex items-center gap-3 p-3 rounded-lg border text-left hover:shadow-sm transition-shadow ${color}`}
            >
              <Icon size={18} />
              <div>
                <p className="font-bold text-lg leading-none">{count}</p>
                <p className="text-xs opacity-80 mt-0.5">{label}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Main stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Chats', value: s.activeChats ?? 0, icon: MessageSquare, color: 'text-blue-600', bg: 'bg-blue-50', path: '/app/chats' },
          { label: 'Pending Requests', value: s.pendingRequests ?? 0, icon: ClipboardList, color: 'text-yellow-600', bg: 'bg-yellow-50', path: '/app/requests' },
          { label: 'Open Orders', value: s.openOrders ?? 0, icon: ShoppingBag, color: 'text-orange-600', bg: 'bg-orange-50', path: '/app/orders' },
          { label: 'Active Guests', value: s.activeGuests ?? 0, icon: Users, color: 'text-green-600', bg: 'bg-green-50', path: '/app/rooms' },
        ].map(({ label, value, icon: Icon, color, bg, path }) => (
          <Card key={label} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(path)}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{label}</p>
                  <p className="text-3xl font-bold font-display">{value}</p>
                </div>
                <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`}>
                  <Icon size={18} className={color} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Billing + Activity row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Billing summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2"><IndianRupee size={16} /> Pending Billing</span>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => navigate('/app/orders')}>
                View all <ChevronRight size={13} />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-end justify-between pb-3 border-b">
              <div>
                <p className="text-xs text-muted-foreground">Total unacknowledged</p>
                <p className="text-3xl font-bold font-display text-amber-600">
                  ₹{(billing?.totalPending || 0).toLocaleString()}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">{billing?.orderCount || 0} orders</p>
            </div>
            {billing?.topRooms?.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Top rooms</p>
                {billing.topRooms.map((room: any) => (
                  <div
                    key={room.roomId}
                    className="flex items-center justify-between cursor-pointer hover:bg-muted/50 rounded px-2 py-1.5 -mx-2"
                    onClick={() => navigate(`/app/rooms/${room.roomId}`)}
                  >
                    <span className="text-sm font-medium">Room {room.roomNumber}</span>
                    <span className="font-semibold text-amber-600 text-sm">₹{room.total.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">All billing up to date ✓</p>
            )}
          </CardContent>
        </Card>

        {/* Live activity feed */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Zap size={16} className="text-primary" /> Live Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {activity.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No recent activity</p>
            ) : (
              <div className="divide-y max-h-72 overflow-y-auto scrollbar-thin">
                {activity.map((item: any) => {
                  const Icon = activityIcon[item.type] || Zap
                  return (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 px-5 py-3 hover:bg-muted/30 cursor-pointer"
                      onClick={() => navigate(item.type === 'order' ? '/app/orders' : item.type === 'request' ? '/app/requests' : '/app/chats')}
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${activityColor[item.type] || 'bg-gray-100'}`}>
                        <Icon size={13} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{item.message}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDistanceToNow(new Date(item.time), { addSuffix: true })}
                        </p>
                      </div>
                      {item.amount && (
                        <span className="text-xs font-semibold text-amber-600 flex-shrink-0">₹{item.amount}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Room status grid (mini) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2"><BedDouble size={16} /> Room Status</span>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => navigate('/app/rooms')}>
              Full view <ChevronRight size={13} />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> {s.activeGuests ?? 0} occupied</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-gray-300" /> {(s.totalRooms ?? 0) - (s.activeGuests ?? 0)} vacant</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400" /> {s.pendingRequests ?? 0} requests</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-400" /> {s.openOrders ?? 0} orders</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
