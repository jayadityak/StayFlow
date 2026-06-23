import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input, Badge, Card, CardContent, CardHeader, CardTitle, Separator } from '@/components/ui/primitives'
import {
  ArrowLeft, User, MessageSquare, ClipboardList, ShoppingBag,
  DollarSign, Send, CheckCircle2, Loader2, Clock, AlertTriangle,
  Bot, Headphones, Calendar, Mail, IndianRupee
} from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-600',
  placed: 'bg-blue-100 text-blue-800',
  preparing: 'bg-orange-100 text-orange-800',
  delivered: 'bg-green-100 text-green-800',
}

export default function RoomPanel() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const qc = useQueryClient()
  const [reply, setReply] = useState('')
  const [activeTab, setActiveTab] = useState<'chat' | 'requests' | 'orders' | 'billing'>('chat')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['room-panel', id],
    queryFn: () => api.get<any>(`/rooms/${id}/panel`),
    refetchInterval: 8000,
  })

  const replyMutation = useMutation({
    mutationFn: ({ convId, content }: { convId: string; content: string }) =>
      api.post(`/chats/${convId}/reply`, { content }),
    onSuccess: () => { refetch(); setReply('') },
    onError: (err: any) => toast(err.message, 'error'),
  })

  const requestStatusMutation = useMutation({
    mutationFn: ({ reqId, status }: { reqId: string; status: string }) =>
      api.patch(`/requests/${reqId}/status`, { status }),
    onSuccess: () => { refetch(); toast('Status updated', 'success') },
    onError: (err: any) => toast(err.message, 'error'),
  })

  const orderStatusMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: string }) =>
      api.patch(`/orders/${orderId}/status`, { status }),
    onSuccess: () => { refetch(); toast('Order updated', 'success') },
    onError: (err: any) => toast(err.message, 'error'),
  })

  const ackAllMutation = useMutation({
    mutationFn: () => api.post(`/rooms/${id}/acknowledge-all`, {}),
    onSuccess: () => {
      refetch()
      qc.invalidateQueries({ queryKey: ['rooms'] })
      toast('All charges added to bill', 'success')
    },
    onError: (err: any) => toast(err.message, 'error'),
  })

  const formatMsg = (content: string) =>
    content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>')

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />)}
        </div>
      </div>
    )
  }

  if (!data) return <div className="p-6 text-muted-foreground">Room not found</div>

  const { room, activeGuest, conversation, requests, orders, billing } = data

  const tabs = [
    { key: 'chat', label: 'Chat', icon: MessageSquare, count: conversation?.messages?.length || 0 },
    { key: 'requests', label: 'Requests', icon: ClipboardList, count: requests?.filter((r: any) => ['pending','in_progress'].includes(r.status)).length || 0 },
    { key: 'orders', label: 'Orders', icon: ShoppingBag, count: orders?.filter((o: any) => ['placed','preparing'].includes(o.status)).length || 0 },
    { key: 'billing', label: 'Billing', icon: IndianRupee, count: billing?.unacknowledgedOrders?.length || 0 },
  ]

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center gap-4 flex-shrink-0">
        <Button variant="ghost" size="icon" onClick={() => navigate('/app/rooms')}>
          <ArrowLeft size={18} />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-xl font-semibold">Room {room.roomNumber}</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
              room.roomType === 'villa' ? 'bg-amber-100 text-amber-700' :
              room.roomType === 'suite' ? 'bg-purple-100 text-purple-700' :
              room.roomType === 'deluxe' ? 'bg-blue-100 text-blue-700' :
              'bg-gray-100 text-gray-700'
            }`}>{room.roomType}</span>
            {activeGuest ? (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full" /> Occupied
              </span>
            ) : (
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Vacant</span>
            )}
          </div>
          {activeGuest && (
            <p className="text-sm text-muted-foreground mt-0.5">{activeGuest.guestName} · Checkout {format(new Date(activeGuest.checkOutDate), 'MMM d')}</p>
          )}
        </div>
        {billing?.total > 0 && (
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Pending billing</p>
            <p className="font-bold text-lg text-amber-600">₹{billing.total.toLocaleString()}</p>
          </div>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel - Guest info + stats */}
        <div className="w-64 border-r bg-white flex-shrink-0 overflow-y-auto p-4 space-y-4 hidden lg:block">
          {/* Guest info */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><User size={14} /> Guest Info</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {activeGuest ? (
                <>
                  <p className="font-medium text-sm">{activeGuest.guestName}</p>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Mail size={11} /> {activeGuest.email}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar size={11} />
                    {format(new Date(activeGuest.checkInDate), 'MMM d')} → {format(new Date(activeGuest.checkOutDate), 'MMM d')}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No active guest</p>
              )}
            </CardContent>
          </Card>

          {/* Quick stats */}
          <div className="space-y-2">
            {[
              { label: 'Open Requests', value: requests?.filter((r: any) => ['pending','in_progress'].includes(r.status)).length || 0, color: 'text-yellow-600' },
              { label: 'Active Orders', value: orders?.filter((o: any) => ['placed','preparing'].includes(o.status)).length || 0, color: 'text-blue-600' },
              { label: 'Pending Bill', value: `₹${(billing?.total || 0).toLocaleString()}`, color: 'text-amber-600' },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-xs text-muted-foreground">{label}</span>
                <span className={`font-bold text-sm ${color}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b bg-white flex-shrink-0">
            {tabs.map(({ key, label, icon: Icon, count }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key as any)}
                className={cn(
                  "flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors",
                  activeTab === key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon size={15} /> {label}
                {count > 0 && (
                  <span className={cn(
                    "text-xs rounded-full px-1.5 py-0.5 font-semibold",
                    activeTab === key ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                  )}>{count}</span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* CHAT TAB */}
            {activeTab === 'chat' && (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#F1F5F9]/30">
                  {!conversation ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <MessageSquare size={36} className="mb-2 opacity-20" />
                      <p className="text-sm">No active conversation</p>
                    </div>
                  ) : conversation.messages?.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-8">No messages yet</p>
                  ) : (
                    conversation.messages?.map((msg: any) => (
                      <div key={msg.id} className={cn("flex gap-2", msg.senderType === 'guest' ? "justify-start" : "justify-end")}>
                        {msg.senderType === 'guest' && (
                          <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <User size={13} className="text-gray-600" />
                          </div>
                        )}
                        <div className={cn(
                          "max-w-[70%] px-3.5 py-2.5 rounded-2xl text-sm",
                          msg.senderType === 'guest' ? "bg-white border rounded-tl-sm" :
                          msg.senderType === 'staff' ? "bg-blue-600 text-white rounded-tr-sm" :
                          "bg-[#0F172A] text-white rounded-tr-sm"
                        )}>
                          <div dangerouslySetInnerHTML={{ __html: formatMsg(msg.content) }} />
                          <div className="text-xs mt-1 opacity-50 text-right">{format(new Date(msg.createdAt), 'HH:mm')}</div>
                        </div>
                        {msg.senderType !== 'guest' && (
                          <div className={cn("w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                            msg.senderType === 'staff' ? "bg-blue-100" : "bg-amber-100")}>
                            {msg.senderType === 'staff' ? <Headphones size={13} className="text-blue-600" /> : <Bot size={13} className="text-amber-700" />}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
                {conversation && (
                  <div className="bg-white border-t p-3 flex gap-2 flex-shrink-0">
                    <Input
                      value={reply}
                      onChange={e => setReply(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && reply.trim() && replyMutation.mutate({ convId: conversation.id, content: reply.trim() })}
                      placeholder="Reply to guest..."
                      className="flex-1"
                    />
                    <Button
                      onClick={() => reply.trim() && replyMutation.mutate({ convId: conversation.id, content: reply.trim() })}
                      disabled={!reply.trim() || replyMutation.isPending}
                      size="icon" className="bg-[#0F172A] hover:bg-[#0F172A]/90"
                    >
                      <Send size={16} />
                    </Button>
                  </div>
                )}
              </>
            )}

            {/* REQUESTS TAB */}
            {activeTab === 'requests' && (
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {!requests?.length ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <ClipboardList size={36} className="mb-2 opacity-20" />
                    <p className="text-sm">No requests</p>
                  </div>
                ) : requests.map((req: any) => (
                  <Card key={req.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-medium text-sm">{req.type}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[req.status] || 'bg-gray-100'}`}>
                              {req.status.replace('_', ' ')}
                            </span>
                            {req.isBillable && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Billable</span>}
                          </div>
                          {req.details && <p className="text-xs text-muted-foreground line-clamp-2">{req.details}</p>}
                          <p className="text-xs text-muted-foreground mt-1">{format(new Date(req.createdAt), 'MMM d, HH:mm')}</p>
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0 flex-wrap">
                          {req.status === 'pending' && (
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => requestStatusMutation.mutate({ reqId: req.id, status: 'in_progress' })}>
                              Start
                            </Button>
                          )}
                          {req.status === 'in_progress' && (
                            <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700" disabled={!req.assignedTo} onClick={() => requestStatusMutation.mutate({ reqId: req.id, status: 'completed' })}>
                              <CheckCircle2 size={11} className="mr-1" /> Done
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* ORDERS TAB */}
            {activeTab === 'orders' && (
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {!orders?.length ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <ShoppingBag size={36} className="mb-2 opacity-20" />
                    <p className="text-sm">No orders</p>
                  </div>
                ) : orders.map((order: any) => (
                  <Card key={order.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[order.status] || 'bg-gray-100'}`}>
                              {order.status}
                            </span>
                            <span className="font-semibold text-sm">₹{order.totalAmount.toLocaleString()}</span>
                            {!order.frontDeskAcknowledged && order.isBillable && (
                              <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full animate-pulse">Billing needed</span>
                            )}
                          </div>
                          <div className="space-y-0.5">
                            {order.items?.map((item: any, i: number) => (
                              <p key={i} className="text-xs text-muted-foreground">
                                {item.itemNameSnapshot} × {item.quantity} — ₹{(item.itemPriceSnapshot * item.quantity).toLocaleString()}
                              </p>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{format(new Date(order.createdAt), 'MMM d, HH:mm')}</p>
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0 flex-wrap">
                          {order.status === 'placed' && (
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => orderStatusMutation.mutate({ orderId: order.id, status: 'preparing' })}>
                              <Loader2 size={11} className="mr-1" /> Prep
                            </Button>
                          )}
                          {order.status === 'preparing' && (
                            <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700" onClick={() => orderStatusMutation.mutate({ orderId: order.id, status: 'delivered' })}>
                              <CheckCircle2 size={11} className="mr-1" /> Delivered
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* BILLING TAB */}
            {activeTab === 'billing' && (
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold font-display text-amber-600">₹{(billing?.total || 0).toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Total pending to add to room bill</p>
                  </div>
                  {billing?.total > 0 && (
                    <Button
                      className="bg-amber-600 hover:bg-amber-700 gap-2"
                      onClick={() => ackAllMutation.mutate()}
                      disabled={ackAllMutation.isPending}
                    >
                      <CheckCircle2 size={15} />
                      {ackAllMutation.isPending ? 'Processing...' : 'Mark All Added to Bill'}
                    </Button>
                  )}
                </div>

                <Separator />

                {!billing?.unacknowledgedOrders?.length ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle2 size={36} className="mx-auto mb-2 opacity-20" />
                    <p className="text-sm">All charges have been added to bill</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Pending Charges</h3>
                    {billing.unacknowledgedOrders.map((order: any) => (
                      <Card key={order.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <ShoppingBag size={13} className="text-muted-foreground" />
                                <span className="text-sm font-medium">Food Order</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_COLORS[order.status]}`}>{order.status}</span>
                              </div>
                              {order.items?.map((item: any, i: number) => (
                                <p key={i} className="text-xs text-muted-foreground ml-5">
                                  {item.itemNameSnapshot} × {item.quantity}
                                </p>
                              ))}
                              <p className="text-xs text-muted-foreground ml-5 mt-1">{format(new Date(order.createdAt), 'MMM d, HH:mm')}</p>
                            </div>
                            <span className="font-bold text-amber-600">₹{order.totalAmount.toLocaleString()}</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {billing?.requests?.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Billable Services</h3>
                    {billing.requests.map((req: any) => (
                      <div key={req.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <span className="text-sm">{req.type}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[req.status]}`}>{req.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
