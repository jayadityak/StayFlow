import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input, Label, Card, CardContent, CardHeader, CardTitle, Separator } from '@/components/ui/primitives'
import { Switch, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select-switch'
import { Settings, Save, Mic, Volume2 } from 'lucide-react'

export default function SettingsPage() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [form, setForm] = useState({
    name: '', phone: '', frontDeskNumber: '', supportEmail: '',
    address: '', city: '', state: '', checkInTime: '', checkOutTime: '',
    voiceEnabled: true, voiceAutoSend: false, voiceLanguage: 'en-IN',
  })

  const { data: hotel, isLoading } = useQuery({
    queryKey: ['hotel'],
    queryFn: () => api.get<any>('/hotel'),
  })

  useEffect(() => {
    if (hotel) {
      setForm({
        name: hotel.name || '',
        phone: hotel.phone || '',
        frontDeskNumber: hotel.frontDeskNumber || '',
        supportEmail: hotel.supportEmail || '',
        address: hotel.address || '',
        city: hotel.city || '',
        state: hotel.state || '',
        checkInTime: hotel.checkInTime || '14:00',
        checkOutTime: hotel.checkOutTime || '12:00',
        voiceEnabled: hotel.voiceEnabled ?? true,
        voiceAutoSend: hotel.voiceAutoSend ?? false,
        voiceLanguage: hotel.voiceLanguage || 'en-IN',
      })
    }
  }, [hotel])

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.put('/hotel', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hotel'] })
      toast('Settings saved', 'success')
    },
    onError: (err: any) => toast(err.message, 'error'),
  })

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

  if (isLoading) return <div className="p-6"><div className="h-64 bg-muted animate-pulse rounded-lg" /></div>

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your hotel information and preferences</p>
      </div>

      {/* Hotel Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings size={16} /> Hotel Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label>Hotel Name</Label>
              <Input value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Front Desk Number</Label>
              <Input value={form.frontDeskNumber} onChange={e => set('frontDeskNumber', e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Support Email</Label>
              <Input type="email" value={form.supportEmail} onChange={e => set('supportEmail', e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Address</Label>
              <Input value={form.address} onChange={e => set('address', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>City</Label>
              <Input value={form.city} onChange={e => set('city', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>State</Label>
              <Input value={form.state} onChange={e => set('state', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Check-in Time</Label>
              <Input type="time" value={form.checkInTime} onChange={e => set('checkInTime', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Check-out Time</Label>
              <Input type="time" value={form.checkOutTime} onChange={e => set('checkOutTime', e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Voice Assistant Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mic size={16} /> Voice Assistant
            <span className="ml-auto text-xs font-normal text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Premium</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Enable toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Enable Voice Assistant</p>
              <p className="text-xs text-muted-foreground mt-0.5">Allow guests to use voice input and listen to responses in chat</p>
            </div>
            <Switch checked={form.voiceEnabled} onCheckedChange={v => set('voiceEnabled', v)} />
          </div>

          {form.voiceEnabled && (
            <>
              <Separator />

              {/* Language */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Default Language</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Guests can switch languages in chat</p>
                </div>
                <Select value={form.voiceLanguage} onValueChange={v => set('voiceLanguage', v)}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en-IN">English (India)</SelectItem>
                    <SelectItem value="hi-IN">Hindi (हिंदी)</SelectItem>
                    <SelectItem value="ar-SA">Arabic (العربية)</SelectItem>
                    <SelectItem value="zh-CN">Chinese (中文)</SelectItem>
                    <SelectItem value="fr-FR">French (Français)</SelectItem>
                    <SelectItem value="de-DE">German (Deutsch)</SelectItem>
                    <SelectItem value="es-ES">Spanish (Español)</SelectItem>
                    <SelectItem value="ru-RU">Russian (Русский)</SelectItem>
                    <SelectItem value="ja-JP">Japanese (日本語)</SelectItem>
                    <SelectItem value="ko-KR">Korean (한국어)</SelectItem>
                    <SelectItem value="pt-BR">Portuguese (Português)</SelectItem>
                    <SelectItem value="it-IT">Italian (Italiano)</SelectItem>
                    <SelectItem value="en-US">English (US)</SelectItem>
                    <SelectItem value="en-GB">English (UK)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Auto-send */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Auto-send Voice Messages</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Send message immediately after speech recognition (no review)</p>
                </div>
                <Switch checked={form.voiceAutoSend} onCheckedChange={v => set('voiceAutoSend', v)} />
              </div>

              {/* Info box */}
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-1">
                <p className="text-xs font-medium text-blue-800 flex items-center gap-1.5">
                  <Volume2 size={12} /> How voice works for guests
                </p>
                <ul className="text-xs text-blue-700 space-y-0.5 ml-4 list-disc">
                  <li>Tap the mic button to speak in the chat</li>
                  <li>Speech is converted to text using the browser</li>
                  <li>Guests can edit before sending (unless auto-send is on)</li>
                  <li>Assistant replies can be played back via speaker icon</li>
                  <li>Works in Chrome and Safari on mobile</li>
                </ul>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Save button */}
      <div className="flex justify-end">
        <Button onClick={() => updateMutation.mutate(form)} disabled={updateMutation.isPending} className="gap-2 px-6">
          <Save size={15} />
          {updateMutation.isPending ? 'Saving...' : 'Save All Settings'}
        </Button>
      </div>

      {/* Hotel Slug */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hotel URL</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-muted rounded-lg p-3 font-mono text-sm text-muted-foreground break-all">
            {window.location.origin}/hotel/{hotel?.slug}/verify
          </div>
          <p className="text-xs text-muted-foreground mt-2">Share this link or the QR code with guests</p>
        </CardContent>
      </Card>
    </div>
  )
}
