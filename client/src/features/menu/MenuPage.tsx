import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input, Label, Card, CardContent, Badge, Textarea } from '@/components/ui/primitives'
import { Switch, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select-switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, UtensilsCrossed } from 'lucide-react'

interface MenuItem {
  id: string
  name: string
  category: string
  description: string | null
  isVegetarian: boolean
  price: number
  isAvailable: boolean
}

const CATEGORIES = ['breakfast', 'lunch', 'dinner', 'beverages', 'snacks', 'desserts']
const CAT_COLORS: Record<string, string> = {
  breakfast: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  lunch: 'bg-orange-50 text-orange-700 border-orange-200',
  dinner: 'bg-red-50 text-red-700 border-red-200',
  beverages: 'bg-blue-50 text-blue-700 border-blue-200',
  snacks: 'bg-green-50 text-green-700 border-green-200',
  desserts: 'bg-pink-50 text-pink-700 border-pink-200',
}

export default function MenuPage() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<MenuItem | null>(null)
  const [filter, setFilter] = useState('all')
  const [form, setForm] = useState({ name: '', category: 'breakfast', description: '', isVegetarian: false, price: '', isAvailable: true })

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['menu-items'],
    queryFn: () => api.get<MenuItem[]>('/menu-items'),
  })

  const saveMutation = useMutation({
    mutationFn: (d: any) => editing ? api.put(`/menu-items/${editing.id}`, d) : api.post('/menu-items', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu-items'] })
      toast(editing ? 'Item updated' : 'Item added', 'success')
      setOpen(false)
    },
    onError: (err: any) => toast(err.message, 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/menu-items/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['menu-items'] }); toast('Item removed', 'info') },
    onError: (err: any) => toast(err.message, 'error'),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, val }: { id: string; val: boolean }) => api.put(`/menu-items/${id}`, { isAvailable: val }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu-items'] }),
  })

  const openAdd = () => {
    setEditing(null)
    setForm({ name: '', category: 'breakfast', description: '', isVegetarian: false, price: '', isAvailable: true })
    setOpen(true)
  }

  const openEdit = (item: MenuItem) => {
    setEditing(item)
    setForm({ name: item.name, category: item.category, description: item.description || '', isVegetarian: item.isVegetarian, price: String(item.price), isAvailable: item.isAvailable })
    setOpen(true)
  }

  const filtered = filter === 'all' ? items : items.filter(i => i.category === filter)

  const grouped = CATEGORIES.reduce<Record<string, MenuItem[]>>((acc, cat) => {
    const catItems = filtered.filter(i => i.category === cat)
    if (catItems.length) acc[cat] = catItems
    return acc
  }, {})

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">F&B Menu</h1>
          <p className="text-sm text-muted-foreground mt-1">{items.length} items across {CATEGORIES.length} categories</p>
        </div>
        <Button onClick={openAdd} className="gap-2"><Plus size={16} /> Add Item</Button>
      </div>

      {/* Category filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {['all', ...CATEGORIES].map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${filter === cat ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />)}</div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <UtensilsCrossed size={40} className="mx-auto mb-3 opacity-30" />
          <p>No menu items yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([cat, catItems]) => (
            <div key={cat}>
              <h2 className={`text-xs font-semibold uppercase tracking-wider px-3 py-1.5 rounded-full inline-block mb-3 border ${CAT_COLORS[cat] || 'bg-gray-50 text-gray-700'}`}>
                {cat}
              </h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                {catItems.map(item => (
                  <Card key={item.id} className={!item.isAvailable ? 'opacity-60' : ''}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium">{item.name}</span>
                            <span>{item.isVegetarian ? '🟢' : '🔴'}</span>
                          </div>
                          {item.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.description}</p>}
                        </div>
                        <span className="font-semibold text-sm ml-2">₹{item.price}</span>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-1.5">
                          <Switch
                            checked={item.isAvailable}
                            onCheckedChange={val => toggleMutation.mutate({ id: item.id, val })}
                            className="scale-75"
                          />
                          <span className="text-xs text-muted-foreground">{item.isAvailable ? 'Available' : 'Unavailable'}</span>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(item)}><Pencil size={12} /></Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(item.id)}><Trash2 size={12} /></Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Menu Item' : 'Add Menu Item'}</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); saveMutation.mutate({ ...form, price: parseFloat(form.price) }) }} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Item Name</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Butter Chicken" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Price (₹)</Label>
                <Input type="number" step="0.01" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} placeholder="350" required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Brief description..." rows={2} />
            </div>
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={form.isVegetarian} onCheckedChange={v => setForm(p => ({ ...p, isVegetarian: v }))} />
                <Label>Vegetarian 🟢</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.isAvailable} onCheckedChange={v => setForm(p => ({ ...p, isAvailable: v }))} />
                <Label>Available</Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Saving...' : editing ? 'Save' : 'Add Item'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
