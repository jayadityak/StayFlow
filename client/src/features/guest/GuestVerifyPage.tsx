import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input, Label, Card, CardContent } from '@/components/ui/primitives'
import { Hotel, Mail, CheckCircle2, Loader2 } from 'lucide-react'
import { SUPPORTED_LANGS, Lang, t, setLang, isRTL } from '@/lib/guestI18n'

type Step = 'lang' | 'form' | 'otp' | 'success'

export default function GuestVerifyPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('lang')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [devOtp, setDevOtp] = useState('')
  const [hotel, setHotel] = useState<{ name: string; city: string } | null>(null)
  const [lang, setLangState] = useState<Lang>('en')
  const [countdown, setCountdown] = useState(60)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [form, setForm] = useState({
    guestName: '', roomNumber: '', email: '',
    checkInDate: new Date().toISOString().split('T')[0],
    checkOutDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
  })
  const [otp, setOtp] = useState('')

  useEffect(() => {
    api.get<any>(`/hotel/public/${slug}`)
      .then(h => setHotel(h))
      .catch(() => {})
  }, [slug])

  // 60-second auto-fallback to English on the language picker screen
  useEffect(() => {
    if (step !== 'lang') return
    setCountdown(60)
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!)
          setLang('en')
          setStep('form')
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(countdownRef.current!)
  }, [step])

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post<any>('/guest/send-otp', { ...form, hotelSlug: slug })
      if (res.devOtp) setDevOtp(res.devOtp)
      setStep('otp')
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post<any>('/guest/verify-otp', {
        ...form, hotelSlug: slug, code: otp, preferredLanguage: lang,
      })
      localStorage.setItem('guest_token', res.guestToken)
      localStorage.setItem('guest_session', JSON.stringify(res.guestSession))
      setStep('success')
      setTimeout(() => navigate(`/hotel/${slug}/chat`), 1500)
    } catch (err: any) {
      setError(err.message || 'Invalid OTP')
    } finally {
      setLoading(false)
    }
  }

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  // ── Language picker ───────────────────────────────────────────────────────
  if (step === 'lang') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0F172A] to-[#1E293B] flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-[#4F6EF7] flex items-center justify-center mx-auto mb-4">
              <Hotel size={28} className="text-white" />
            </div>
            <h1 className="font-display text-2xl font-bold text-white">{hotel?.name || 'Hotel'}</h1>
            <p className="text-white/50 text-sm mt-1">{hotel?.city}</p>
          </div>

          <div className="bg-white/10 rounded-2xl p-5">
            <p className="text-white text-center font-medium mb-4">{t(lang, 'pickLanguage')}</p>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {SUPPORTED_LANGS.map(l => (
                <button
                  key={l.code}
                  onClick={() => {
                    clearInterval(countdownRef.current!)
                    setLangState(l.code)
                  }}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all active:scale-95 ${
                    lang === l.code
                      ? 'bg-[#4F6EF7] border-[#4F6EF7] text-white'
                      : 'bg-white/10 border-white/20 text-white/80 hover:bg-white/20'
                  }`}
                >
                  <span className="text-2xl">{l.flag}</span>
                  <span className="text-xs font-medium leading-tight text-center">{l.name}</span>
                </button>
              ))}
            </div>
            <Button
              className="w-full bg-[#4F6EF7] hover:bg-[#4F6EF7]/90 text-white h-11"
              onClick={() => { clearInterval(countdownRef.current!); setLang(lang); setStep('form') }}
            >
              {t(lang, 'continue')}
            </Button>
            <p className="text-white/40 text-xs text-center mt-3">
              Continuing in English in {countdown}s…
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-[#0F172A] to-[#1E293B] flex items-center justify-center p-4"
      dir={isRTL(lang) ? 'rtl' : 'ltr'}
    >
      <div className="w-full max-w-sm">
        {/* Hotel branding */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[#4F6EF7] flex items-center justify-center mx-auto mb-4">
            <Hotel size={28} className="text-white" />
          </div>
          <h1 className="font-display text-2xl font-bold text-white">{hotel?.name || 'Hotel'}</h1>
          <p className="text-white/50 text-sm mt-1">{hotel?.city}</p>
          <p className="text-white/40 text-xs mt-2">{t(lang, 'welcomeVerify')}</p>
        </div>

        <Card className="border-0 shadow-2xl">
          <CardContent className="p-6">
            {step === 'success' ? (
              <div className="text-center py-6 space-y-3">
                <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                  <CheckCircle2 size={32} className="text-green-600" />
                </div>
                <p className="font-semibold">{t(lang, 'verified')} {form.guestName}.</p>
                <p className="text-sm text-muted-foreground">{t(lang, 'redirecting')}</p>
              </div>
            ) : step === 'form' ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <h2 className="font-semibold text-center mb-2">{t(lang, 'enterStayDetails')}</h2>
                {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{error}</div>}
                <div className="space-y-1.5">
                  <Label>{t(lang, 'fullName')}</Label>
                  <Input value={form.guestName} onChange={e => set('guestName', e.target.value)} placeholder={t(lang, 'namePlaceholder')} required />
                </div>
                <div className="space-y-1.5">
                  <Label>{t(lang, 'roomNumber')}</Label>
                  <Input value={form.roomNumber} onChange={e => set('roomNumber', e.target.value)} placeholder="e.g. 203" required />
                </div>
                <div className="space-y-1.5">
                  <Label>{t(lang, 'email')}</Label>
                  <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="you@example.com" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>{t(lang, 'checkIn')}</Label>
                    <Input type="date" value={form.checkInDate} onChange={e => set('checkInDate', e.target.value)} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t(lang, 'checkOut')}</Label>
                    <Input type="date" value={form.checkOutDate} onChange={e => set('checkOutDate', e.target.value)} required />
                  </div>
                </div>
                <Button type="submit" className="w-full bg-[#0F172A] hover:bg-[#0F172A]/90" disabled={loading}>
                  {loading ? <Loader2 size={16} className="animate-spin mr-2" /> : <Mail size={16} className="mr-2" />}
                  {t(lang, 'sendOtp')}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <Mail size={22} className="text-primary" />
                  </div>
                  <h2 className="font-semibold">{t(lang, 'checkYourEmail')}</h2>
                  <p className="text-sm text-muted-foreground mt-1">{t(lang, 'otpSentTo')} <strong>{form.email}</strong></p>
                </div>
                {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{error}</div>}
                {devOtp && (
                  <div className="bg-blue-50 text-blue-700 text-sm p-3 rounded-lg text-center">
                    Dev OTP: <strong className="font-mono text-lg">{devOtp}</strong>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label>{t(lang, 'sixDigitOtp')}</Label>
                  <Input
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="text-center text-2xl tracking-widest font-mono h-14"
                    maxLength={6}
                    required
                  />
                </div>
                <Button type="submit" className="w-full bg-[#0F172A] hover:bg-[#0F172A]/90" disabled={loading || otp.length !== 6}>
                  {loading && <Loader2 size={16} className="animate-spin mr-2" />}
                  {t(lang, 'verifyAndContinue')}
                </Button>
                <button type="button" className="w-full text-sm text-muted-foreground hover:text-foreground" onClick={() => { setStep('form'); setError('') }}>
                  {t(lang, 'changeDetails')}
                </button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
