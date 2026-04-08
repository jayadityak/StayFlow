import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input, Label, Card, CardContent } from '@/components/ui/primitives'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select-switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  Plus, Pencil, BedDouble, Users, Layers, MessageSquare,
  UserCheck, UserX, Calendar, ShoppingBag, ClipboardList, IndianRupee
} from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

interface Room {
  id: string
  roomNumber: string
  roomType: string
  floor: number
  occupancy: number
  isActive: boolean
  isOccupied: boolean
  statusColor: string
  activeGuest: { guestName: string; checkInDate: string; checkOutDate: string } | null
  activeChatsCount: number
  pendingRequestsCount: number
  pendingOrdersCount: number
  pendingBilling: number
  hasEscalation: boolean
}

const ROOM_TYPES = ['standard', 'deluxe', 'suite', 'villa']
const TYPE_COLORS: Record<string, string> = {
  standard: 'bg-gray-100 text-gray-700',
  deluxe: 'bg-blue-100 text-blue-700',
  suite: 'bg-purple-100 text-purple-700',
  villa: 'bg-amber-100 text-amber-700',
}

const STATUS_DOT: Record<string, string> = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-400',
  red: 'bg-red-500',
}

export default function RoomsPage() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Room | null>(null)
  const [filter, setFilter] = useState<'all' | 'occupied' | 'vacant' | 'attention'>('all')
  const [form, setForm] = useState({ roomNumber: '', roomType: 'standard', floor: '1', occupancy: '2' })

  const { data: rooms = [], isLoading } = useQuery({
    queryKey: ['rooms'],
    queryFn: async () => {
      await api.post('/rooms/expire-checkouts', {}).catch(() => {})
      return api.get<Room[]>('/rooms')
    },
    refetchInterval: 30000,
  })

  const saveMutation = useMutation({
    mutationFn: (data: any) =>
      editing ? api.put(`/rooms/${editing.id}`, data) : api.post('/rooms', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rooms'] })
      toast(editing ? 'Room updated' : 'Room added', 'success')
      setOpen(false)
      setEditing(null)
    },
    onError: (err: any) => toast(err.message, 'error'),
  })

  const toggleMutation = useMutation({
    mutationFn: (room: Room) => api.put(`/rooms/${room.id}`, { isActive: !room.isActive }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rooms'] }); toast('Room status updated', 'success') },
  })

  const openAdd = () => {
    setEditing(null)
    setForm({ roomNumber: '', roomType: 'standard', floor: '1', occupancy: '2' })
    setOpen(true)
  }

  const openEdit = (e: React.MouseEvent, room: Room) => {
    e.stopPropagation()
    setEditing(room)
    setForm({ roomNumber: room.roomNumber, roomType: room.roomType, floor: String(room.floor), occupancy: String(room.occupancy) })
    setOpen(true)
  }

  const filtered = rooms.filter((r: Room) => {
    if (filter === 'occupied') return r.isOccupied && r.isActive
    if (filter === 'vacant') return !r.isOccupied && r.isActive
    if (filter === 'attention') return r.statusColor !== 'green' && r.isActive
    return r.isActive
  })

  const occupied = rooms.filter((r: Room) => r.isOccupied && r.isActive).length
  const needsAttention = rooms.filter((r: Room) => r.statusColor !== 'green' && r.isActive).length
  const totalPendingBilling = rooms.reduce((sum: number, r: Room) => sum + r.pendingBilling, 0)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Rooms</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {occupied} occupied · {rooms.filter((r: Room) => !r.isOccupied && r.isActive).length} vacant
            {needsAttention > 0 && <span className="text-yellow-600 font-medium"> · {needsAttention} need attention</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {totalPendingBilling > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm">
              <span className="text-muted-foreground">Pending billing: </span>
              <span className="font-bold text-amber-700">₹{totalPendingBilling.toLocaleString()}</span>
            </div>
          )}
          <Button onClick={openAdd} className="gap-2">
            <Plus size={16} /> Add Room
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'all', label: `All (${rooms.filter((r: Room) => r.isActive).length})` },
          { key: 'occupied', label: `Occupied (${occupied})` },
          { key: 'vacant', label: `Vacant (${rooms.filter((r: Room) => !r.isOccupied && r.isActive).length})` },
          { key: 'attention', label: `⚠️ Needs Attention (${needsAttention})` },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key as any)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {[...Array(10)].map((_, i) => <div key={i} className="h-52 bg-muted animate-pulse rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <BedDouble size={40} className="mx-auto mb-3 opacity-30" />
          <p>No rooms found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((room: Room) => (
            <Card
              key={room.id}
              className={cn(
                "cursor-pointer hover:shadow-md transition-all border-2",
                room.statusColor === 'red' ? 'border-red-200 bg-red-50/30' :
                room.statusColor === 'yellow' ? 'border-yellow-200 bg-yellow-50/30' :
                'border-transparent hover:border-primary/20'
              )}
              onClick={() => navigate(`/app/rooms/${room.id}`)}
            >
              <CardContent className="p-4">
                {/* Top row */}
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-display text-2xl font-bold leading-none">{room.roomNumber}</p>
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mt-1.5 ${TYPE_COLORS[room.roomType] || 'bg-gray-100 text-gray-700'}`}>
                      {room.roomType}
                    </span>
                  </div>
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-1 ${STATUS_DOT[room.statusColor] || 'bg-gray-300'}`} />
                </div>

                {/* Room info */}
                <div className="space-y-1 text-xs text-muted-foreground mb-2">
                  <div className="flex items-center gap-1.5">
                    <Layers size={10} /> Floor {room.floor} · <Users size={10} /> {room.occupancy} max
                  </div>
                </div>

                {/* Guest */}
                {room.isOccupied && room.activeGuest ? (
                  <div className="bg-green-50 rounded-lg p-2 mb-2">
                    <div className="flex items-center gap-1 text-green-700 mb-0.5">
                      <UserCheck size={11} />
                      <span className="text-xs font-medium truncate">{room.activeGuest.guestName}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-green-600">
                      <Calendar size={9} />
                      <span>Out {format(new Date(room.activeGuest.checkOutDate), 'MMM d')}</span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-2 mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <UserX size={11} /> Vacant
                  </div>
                )}

                {/* Activity indicators */}
                {(room.pendingRequestsCount > 0 || room.pendingOrdersCount > 0 || room.activeChatsCount > 0) && (
                  <div className="flex gap-2 mb-2 flex-wrap">
                    {room.activeChatsCount > 0 && (
                      <span className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                        <MessageSquare size={9} /> {room.activeChatsCount}
                      </span>
                    )}
                    {room.pendingRequestsCount > 0 && (
                      <span className="flex items-center gap-1 text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">
                        <ClipboardList size={9} /> {room.pendingRequestsCount}
                      </span>
                    )}
                    {room.pendingOrdersCount > 0 && (
                      <span className="flex items-center gap-1 text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">
                        <ShoppingBag size={9} /> {room.pendingOrdersCount}
                      </span>
                    )}
                  </div>
                )}

                {/* Billing */}
                {room.pendingBilling > 0 && (
                  <div className="flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-1 rounded mb-2">
                    <IndianRupee size={10} /> ₹{room.pendingBilling.toLocaleString()} pending
                  </div>
                )}

                {/* Edit button */}
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full h-7 text-xs mt-1 text-muted-foreground"
                  onClick={(e) => openEdit(e, room)}
                >
                  <Pencil size={11} className="mr-1" /> Edit Room
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? `Edit Room ${editing.roomNumber}` : 'Add New Room'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={e => { e.preventDefault(); saveMutation.mutate({ ...form, floor: parseInt(form.floor), occupancy: parseInt(form.occupancy) }) }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Room Number</Label>
                <Input value={form.roomNumber} onChange={e => setForm(p => ({ ...p, roomNumber: e.target.value }))} placeholder="e.g. 101" required disabled={!!editing} />
                {editing && <p className="text-xs text-muted-foreground">Cannot change room number</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Floor</Label>
                <Input type="number" value={form.floor} onChange={e => setForm(p => ({ ...p, floor: e.target.value }))} min="1" required />
              </div>
              <div className="space-y-1.5">
                <Label>Room Type</Label>
                <Select value={form.roomType} onValueChange={v => setForm(p => ({ ...p, roomType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROOM_TYPES.map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Max Occupancy</Label>
                <Input type="number" value={form.occupancy} onChange={e => setForm(p => ({ ...p, occupancy: e.target.value }))} min="1" required />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving...' : editing ? 'Save Changes' : 'Add Room'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
