import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { useToast } from '@/components/ui/toast'
import { Badge, Card, CardContent } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select-switch'
import {
  Users, ClipboardList, CheckCircle2, Clock, Loader2,
  UserCheck, RefreshCw, BedDouble, AlertTriangle, Headphones
} from 'lucide-react'
import { format, differenceInMinutes } from 'date-fns'

const DELAY_THRESHOLD_MINS = 15
const isDelayed = (req: ServiceRequest) =>
  req.status === 'pending' &&
  differenceInMinutes(new Date(), new Date(req.createdAt)) >= DELAY_THRESHOLD_MINS

interface AssignedRequest {
  id: string
  type: string
  status: string
  room: { roomNumber: string }
}

interface StaffMember {
  id: string
  name: string
  role: string
  assignedRequests: AssignedRequest[]
}

interface ServiceRequest {
  id: string
  type: string
  details: string | null
  status: string
  createdAt: string
  room: { roomNumber: string }
  guestSession: { guestName: string }
  assignedTo: { id: string; name: string; role: string } | null
}

export default function StaffBoardPage() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null)

  const { data: staff = [], isLoading: staffLoading } = useQuery({
    queryKey: ['staff'],
    queryFn: () => api.get<StaffMember[]>('/requests/staff'),
    refetchInterval: 15000,
  })

  const { data: requests = [], isLoading: reqLoading } = useQuery({
    queryKey: ['requests-unassigned'],
    queryFn: () => api.get<ServiceRequest[]>('/requests?status=pending'),
    refetchInterval: 15000,
  })

  const { data: allActive = [] } = useQuery({
    queryKey: ['requests-active'],
    queryFn: () => api.get<ServiceRequest[]>('/requests?status=in_progress'),
    refetchInterval: 15000,
  })

  const assignMutation = useMutation({
    mutationFn: ({ requestId, staffId }: { requestId: string; staffId: string }) =>
      api.patch(`/requests/${requestId}/assign`, { staffId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff'] })
      qc.invalidateQueries({ queryKey: ['requests-unassigned'] })
      qc.invalidateQueries({ queryKey: ['requests-active'] })
      qc.invalidateQueries({ queryKey: ['requests'] })
      setSelectedRequest(null)
      toast('Staff assigned — guest has been notified', 'success')
    },
    onError: (err: any) => toast(err.message, 'error'),
  })

  const unassignMutation = useMutation({
    mutationFn: (requestId: string) =>
      api.patch(`/requests/${requestId}/assign`, { staffId: null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff'] })
      qc.invalidateQueries({ queryKey: ['requests-unassigned'] })
      qc.invalidateQueries({ queryKey: ['requests-active'] })
      qc.invalidateQueries({ queryKey: ['requests'] })
      toast('Staff unassigned', 'success')
    },
    onError: (err: any) => toast(err.message, 'error'),
  })

  const conciergeStaff = staff.filter(s => s.role === 'frontdesk')
  const nonConciergeStaff = staff.filter(s => s.role !== 'frontdesk')
  const freeStaff = staff.filter(s => s.assignedRequests.length === 0)
  const busyStaff = staff.filter(s => s.assignedRequests.length > 0)
  const freeConcierge = conciergeStaff.filter(s => s.assignedRequests.length === 0)
  const busyConcierge = conciergeStaff.filter(s => s.assignedRequests.length > 0)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Staff Board</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-sm text-muted-foreground">
              {freeStaff.length} free · {busyStaff.length} busy · {requests.length} unassigned
            </p>
            {requests.filter(isDelayed).length > 0 && (
              <span className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                <AlertTriangle size={11} /> {requests.filter(isDelayed).length} delayed
              </span>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => {
          qc.invalidateQueries({ queryKey: ['staff'] })
          qc.invalidateQueries({ queryKey: ['requests-unassigned'] })
          qc.invalidateQueries({ queryKey: ['requests-active'] })
        }}>
          <RefreshCw size={14} className="mr-2" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* LEFT: Unassigned Requests */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <ClipboardList size={16} className="text-amber-600" />
            <h2 className="font-semibold text-sm">Unassigned Requests</h2>
            {requests.length > 0 && (
              <span className="bg-amber-100 text-amber-700 text-xs rounded-full px-2 py-0.5 font-medium">
                {requests.length}
              </span>
            )}
          </div>

          {reqLoading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
            ))}</div>
          ) : requests.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground border-2 border-dashed rounded-xl">
              <CheckCircle2 size={32} className="mx-auto mb-2 text-green-400" />
              <p className="text-sm font-medium">All caught up!</p>
              <p className="text-xs mt-1">No pending unassigned requests</p>
            </div>
          ) : (
            requests.map(req => {
              const delayed = isDelayed(req)
              const minutesOld = differenceInMinutes(new Date(), new Date(req.createdAt))
              return (
              <Card key={req.id} className={`transition-all ${selectedRequest === req.id ? 'ring-2 ring-primary' : ''} ${delayed ? 'border-red-300 bg-red-50/30' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${delayed ? 'bg-red-100' : 'bg-amber-100'}`}>
                      {delayed
                        ? <AlertTriangle size={14} className="text-red-600" />
                        : <BedDouble size={14} className="text-amber-700" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="font-semibold text-sm">Room {req.room.roomNumber}</span>
                        <span className="text-xs text-muted-foreground">· {req.guestSession.guestName}</span>
                        {delayed && (
                          <span className="text-xs font-medium text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
                            {minutesOld - DELAY_THRESHOLD_MINS}m overdue
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-foreground">{req.type}</p>
                      {req.details && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{req.details}</p>}
                      <p className="text-xs text-muted-foreground mt-1">{format(new Date(req.createdAt), 'HH:mm')} · {minutesOld}m ago</p>
                    </div>
                    <div className="flex-shrink-0">
                      <Select
                        value=""
                        onValueChange={(staffId) => assignMutation.mutate({ requestId: req.id, staffId })}
                      >
                        <SelectTrigger className="h-8 text-xs w-36">
                          <UserCheck size={12} className="mr-1.5 text-muted-foreground" />
                          <SelectValue placeholder="Assign to..." />
                        </SelectTrigger>
                        <SelectContent>
                          {staff.length === 0 && (
                            <SelectItem value="none" disabled>No staff found</SelectItem>
                          )}
                          {freeConcierge.length > 0 && (
                            <>
                              <div className="px-2 py-1 text-xs text-muted-foreground font-medium">Concierge (Front Desk)</div>
                              {freeConcierge.map(s => (
                                <SelectItem key={s.id} value={s.id}>
                                  ★ {s.name}
                                </SelectItem>
                              ))}
                            </>
                          )}
                          {busyConcierge.length > 0 && (
                            <>
                              <div className="px-2 py-1 text-xs text-muted-foreground font-medium">Concierge (Busy)</div>
                              {busyConcierge.map(s => (
                                <SelectItem key={s.id} value={s.id}>
                                  · {s.name} ({s.assignedRequests.length} task)
                                </SelectItem>
                              ))}
                            </>
                          )}
                          {nonConciergeStaff.filter(s => s.assignedRequests.length === 0).length > 0 && (
                            <>
                              <div className="px-2 py-1 text-xs text-muted-foreground font-medium">Other Staff (Free)</div>
                              {nonConciergeStaff.filter(s => s.assignedRequests.length === 0).map(s => (
                                <SelectItem key={s.id} value={s.id}>
                                  ✓ {s.name} <span className="text-muted-foreground">({s.role})</span>
                                </SelectItem>
                              ))}
                            </>
                          )}
                          {nonConciergeStaff.filter(s => s.assignedRequests.length > 0).length > 0 && (
                            <>
                              <div className="px-2 py-1 text-xs text-muted-foreground font-medium">Other Staff (Busy)</div>
                              {nonConciergeStaff.filter(s => s.assignedRequests.length > 0).map(s => (
                                <SelectItem key={s.id} value={s.id}>
                                  · {s.name} ({s.assignedRequests.length} task)
                                </SelectItem>
                              ))}
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )})
          )}
        </div>

        {/* RIGHT: Staff Status */}
        <div className="space-y-3">
          {/* Concierge / Front Desk Section */}
          {conciergeStaff.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Headphones size={16} className="text-amber-600" />
                <h2 className="font-semibold text-sm">Concierge / Front Desk</h2>
                <span className="bg-amber-100 text-amber-700 text-xs rounded-full px-2 py-0.5 font-medium">
                  {conciergeStaff.length}
                </span>
              </div>
              <div className="space-y-2">
                {conciergeStaff.map(member => {
                  const isFree = member.assignedRequests.length === 0
                  return (
                    <Card key={member.id} className="border-amber-200/50">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${
                            isFree ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {member.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm">{member.name}</span>
                              <Badge variant={isFree ? 'success' : 'info'} className="text-xs ml-auto">
                                {isFree ? 'Available' : `${member.assignedRequests.length} task(s)`}
                              </Badge>
                            </div>
                            {member.assignedRequests.length > 0 && (
                              <div className="space-y-1 mt-1.5">
                                {member.assignedRequests.map(task => (
                                  <div key={task.id} className="flex items-center gap-2 bg-amber-50 rounded-lg px-2 py-1">
                                    <Clock size={10} className="text-amber-600 flex-shrink-0" />
                                    <span className="text-xs flex-1 truncate">Room {task.room.roomNumber} · {task.type}</span>
                                    <button
                                      onClick={() => unassignMutation.mutate(task.id)}
                                      className="text-xs text-muted-foreground hover:text-red-500 transition-colors flex-shrink-0"
                                      title="Unassign"
                                    >
                                      <RefreshCw size={10} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                            {isFree && requests.length > 0 && (
                              <Select
                                value=""
                                onValueChange={(requestId) => assignMutation.mutate({ requestId, staffId: member.id })}
                              >
                                <SelectTrigger className="h-7 text-xs mt-2 w-full">
                                  <SelectValue placeholder="Assign a request..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {requests.map(r => (
                                    <SelectItem key={r.id} value={r.id}>
                                      Room {r.room.roomNumber} · {r.type}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Users size={16} className="text-primary" />
            <h2 className="font-semibold text-sm">All Staff</h2>
          </div>

          {staffLoading ? (
            <div className="space-y-2">{[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
            ))}</div>
          ) : staff.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground border-2 border-dashed rounded-xl">
              <Users size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No staff members found</p>
            </div>
          ) : (
            staff.map(member => {
              const isFree = member.assignedRequests.length === 0
              return (
                <Card key={member.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${
                        isFree ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {member.name.charAt(0).toUpperCase()}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm">{member.name}</span>
                          <span className="text-xs text-muted-foreground capitalize">{member.role}</span>
                          <Badge variant={isFree ? 'success' : 'info'} className="text-xs ml-auto">
                            {isFree ? (
                              <><CheckCircle2 size={10} className="mr-1" />Free</>
                            ) : (
                              <><Loader2 size={10} className="mr-1 animate-spin" />Busy</>
                            )}
                          </Badge>
                        </div>

                        {/* Active tasks */}
                        {member.assignedRequests.length > 0 ? (
                          <div className="space-y-1.5 mt-1">
                            {member.assignedRequests.map(task => (
                              <div key={task.id} className="flex items-center gap-2 bg-muted/50 rounded-lg px-2.5 py-1.5">
                                <Clock size={11} className="text-blue-500 flex-shrink-0" />
                                <span className="text-xs flex-1 truncate">
                                  Room {task.room.roomNumber} · {task.type}
                                </span>
                                <button
                                  onClick={() => unassignMutation.mutate(task.id)}
                                  className="text-xs text-muted-foreground hover:text-red-500 transition-colors flex-shrink-0"
                                  title="Unassign"
                                >
                                  <RefreshCw size={11} />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground mt-0.5">No active tasks — ready to assign</p>
                        )}

                        {/* Reassign button if busy */}
                        {member.assignedRequests.length > 0 && requests.length > 0 && (
                          <div className="mt-2">
                            <Select
                              value=""
                              onValueChange={(requestId) => assignMutation.mutate({ requestId, staffId: member.id })}
                            >
                              <SelectTrigger className="h-7 text-xs w-full">
                                <SelectValue placeholder="Assign another request..." />
                              </SelectTrigger>
                              <SelectContent>
                                {requests.map(r => (
                                  <SelectItem key={r.id} value={r.id}>
                                    Room {r.room.roomNumber} · {r.type}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      </div>

      {/* Active / In Progress section */}
      {allActive.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Loader2 size={16} className="text-blue-500 animate-spin" />
            <h2 className="font-semibold text-sm">In Progress</h2>
            <span className="bg-blue-100 text-blue-700 text-xs rounded-full px-2 py-0.5 font-medium">
              {allActive.length}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {allActive.map(req => (
              <Card key={req.id}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-semibold text-sm">Room {req.room.roomNumber}</span>
                    <Badge variant="info" className="text-xs ml-auto">In Progress</Badge>
                  </div>
                  <p className="text-sm">{req.type}</p>
                  {req.assignedTo && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-semibold">
                        {req.assignedTo.name.charAt(0)}
                      </div>
                      <span className="text-xs text-muted-foreground">{req.assignedTo.name}</span>
                    </div>
                  )}
                  {!req.assignedTo && (
                    <Select
                      value=""
                      onValueChange={(staffId) => assignMutation.mutate({ requestId: req.id, staffId })}
                    >
                      <SelectTrigger className="h-7 text-xs mt-2 w-full">
                        <SelectValue placeholder="Assign staff..." />
                      </SelectTrigger>
                      <SelectContent>
                        {staff.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
