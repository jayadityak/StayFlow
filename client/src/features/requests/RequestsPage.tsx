import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthContext'
import api from '@/lib/api'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardContent } from '@/components/ui/primitives'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select-switch'
import { ClipboardList, Clock, DollarSign, CheckCircle2, XCircle, Loader2, UserCheck, AlertTriangle } from 'lucide-react'
import { format, differenceInMinutes } from 'date-fns'

interface ServiceRequest {
  id: string
  type: string
  details: string | null
  status: string
  isBillable: boolean
  staffNotes: string | null
  createdAt: string
  room: { roomNumber: string }
  guestSession: { guestName: string }
  assignedTo: { id: string; name: string } | null
}

const DELAY_THRESHOLD_MINS = 15

const isDelayed = (req: ServiceRequest) =>
  req.status === 'pending' &&
  differenceInMinutes(new Date(), new Date(req.createdAt)) >= DELAY_THRESHOLD_MINS

const STATUS_CONFIG: Record<string, { label: string; variant: any; icon: any }> = {
  pending:     { label: 'Pending',     variant: 'warning',     icon: Clock },
  delayed:     { label: 'Delayed',     variant: 'destructive', icon: AlertTriangle },
  in_progress: { label: 'In Progress', variant: 'info',        icon: Loader2 },
  completed:   { label: 'Completed',   variant: 'success',     icon: CheckCircle2 },
  cancelled:   { label: 'Cancelled',   variant: 'destructive', icon: XCircle },
}

const ROLE_TITLES: Record<string, string> = {
  admin: 'Service Requests',
  housekeeping: 'Housekeeping Requests',
  frontdesk: 'Front Desk Requests',
  restaurant: 'Restaurant Requests',
  staff: 'Service Requests',
}

export default function RequestsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('all')

  // 'delayed' is a client-computed view of pending requests — always fetch pending from server.
  const serverFilter = statusFilter === 'delayed' ? 'pending' : statusFilter

  const { data: raw = [], isLoading } = useQuery({
    queryKey: ['requests', serverFilter],
    queryFn: () => api.get<ServiceRequest[]>(`/requests${serverFilter !== 'all' ? `?status=${serverFilter}` : ''}`),
    refetchInterval: 10000,
  })

  const requests = statusFilter === 'delayed' ? raw.filter(isDelayed) : raw

  const delayedCount = raw.filter(r => r.status === 'pending').filter(isDelayed).length

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/requests/${id}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['requests'] })
      toast('Status updated', 'success')
    },
    onError: (err: any) => toast(err.message, 'error'),
  })

  const pendingCount = raw.filter(r => r.status === 'pending').length

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">{ROLE_TITLES[user?.role || 'staff']}</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-sm text-muted-foreground">{pendingCount} pending</p>
            {delayedCount > 0 && (
              <span className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                <AlertTriangle size={11} /> {delayedCount} delayed
              </span>
            )}
          </div>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Requests</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="delayed">
              Delayed {delayedCount > 0 && `(${delayedCount})`}
            </SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ClipboardList size={40} className="mx-auto mb-3 opacity-30" />
          <p>No requests found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(req => {
            const delayed = isDelayed(req)
            const statusKey = delayed ? 'delayed' : req.status
            const sc = STATUS_CONFIG[statusKey] || STATUS_CONFIG.pending
            const Icon = sc.icon
            const minutesOld = differenceInMinutes(new Date(), new Date(req.createdAt))

            return (
              <Card
                key={req.id}
                className={delayed ? 'border-red-300 bg-red-50/30' : ''}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-sm">Room {req.room.roomNumber}</span>
                        <span className="text-muted-foreground text-xs">·</span>
                        <span className="text-sm">{req.guestSession.guestName}</span>
                        <Badge variant={sc.variant} className="gap-1 text-xs">
                          <Icon size={10} className={req.status === 'in_progress' ? 'animate-spin' : ''} />
                          {sc.label}
                        </Badge>
                        {req.isBillable && (
                          <Badge variant="outline" className="text-xs gap-1 text-amber-700 border-amber-300">
                            <DollarSign size={10} /> Billable
                          </Badge>
                        )}
                      </div>
                      <p className="font-medium text-sm">{req.type}</p>
                      {req.details && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{req.details}</p>
                      )}
                      {req.staffNotes && (
                        <p className="text-xs text-blue-600 mt-1 italic">Note: {req.staffNotes}</p>
                      )}
                      {req.assignedTo && (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <UserCheck size={11} className="text-green-600" />
                          <span className="text-xs text-green-700 font-medium">
                            Assigned to {req.assignedTo.name}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-1.5">
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(req.createdAt), 'MMM d, HH:mm')}
                        </p>
                        {req.status === 'pending' && minutesOld > 0 && (
                          <p className={`text-xs font-medium ${delayed ? 'text-red-600' : 'text-muted-foreground'}`}>
                            · {minutesOld}m ago
                            {delayed && ` — ${minutesOld - DELAY_THRESHOLD_MINS}m overdue`}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0 flex-wrap">
                      {req.status === 'pending' && (
                        <Button
                          size="sm"
                          variant={delayed ? 'default' : 'outline'}
                          className={`h-8 text-xs ${delayed ? 'bg-red-600 hover:bg-red-700 text-white' : ''}`}
                          onClick={() => statusMutation.mutate({ id: req.id, status: 'in_progress' })}
                        >
                          Start
                        </Button>
                      )}
                      {req.status === 'in_progress' && (
                        <div className="flex flex-col items-end gap-1">
                          <Button
                            size="sm"
                            className="h-8 text-xs bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
                            onClick={() => statusMutation.mutate({ id: req.id, status: 'completed' })}
                            disabled={!req.assignedTo}
                            title={!req.assignedTo ? 'Assign a staff member before completing' : undefined}
                          >
                            <CheckCircle2 size={12} className="mr-1" /> Complete
                          </Button>
                          {!req.assignedTo && (
                            <p className="text-xs text-amber-600 flex items-center gap-1 whitespace-nowrap">
                              <AlertTriangle size={10} /> Assign staff first
                            </p>
                          )}
                        </div>
                      )}
                      {(req.status === 'pending' || req.status === 'in_progress') && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => statusMutation.mutate({ id: req.id, status: 'cancelled' })}
                        >
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
