import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input, Label, Card, CardContent } from '@/components/ui/primitives'
import { Hotel, User, Loader2, CheckCircle2 } from 'lucide-react'
import { SUPPORTED_LANGS, Lang, t, setLang, isRTL } from '@/lib/guestI18n'

interface HotelInfo {
  name: string
  city: string
  slug: string
  voiceEnabled: boolean
  voiceLanguage: string
}

interface RoomInfo {
  roomNumber: string
  roomType: string
  floor: number
}

export default function GuestRoomPage() {
  const { slug, roomNumber } = useParams<{ slug: string; roomNumber: string }>()
  const navigate = useNavigate()
  const [hotel, setHotel] = useState<HotelInfo | null>(null)
  const [room, setRoom] = useState<RoomInfo | null>(null)
  const [guestName, setGuestName] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(false)
  const [lang, setLangState] = useState<Lang>('en')
  const [langPicked, setLangPicked] = useState(false)
  const [countdown, setCountdown] = useState(60)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const init = async () => {
      try {
        const hotelRes = await fetch(`/api/hotel/public/${slug}`)
        if (!hotelRes.ok) { setNotFound(true); return }
        const hotelData = await hotelRes.json()
        setHotel(hotelData)

        const roomRes = await fetch(`/api/rooms/by-number/${slug}/${roomNumber}`)
        if (!roomRes.ok) { setNotFound(true); return }
        const roomData = await roomRes.json()
        setRoom(roomData)
      } catch {
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [slug, roomNumber])

  // 60-second auto-fallback to English on the language picker screen
  useEffect(() => {
    if (langPicked || loading) return
    setCountdown(60)
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!)
          setLang('en')
          setLangPicked(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(countdownRef.current!)
  }, [langPicked, loading])

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!guestName.trim()) return
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/guest/room-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hotelSlug: slug, roomNumber, guestName: guestName.trim(), preferredLanguage: lang }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to start session')

      localStorage.setItem('guest_token', data.guestToken)
      localStorage.setItem('guest_session', JSON.stringify({
        id: data.guestSession.id,
        guestName: guestName.trim(),
        roomNumber,
        hotelName: hotel?.name,
        hotelSlug: slug,
      }))

      navigate(`/hotel/${slug}/chat`)
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen-mobile bg-[#0F172A] flex items-center justify-center">
        <Loader2 size={32} className="text-[#4F6EF7] animate-spin" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen-mobile bg-[#0F172A] flex items-center justify-center p-4">
        <div className="text-center text-white">
          <div className="w-14 h-14 rounded-2xl bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <Hotel size={28} className="text-red-400" />
          </div>
          <h1 className="font-display text-xl font-semibold mb-2">{t('en', 'roomNotFound')}</h1>
          <p className="text-white/50 text-sm">{t('en', 'roomNotFoundDesc')}</p>
          <p className="text-white/40 text-xs mt-2">{t('en', 'contactFrontDesk')}</p>
        </div>
      </div>
    )
  }

  const roomTypeColors: Record<string, string> = {
    standard: 'text-gray-300',
    deluxe: 'text-blue-300',
    suite: 'text-purple-300',
    villa: 'text-amber-300',
  }

  // ── Language picker ───────────────────────────────────────────────────────
  if (!langPicked) {
    return (
      <div className="min-h-screen-mobile bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] flex items-center justify-center p-4 safe-top safe-bottom">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-[#4F6EF7] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#4F6EF7]/30">
              <Hotel size={30} className="text-white" />
            </div>
            <h1 className="font-display text-2xl font-bold text-white">{hotel?.name}</h1>
            <p className="text-white/40 text-sm mt-1">{hotel?.city}</p>
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
              onClick={() => { clearInterval(countdownRef.current!); setLang(lang); setLangPicked(true) }}
            >
              {t(lang, 'continue')}
            </Button>
            <p className="text-white/40 text-xs text-center mt-3">
              Continuing in English in {countdown}s…
            </p>
          </div>

          <p className="text-center text-white/25 text-xs mt-6">{t('en', 'powered')}</p>
        </div>
      </div>
    )
  }

  // ── Name form ─────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen-mobile bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] flex items-center justify-center p-4 safe-top safe-bottom"
      dir={isRTL(lang) ? 'rtl' : 'ltr'}
    >
      <div className="w-full max-w-sm">
        {/* Hotel branding */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-[#4F6EF7] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#4F6EF7]/30">
            <Hotel size={30} className="text-white" />
          </div>
          <h1 className="font-display text-2xl font-bold text-white">{hotel?.name}</h1>
          <p className="text-white/40 text-sm mt-1">{hotel?.city}</p>
        </div>

        {/* Room badge */}
        <div className="flex justify-center mb-6">
          <div className="bg-white/10 border border-white/20 rounded-2xl px-6 py-3 text-center">
            <p className="text-white/50 text-xs uppercase tracking-widest mb-1">{t(lang, 'yourRoom')}</p>
            <p className="font-display text-4xl font-bold text-white">{roomNumber}</p>
            <p className={`text-sm mt-1 capitalize font-medium ${roomTypeColors[room?.roomType || 'standard']}`}>
              {room?.roomType} · Floor {room?.floor}
            </p>
          </div>
        </div>

        {/* Name form */}
        <Card className="border-0 shadow-2xl">
          <CardContent className="p-6">
            <form onSubmit={handleStart} className="space-y-5">
              <div className="text-center">
                <h2 className="font-semibold text-lg">{t(lang, 'welcomeHeading')}</h2>
              </div>

              {error && (
                <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg text-center">
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="name">{t(lang, 'yourName')}</Label>
                <div className="relative">
                  <User
                    size={15}
                    className={`absolute ${isRTL(lang) ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-muted-foreground`}
                  />
                  <Input
                    id="name"
                    value={guestName}
                    onChange={e => setGuestName(e.target.value)}
                    placeholder={t(lang, 'namePlaceholder')}
                    className={`${isRTL(lang) ? 'pr-9' : 'pl-9'} h-12 text-base`}
                    autoFocus
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base bg-[#0F172A] hover:bg-[#0F172A]/90 gap-2"
                disabled={submitting || !guestName.trim()}
              >
                {submitting
                  ? <><Loader2 size={18} className="animate-spin" /> {t(lang, 'starting')}</>
                  : <><CheckCircle2 size={18} /> {t(lang, 'startChat')}</>
                }
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-white/25 text-xs mt-6">
          {t(lang, 'powered')}
        </p>
      </div>
    </div>
  )
}
