import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input, Label, Card, CardContent, Textarea, Badge } from '@/components/ui/primitives'
import { Switch } from '@/components/ui/select-switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, Clock, Wrench, DollarSign } from 'lucide-react'

interface Service {
  id: string
  name: string
  isEnabled: boolean
  openingTime: string | null
  closingTime: string | null
  notes: string | null
  isBillable: boolean
}

export default function ServicesPage() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Service | null>(null)
  const [form, setForm] = useState({ name: '', isEnabled: true, openingTime: '', closingTime: '', notes: '', isBillable: false })

  const { data: services = [], isLoading } = useQuery({
    queryKey: ['services'],
    queryFn: () => api.get<Service[]>('/services'),
  })

  const saveMutation = useMutation({
    mutationFn: (d: any) => editing ? api.put(`/services/${editing.id}`, d) : api.post('/services', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['services'] })
      toast(editing ? 'Service updated' : 'Service added', 'success')
      setOpen(false)
    },
    onError: (err: any) => toast(err.message, 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/services/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['services'] }); toast('Service removed', 'info') },
    onError: (err: any) => toast(err.message, 'error'),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, val }: { id: string; val: boolean }) => api.put(`/services/${id}`, { isEnabled: val }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
  })

  const openAdd = () => {
    setEditing(null)
    setForm({ name: '', isEnabled: true, openingTime: '', closingTime: '', notes: '', isBillable: false })
    setOpen(true)
  }

  const openEdit = (s: Service) => {
    setEditing(s)
    setForm({ name: s.name, isEnabled: s.isEnabled, openingTime: s.openingTime || '', closingTime: s.closingTime || '', notes: s.notes || '', isBillable: s.isBillable })
    setOpen(true)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Services</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage guest-facing services and their availability</p>
        </div>
        <Button onClick={openAdd} className="gap-2"><Plus size={16} /> Add Service</Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />)}</div>
      ) : services.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Wrench size={40} className="mx-auto mb-3 opacity-30" />
          <p>No services configured yet.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {services.map(s => (
            <Card key={s.id} className={!s.isEnabled ? 'opacity-60' : ''}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-sm">{s.name}</h3>
                      {s.isBillable && (
                        <Badge variant="warning" className="text-xs gap-1">
                          <DollarSign size={9} /> Billable
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mb-2">
                      <Switch checked={s.isEnabled} onCheckedChange={val => toggleMutation.mutate({ id: s.id, val })} />
                      <span className="text-xs text-muted-foreground">{s.isEnabled ? 'Enabled' : 'Disabled'}</span>
                    </div>
                    {(s.openingTime || s.closingTime) && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                        <Clock size={11} />
                        {s.openingTime || 'Any'} – {s.closingTime || 'Any'}
                      </div>
                    )}
                    {s.notes && <p className="text-xs text-muted-foreground line-clamp-2">{s.notes}</p>}
                  </div>
                  <div className="flex gap-1 ml-3">
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEdit(s)}>
                      <Pencil size={13} />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(s.id)}>
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
          <DialogHeader><DialogTitle>{editing ? 'Edit Service' : 'Add Service'}</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(form) }} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Service Name</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Housekeeping" required />
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
              <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Additional info for guests" rows={2} />
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Switch checked={form.isEnabled} onCheckedChange={v => setForm(p => ({ ...p, isEnabled: v }))} />
                <Label>Enabled</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.isBillable} onCheckedChange={v => setForm(p => ({ ...p, isBillable: v }))} />
                <Label>Billable service</Label>
              </div>
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
