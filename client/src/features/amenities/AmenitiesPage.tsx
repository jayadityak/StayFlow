import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input, Label, Card, CardContent, Textarea } from '@/components/ui/primitives'
import { Switch } from '@/components/ui/select-switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, Clock, Waves } from 'lucide-react'

interface Amenity {
  id: string
  name: string
  isAvailable: boolean
  openingTime: string | null
  closingTime: string | null
  notes: string | null
}

export default function AmenitiesPage() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Amenity | null>(null)
  const [form, setForm] = useState({ name: '', isAvailable: true, openingTime: '', closingTime: '', notes: '' })

  const { data: amenities = [], isLoading } = useQuery({
    queryKey: ['amenities'],
    queryFn: () => api.get<Amenity[]>('/amenities'),
  })

  const saveMutation = useMutation({
    mutationFn: (d: any) => editing ? api.put(`/amenities/${editing.id}`, d) : api.post('/amenities', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['amenities'] })
      toast(editing ? 'Amenity updated' : 'Amenity added', 'success')
      setOpen(false)
    },
    onError: (err: any) => toast(err.message, 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/amenities/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['amenities'] }); toast('Amenity removed', 'info') },
    onError: (err: any) => toast(err.message, 'error'),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, val }: { id: string; val: boolean }) => api.put(`/amenities/${id}`, { isAvailable: val }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['amenities'] }),
  })

  const openAdd = () => {
    setEditing(null)
    setForm({ name: '', isAvailable: true, openingTime: '', closingTime: '', notes: '' })
    setOpen(true)
  }

  const openEdit = (a: Amenity) => {
    setEditing(a)
    setForm({ name: a.name, isAvailable: a.isAvailable, openingTime: a.openingTime || '', closingTime: a.closingTime || '', notes: a.notes || '' })
    setOpen(true)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Amenities</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage hotel amenities and timings visible to guests</p>
        </div>
        <Button onClick={openAdd} className="gap-2"><Plus size={16} /> Add Amenity</Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />)}</div>
      ) : amenities.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Waves size={40} className="mx-auto mb-3 opacity-30" />
          <p>No amenities yet. Add your first amenity.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {amenities.map(a => (
            <Card key={a.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-sm">{a.name}</h3>
                      <Switch
                        checked={a.isAvailable}
                        onCheckedChange={val => toggleMutation.mutate({ id: a.id, val })}
                      />
                      <span className="text-xs text-muted-foreground">{a.isAvailable ? 'Available' : 'Unavailable'}</span>
                    </div>
                    {(a.openingTime || a.closingTime) && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                        <Clock size={11} />
                        {a.openingTime || '—'} – {a.closingTime || '—'}
                      </div>
                    )}
                    {a.notes && <p className="text-xs text-muted-foreground line-clamp-2">{a.notes}</p>}
                  </div>
                  <div className="flex gap-1 ml-3">
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEdit(a)}>
                      <Pencil size={13} />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(a.id)}>
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Amenity' : 'Add Amenity'}</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(form) }} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Swimming Pool" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Opening Time</Label>
                <Input type="time" value={form.openingTime} onChange={e => setForm(p => ({ ...p, openingTime: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Closing Time</Label>
                <Input type="time" value={form.closingTime} onChange={e => setForm(p => ({ ...p, closingTime: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="e.g. Towels provided, heated pool" rows={2} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.isAvailable} onCheckedChange={v => setForm(p => ({ ...p, isAvailable: v }))} />
              <Label>Available</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Saving...' : editing ? 'Save' : 'Add'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
