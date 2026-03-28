import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api, { setToken } from '@/lib/api'
import { useAuth } from './AuthContext'
import { Button } from '@/components/ui/button'
import { Input, Label, Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/primitives'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select-switch'
import { Hotel } from 'lucide-react'

export default function SignupPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    hotelName: '',
    adminName: '',
    email: '',
    password: '',
    phone: '',
    city: '',
    state: '',
    hotelType: 'boutique',
    totalRooms: '20',
  })

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await api.post<{ token: string }>('/auth/signup', {
        ...form,
        totalRooms: parseInt(form.totalRooms),
      })
      await login(form.email, form.password)
      navigate('/app/overview')
    } catch (err: any) {
      setError(err.message || 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-[#0F172A] flex items-center justify-center">
              <Hotel size={18} className="text-[#818CF8]" />
            </div>
            <span className="font-display text-xl font-semibold text-[#0F172A]">StayFlow</span>
          </Link>
        </div>

        <Card className="shadow-lg border-0">
          <CardHeader>
            <CardTitle className="text-2xl font-display">Create your hotel account</CardTitle>
            <CardDescription>Set up StayFlow for your property in minutes</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">{error}</div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1.5">
                  <Label>Hotel Name</Label>
                  <Input value={form.hotelName} onChange={e => set('hotelName', e.target.value)} placeholder="Grand Palace Hotel" required />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Your Name (Admin)</Label>
                  <Input value={form.adminName} onChange={e => set('adminName', e.target.value)} placeholder="John Smith" required />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="admin@hotel.com" required />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Password</Label>
                  <Input type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="••••••••" required minLength={6} />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+91-000-0000000" required />
                </div>
                <div className="space-y-1.5">
                  <Label>Total Rooms</Label>
                  <Input type="number" value={form.totalRooms} onChange={e => set('totalRooms', e.target.value)} min="1" required />
                </div>
                <div className="space-y-1.5">
                  <Label>City</Label>
                  <Input value={form.city} onChange={e => set('city', e.target.value)} placeholder="Mumbai" required />
                </div>
                <div className="space-y-1.5">
                  <Label>State</Label>
                  <Input value={form.state} onChange={e => set('state', e.target.value)} placeholder="Maharashtra" required />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Hotel Type</Label>
                  <Select value={form.hotelType} onValueChange={v => set('hotelType', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="luxury">Luxury</SelectItem>
                      <SelectItem value="boutique">Boutique</SelectItem>
                      <SelectItem value="business">Business</SelectItem>
                      <SelectItem value="resort">Resort</SelectItem>
                      <SelectItem value="budget">Budget</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button type="submit" className="w-full bg-[#0F172A] hover:bg-[#0F172A]/90 mt-2" disabled={loading}>
                {loading ? 'Creating account...' : 'Create hotel account'}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground mt-4">
              Already have an account?{' '}
              <Link to="/login" className="text-primary hover:underline font-medium">Sign in</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
