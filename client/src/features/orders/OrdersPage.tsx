import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardContent } from '@/components/ui/primitives'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select-switch'
import { ShoppingBag, DollarSign, CheckCircle2, Clock, Loader2 } from 'lucide-react'
import { format } from 'date-fns'

interface OrderItem {
  id: string
  itemNameSnapshot: string
  itemPriceSnapshot: number
  quantity: number
}

interface Order {
  id: string
  status: string
  totalAmount: number
  isBillable: boolean
  frontDeskAcknowledged: boolean
  createdAt: string
  items: OrderItem[]
  room: { roomNumber: string }
  guestSession: { guestName: string }
}

const STATUS_CONFIG: Record<string, { label: string; variant: any }> = {
  placed: { label: 'Placed', variant: 'info' },
  preparing: { label: 'Preparing', variant: 'warning' },
  delivered: { label: 'Delivered', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'destructive' },
}

export default function OrdersPage() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('all')

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders', statusFilter],
    queryFn: () => api.get<Order[]>(`/orders${statusFilter !== 'all' ? `?status=${statusFilter}` : ''}`),
    refetchInterval: 8000,
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/orders/${id}/status`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); toast('Order updated', 'success') },
    onError: (err: any) => toast(err.message, 'error'),
  })

  const ackMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/orders/${id}/acknowledge`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); toast('Order acknowledged for billing', 'success') },
    onError: (err: any) => toast(err.message, 'error'),
  })

  const totalPending = orders.filter(o => ['placed', 'preparing'].includes(o.status)).reduce((sum, o) => sum + o.totalAmount, 0)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Food & Beverage Orders</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {orders.filter(o => ['placed', 'preparing'].includes(o.status)).length} active orders · ₹{totalPending.toLocaleString()} pending billing
          </p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Orders</SelectItem>
            <SelectItem value="placed">Placed</SelectItem>
            <SelectItem value="preparing">Preparing</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-muted animate-pulse rounded-lg" />)}</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ShoppingBag size={40} className="mx-auto mb-3 opacity-30" />
          <p>No orders found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(order => {
            const sc = STATUS_CONFIG[order.status] || { label: order.status, variant: 'outline' }
            return (
              <Card key={order.id} className={!order.frontDeskAcknowledged && order.isBillable ? 'border-amber-300 bg-amber-50/30' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className="font-semibold text-sm">Room {order.room.roomNumber}</span>
                        <span className="text-muted-foreground text-xs">·</span>
                        <span className="text-sm">{order.guestSession.guestName}</span>
                        <Badge variant={sc.variant} className="text-xs">{sc.label}</Badge>
                        {!order.frontDeskAcknowledged && order.isBillable && (
                          <Badge variant="warning" className="text-xs gap-1 animate-pulse">
                            <DollarSign size={10} /> Billing needed
                          </Badge>
                        )}
                        {order.frontDeskAcknowledged && (
                          <Badge variant="success" className="text-xs gap-1">
                            <CheckCircle2 size={10} /> Billing acknowledged
                          </Badge>
                        )}
                      </div>
                      <div className="space-y-0.5">
                        {order.items.map((item, idx) => (
                          <p key={idx} className="text-xs text-muted-foreground">
                            {item.itemNameSnapshot} × {item.quantity} — ₹{(item.itemPriceSnapshot * item.quantity).toLocaleString()}
                          </p>
                        ))}
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="font-semibold text-sm">Total: ₹{order.totalAmount.toLocaleString()}</span>
                        <span className="text-xs text-muted-foreground">{format(new Date(order.createdAt), 'MMM d, HH:mm')}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0 flex-wrap">
                      {order.status === 'placed' && (
                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => statusMutation.mutate({ id: order.id, status: 'preparing' })}>
                          <Loader2 size={11} className="mr-1" /> Preparing
                        </Button>
                      )}
                      {order.status === 'preparing' && (
                        <Button size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700" onClick={() => statusMutation.mutate({ id: order.id, status: 'delivered' })}>
                          <CheckCircle2 size={11} className="mr-1" /> Delivered
                        </Button>
                      )}
                      {!order.frontDeskAcknowledged && order.isBillable && (
                        <Button size="sm" variant="outline" className="h-8 text-xs border-amber-400 text-amber-700 hover:bg-amber-50" onClick={() => ackMutation.mutate(order.id)}>
                          <DollarSign size={11} className="mr-1" /> Acknowledge Bill
                        </Button>
                      )}
                      {['placed', 'preparing'].includes(order.status) && (
                        <Button size="sm" variant="ghost" className="h-8 text-xs text-red-600 hover:bg-red-50" onClick={() => statusMutation.mutate({ id: order.id, status: 'cancelled' })}>
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
