// NotificationsPage.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardContent } from '@/components/ui/primitives'
import { Bell, ShoppingBag, ClipboardList, MessageSquare, AlertTriangle, DollarSign, Check, CheckCheck, UserCheck } from 'lucide-react'
import { format } from 'date-fns'
import { useNavigate } from 'react-router-dom'

interface Notification {
  id: string
  type: string
  title: string
  body: string
  isRead: boolean
  relatedEntityType: string | null
  relatedEntityId: string | null
  createdAt: string
}

const TYPE_CONFIG: Record<string, { icon: any; variant: any; nav?: string }> = {
  new_order: { icon: ShoppingBag, variant: 'info', nav: '/app/orders' },
  new_request: { icon: ClipboardList, variant: 'warning', nav: '/app/requests' },
  request_assigned: { icon: UserCheck, variant: 'success', nav: '/app/requests' },
  escalation: { icon: AlertTriangle, variant: 'destructive', nav: '/app/chats' },
  new_chat: { icon: MessageSquare, variant: 'secondary', nav: '/app/chats' },
  billable_event: { icon: DollarSign, variant: 'warning', nav: '/app/orders' },
}

export default function NotificationsPage() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const navigate = useNavigate()

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<Notification[]>('/notifications'),
    refetchInterval: 8000,
  })

  const readMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const readAllMutation = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notifications'] }); toast('All notifications marked read', 'success') },
  })

  const unread = notifications.filter(n => !n.isRead).length

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-1">{unread} unread</p>
        </div>
        {unread > 0 && (
          <Button variant="outline" size="sm" onClick={() => readAllMutation.mutate()} className="gap-2">
            <CheckCheck size={14} /> Mark all read
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />)}</div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Bell size={40} className="mx-auto mb-3 opacity-30" />
          <p>No notifications</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => {
            const cfg = TYPE_CONFIG[n.type] || { icon: Bell, variant: 'secondary' }
            const Icon = cfg.icon
            return (
              <Card key={n.id} className={!n.isRead ? 'border-primary/30 bg-primary/3' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${!n.isRead ? 'bg-primary/10' : 'bg-muted'}`}>
                      <Icon size={16} className={!n.isRead ? 'text-primary' : 'text-muted-foreground'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-medium ${!n.isRead ? 'text-foreground' : 'text-muted-foreground'}`}>{n.title}</p>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-muted-foreground">{format(new Date(n.createdAt), 'HH:mm')}</span>
                          {!n.isRead && <div className="w-2 h-2 bg-primary rounded-full" />}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                      <div className="flex gap-2 mt-2">
                        {cfg.nav && (
                          <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => navigate(cfg.nav!)}>
                            View
                          </Button>
                        )}
                        {!n.isRead && (
                          <Button size="sm" variant="ghost" className="h-7 text-xs px-2 text-muted-foreground" onClick={() => readMutation.mutate(n.id)}>
                            <Check size={11} className="mr-1" /> Mark read
                          </Button>
                        )}
                      </div>
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
