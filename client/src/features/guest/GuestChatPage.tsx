import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useVoiceInput, useTextToSpeech, VoiceLang } from '@/hooks/useVoiceInput'
import {
  Hotel, Send, ShoppingBag, Loader2, Bot, User, Headphones,
  X, Mic, MicOff, Volume2, VolumeX, Star, Globe
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { getLang, setLang, t, isRTL, SUPPORTED_LANGS, Lang } from '@/lib/guestI18n'

interface Message {
  id: string
  senderType: string
  content: string
  createdAt: string
  inputType?: string
}

interface GuestSession {
  id: string
  guestName: string
  roomNumber: string
  hotelName: string
  hotelSlug: string
}

interface MenuItem {
  id: string
  name: string
  category: string
  price: number
  isVegetarian: boolean
  description: string | null
}


const CATEGORIES = ['breakfast', 'lunch', 'dinner', 'beverages', 'snacks', 'desserts']

export default function GuestChatPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [lang, setLangState] = useState(() => getLang())

  // Must stay in sync with MAIN_MENU_BUTTONS in server/src/routes/guest.ts
  // Values are English (NLP server requirement); only labels are translated
  const mainMenuButtons = [
    { label: t(lang, 'btnHousekeeping'), value: '__housekeeping__' },
    { label: t(lang, 'btnFnb'), value: '__fnb_menu__' },
    { label: t(lang, 'btnLimo'), value: '__limo__' },
    { label: t(lang, 'btnCurrency'), value: 'I need currency exchange please.' },
    { label: t(lang, 'btnCheckout'), value: '__checkout__' },
    { label: t(lang, 'btnLaundry'), value: '__laundry__' },
    { label: t(lang, 'btnAmenities'), value: '__amenities__' },
    { label: t(lang, 'btnMaintenance'), value: '__maintenance__' },
  ]

  const [session, setSession] = useState<GuestSession | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [sessionExpired, setSessionExpired] = useState(false)
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false)
  const [feedbackRatings, setFeedbackRatings] = useState({ overallStay: 0, roomCleanliness: 0, staffService: 0, stayflowRating: 0 })
  const [feedbackComments, setFeedbackComments] = useState('')
  const [showMenu, setShowMenu] = useState(false)
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [cart, setCart] = useState<Record<string, number>>({})
  const [orderLoading, setOrderLoading] = useState(false)
  const [menuTab, setMenuTab] = useState('all')
  const [voiceLang, setVoiceLang] = useState<VoiceLang>('en-IN')
  const [autoSend, setAutoSend] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [ttsEnabled, setTtsEnabled] = useState(true)
  const [showVoiceError, setShowVoiceError] = useState(false)
  const [showLangPicker, setShowLangPicker] = useState(false)
  const [pickerLang, setPickerLang] = useState<Lang>(() => getLang() as Lang)
  // Inline action buttons keyed by message id (not stored in DB, ephemeral)
  const [messageButtons, setMessageButtons] = useState<Record<string, { label: string; value: string }[]>>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const guestToken = localStorage.getItem('guest_token')
  const serverMsgCount = useRef(0)
  const initCalled = useRef(false)
  const sendingRef = useRef(false)

  // Apply a new language: update state, localStorage, and DB
  const applyLang = (newLang: Lang) => {
    setLang(newLang)
    setLangState(newLang)
    setPickerLang(newLang)
    setShowLangPicker(false)
    fetch('/api/guest/session/language', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-guest-token': guestToken! },
      body: JSON.stringify({ preferredLanguage: newLang }),
    }).catch(() => {})
  }

  // Voice input hook
  const { voiceState, isSupported, toggleRecording, error: voiceError, clearError } = useVoiceInput({
    language: voiceLang,
    autoSend,
    onResult: (text) => {
      setInput(text)
      clearError()
    },
    onAutoSend: (text) => {
      sendMessage(text, 'voice')
    },
  })

  // TTS hook
  const { speak, stop: stopSpeaking, speaking } = useTextToSpeech()

  useEffect(() => {
    const saved = localStorage.getItem('guest_session')
    if (!guestToken || !saved) {
      localStorage.removeItem('guest_token')
      localStorage.removeItem('guest_session')
      navigate(`/hotel/${slug}/verify`)
      return
    }
    const s = JSON.parse(saved)
    setSession(s)
    if (initCalled.current) return
    initCalled.current = true
    initChat()

    // Fetch hotel voice settings
    fetch(`/api/hotel/public/${slug}`)
      .then(r => r.json())
      .then(h => {
        if (h.voiceEnabled !== undefined) setVoiceEnabled(h.voiceEnabled)
        if (h.voiceAutoSend !== undefined) setAutoSend(h.voiceAutoSend)
        if (h.voiceLanguage) setVoiceLang(h.voiceLanguage as VoiceLang)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); return }
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150
    if (isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  useEffect(() => {
    if (voiceError) setShowVoiceError(true)
  }, [voiceError])

  // Helper: fetch latest messages and merge into state (deduplication-safe)
  const fetchMessages = async (cid: string) => {
    if (sendingRef.current) return
    try {
      const res = await fetch(`/api/guest/conversations/${cid}`, {
        headers: { 'x-guest-token': guestToken! },
      })
      if (res.status === 403) { setSessionExpired(true); return }
      if (!res.ok) return
      const data = await res.json()
      const serverMsgs: Message[] = data.messages || []
      if (serverMsgs.length > serverMsgCount.current) {
        serverMsgCount.current = serverMsgs.length
        setMessages(prev => {
          const serverIds = new Set(serverMsgs.map(m => m.id))
          // Keep local-only synthetic messages (sub-menus, orders, greetings, errors)
          // but discard tmp-* optimistic messages since server now has real equivalents
          const localOnly = prev.filter(m =>
            !serverIds.has(m.id) &&
            !m.id.startsWith('tmp-') &&
            (m.id.startsWith('greet-') || m.id.startsWith('sub-') ||
             m.id.startsWith('btn-') || m.id.startsWith('order-') || m.id.startsWith('err-'))
          )
          return [...serverMsgs, ...localOnly]
        })
      }
    } catch {}
  }

  // Real-time: SSE stream for staff replies. Falls back to 30s polling if SSE drops.
  useEffect(() => {
    if (!conversationId) return
    let abortCtrl: AbortController | null = null
    let fallbackPoll: ReturnType<typeof setInterval> | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let sseActive = false

    const connectSSE = async () => {
      abortCtrl = new AbortController()
      try {
        const response = await fetch(`/api/guest/conversations/${conversationId}/events`, {
          headers: { 'x-guest-token': guestToken! },
          signal: abortCtrl.signal,
        })
        if (!response.ok || !response.body) return
        sseActive = true
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const blocks = buffer.split('\n\n')
          buffer = blocks.pop() ?? ''
          for (const block of blocks) {
            if (block.includes('event: staff_reply')) {
              fetchMessages(conversationId)
            }
          }
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return
      }
      sseActive = false
      if (!abortCtrl?.signal.aborted) {
        reconnectTimer = setTimeout(connectSSE, 5000)
      }
    }

    connectSSE()
    // Fallback polling in case SSE isn't available (e.g. old proxy strips streams)
    fallbackPoll = setInterval(() => fetchMessages(conversationId), 30000)

    return () => {
      abortCtrl?.abort()
      if (fallbackPoll) clearInterval(fallbackPoll)
      if (reconnectTimer) clearTimeout(reconnectTimer)
    }
  }, [conversationId])

  const initChat = async () => {
    try {
      const clientLang = getLang()
      const res = await fetch('/api/guest/chat/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-guest-token': guestToken! },
        body: JSON.stringify({ lang: clientLang }),
      })
      if (res.status === 403) {
        setSessionExpired(true)
        localStorage.removeItem('guest_token')
        localStorage.removeItem('guest_session')
        return
      }
      if (!res.ok) {
        console.error('Chat start failed:', res.status)
        return
      }
      const data = await res.json()
      setConversationId(data.conversation.id)

      // Sync language: localStorage is the guest's explicit choice — push to DB if mismatched
      const serverLang = data.session?.preferredLanguage
      if (serverLang !== clientLang) {
        // Client lang takes priority (guest picked it at scan time)
        setLangState(clientLang)
        fetch('/api/guest/session/language', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'x-guest-token': guestToken! },
          body: JSON.stringify({ preferredLanguage: clientLang }),
        }).catch(() => {})
      }

      const msgs: Message[] = data.conversation.messages || []
      serverMsgCount.current = msgs.length

      if (msgs.length <= 1) {
        // Fresh session — server already wrote the translated welcome message.
        // Just attach menu buttons to it so they appear immediately.
        setMessages(msgs)
        const welcomeMsg = msgs[0]
        if (welcomeMsg) {
          setMessageButtons({ [welcomeMsg.id]: mainMenuButtons })
        }
      } else {
        // Returning guest — append a client-side "quick menu" message at the bottom
        // so the menu is always visible without scrolling up.
        const greetId = 'greet-' + Date.now()
        const greetMsg: Message = {
          id: greetId,
          senderType: 'assistant',
          content: t(clientLang, 'welcomeHeading'),
          createdAt: new Date().toISOString(),
        }
        setMessages([...msgs, greetMsg])
        setMessageButtons({ [greetId]: mainMenuButtons })
      }
    } catch (err) { console.error(err) }
  }

  const sendMessage = async (text: string, inputType: 'text' | 'voice' = 'text') => {
    if (!text.trim() || !conversationId || sending) return
    const userMsg: Message = { id: 'tmp-' + Date.now(), senderType: 'guest', content: text, createdAt: new Date().toISOString(), inputType }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setSending(true)
    sendingRef.current = true
    try {
      const res = await fetch(`/api/guest/conversations/${conversationId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-guest-token': guestToken! },
        body: JSON.stringify({ content: text, inputType, lang }),
      })
      if (res.status === 403) { setSessionExpired(true); return }
      const data = await res.json()
      if (!res.ok || !data.message) {
        throw new Error(data.error || 'Server error')
      }
      setMessages(prev => {
        const next = [...prev, data.message]
        serverMsgCount.current = next.filter(m => !m.id.startsWith('tmp-')).length
        return next
      })
      // Store inline buttons if provided
      if (data.message?.id) {
        if (data.action === 'show_main_menu') {
          setMessageButtons(prev => ({ ...prev, [data.message.id]: mainMenuButtons }))
        } else if (data.buttons?.length) {
          setMessageButtons(prev => ({ ...prev, [data.message.id]: data.buttons }))
        }
      }
      // Auto-speak assistant response if TTS enabled and message was voice
      if (ttsEnabled && inputType === 'voice' && data.message?.content) {
        setTimeout(() => speak(data.message.content, voiceLang), 300)
      }
    } catch {
      setMessages(prev => [...prev, {
        id: 'err-' + Date.now(),
        senderType: 'assistant',
        content: t(lang, 'errorRetry'),
        createdAt: new Date().toISOString(),
      }])
    } finally {
      setSending(false)
      sendingRef.current = false
    }
  }

  const handleButtonClick = async (msgId: string, value: string, label: string) => {
    // Keep buttons on main menu messages so the guest can request multiple services
    const isMainMenu = messageButtons[msgId]?.some(b => b.value === '__housekeeping__' || b.value === '__maintenance__')
    if (!isMainMenu) {
      setMessageButtons(prev => { const n = { ...prev }; delete n[msgId]; return n })
    }

    // Helper: show an assistant sub-menu message with buttons
    const showSubMenu = (content: string, buttons: { label: string; value: string }[]) => {
      const subMsgId = 'sub-' + Date.now()
      setMessages(prev => [...prev, {
        id: subMsgId, senderType: 'assistant', content,
        createdAt: new Date().toISOString(),
      }])
      setMessageButtons(prev => ({ ...prev, [subMsgId]: buttons }))
    }

    // Helper: add a guest bubble (from tapping a button)
    const addGuestMsg = (text: string) => {
      setMessages(prev => [...prev, {
        id: 'btn-' + Date.now(), senderType: 'guest', content: text,
        createdAt: new Date().toISOString(),
      }])
    }

    // ── Open F&B menu drawer ──────────────────────────────────────
    if (value === '__show_menu__') {
      const res = await fetch(`/api/menu-items/public/${slug}`)
      setMenuItems(await res.json())
      setShowMenu(true)
      return
    }

    // ── Prompt user to type a custom request ─────────────────────
    if (value === '__ask_type__') {
      showSubMenu(t(lang, 'typeRequestPrompt'), [])
      return
    }

    // ── Housekeeping ──────────────────────────────────────────────
    if (value === '__housekeeping__') {
      addGuestMsg(label)
      showSubMenu(t(lang, 'housekeepingPrompt'), [
        { label: t(lang, 'housekeepingTimeSlot'), value: t('en', 'msgHousekeepingTimeSlot') },
        { label: t(lang, 'housekeepingExtras'), value: t('en', 'msgRoomExtras') },
        { label: t(lang, 'housekeepingOther'), value: '__ask_type__' },
      ])
      return
    }

    // ── F&B Order ─────────────────────────────────────────────────
    if (value === '__fnb_menu__') {
      addGuestMsg(label)
      showSubMenu(t(lang, 'fnbPrompt'), [
        { label: t(lang, 'fnbRoomService'), value: '__show_menu__' },
        { label: t(lang, 'fnbTableReserve'), value: t('en', 'msgTableReserve') },
      ])
      return
    }

    // ── Limo Service ──────────────────────────────────────────────
    if (value === '__limo__') {
      addGuestMsg(label)
      showSubMenu(t(lang, 'limoPrompt'), [
        { label: t(lang, 'limoHireTaxi'), value: '__limo_timing__' },
        { label: t(lang, 'limoGetCab'), value: t('en', 'msgCab') },
      ])
      return
    }

    // ── Limo: choose timing ───────────────────────────────────────
    if (value === '__limo_timing__') {
      addGuestMsg(t(lang, 'limoHireTaxi'))
      showSubMenu(t(lang, 'limoTimingPrompt'), [
        { label: t(lang, 'limoMorning'), value: '__breakfast_morning__' },
        { label: t(lang, 'limoAfternoon'), value: '__breakfast_afternoon__' },
        { label: t(lang, 'limoEvening'), value: '__breakfast_evening__' },
      ])
      return
    }

    // ── Limo: packed breakfast ────────────────────────────────────
    if (value === '__breakfast_morning__' || value === '__breakfast_afternoon__' || value === '__breakfast_evening__') {
      const timing = value === '__breakfast_morning__' ? 'morning' : value === '__breakfast_afternoon__' ? 'afternoon' : 'evening'
      const timingLabel = value === '__breakfast_morning__' ? t(lang, 'limoMorning') : value === '__breakfast_afternoon__' ? t(lang, 'limoAfternoon') : t(lang, 'limoEvening')
      addGuestMsg(timingLabel)
      showSubMenu(t(lang, 'limoBreakfastPrompt'), [
        { label: t(lang, 'limoYesBreakfast'), value: t('en', 'msgTaxiBreakfast', { timing }) },
        { label: t(lang, 'limoNoThanks'), value: t('en', 'msgTaxi', { timing }) },
      ])
      return
    }

    // ── Checkout ──────────────────────────────────────────────────
    if (value === '__checkout__') {
      addGuestMsg(label)
      showSubMenu(t(lang, 'checkoutPrompt'), [
        { label: t(lang, 'checkoutEarly'), value: '__early_checkout__' },
        { label: t(lang, 'checkoutLate'), value: t('en', 'msgLateCheckout') },
      ])
      return
    }

    // ── Early checkout: packed breakfast ──────────────────────────
    if (value === '__early_checkout__') {
      addGuestMsg(t(lang, 'checkoutEarly'))
      showSubMenu(t(lang, 'earlyCheckoutPrompt'), [
        { label: t(lang, 'limoYesBreakfast'), value: t('en', 'msgEarlyCheckoutBreakfast') },
        { label: t(lang, 'limoNoThanks'), value: t('en', 'msgEarlyCheckout') },
      ])
      return
    }

    // ── Laundry ───────────────────────────────────────────────────
    if (value === '__laundry__') {
      addGuestMsg(label)
      showSubMenu(t(lang, 'laundryPrompt'), [
        { label: t(lang, 'laundryCleaning'), value: t('en', 'msgLaundryIroning') },
        { label: t(lang, 'laundryFamily'), value: t('en', 'msgLaundryFamily') },
      ])
      return
    }

    // ── Amenities ─────────────────────────────────────────────────
    if (value === '__amenities__') {
      addGuestMsg(label)
      showSubMenu(t(lang, 'amenitiesPrompt'), [
        { label: t(lang, 'amenitiesTimings'), value: t('en', 'msgAmenityTimings') },
        { label: t(lang, 'amenitiesSpa'), value: t('en', 'msgBookSpa') },
        { label: t(lang, 'amenitiesGym'), value: t('en', 'msgBookGym') },
        { label: t(lang, 'amenitiesPool'), value: t('en', 'msgBookPool') },
        { label: t(lang, 'amenitiesTennis'), value: t('en', 'msgBookTennis') },
        { label: t(lang, 'amenitiesRooftop'), value: t('en', 'msgBookRooftop') },
      ])
      return
    }

    // ── Maintenance ───────────────────────────────────────────────
    if (value === '__maintenance__') {
      addGuestMsg(label)
      showSubMenu(t(lang, 'maintenancePrompt'), [
        { label: t(lang, 'maintenanceElectrical'), value: t('en', 'msgElectrical') },
        { label: t(lang, 'maintenancePlumbing'), value: t('en', 'msgPlumbing') },
        { label: t(lang, 'maintenanceCooling'), value: t('en', 'msgCooling') },
      ])
      return
    }

    // ── Default: guest bubble + send to API ───────────────────────
    const displayMsg: Message = {
      id: 'btn-' + Date.now(), senderType: 'guest', content: label,
      createdAt: new Date().toISOString(),
    }
    setMessages(prev => [...prev, displayMsg])
    sendMessage(value)
  }

  const addToCart = (item: MenuItem) => setCart(p => ({ ...p, [item.id]: (p[item.id] || 0) + 1 }))
  const removeFromCart = (id: string) => setCart(p => { const n = { ...p }; if (n[id] > 1) n[id]--; else delete n[id]; return n })
  const cartTotal = Object.entries(cart).reduce((s, [id, q]) => s + (menuItems.find(i => i.id === id)?.price || 0) * q, 0)
  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0)

  const placeOrder = async () => {
    if (!cartCount) return
    setOrderLoading(true)
    try {
      const items = Object.entries(cart).map(([menuItemId, quantity]) => ({ menuItemId, quantity }))
      const orderRes = await fetch('/api/guest/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-guest-token': guestToken! },
        body: JSON.stringify({ items }),
      })
      if (!orderRes.ok) {
        const err = await orderRes.json().catch(() => ({}))
        throw new Error(err.error || 'Order failed')
      }
      const summary = Object.entries(cart).map(([id, q]) => `${menuItems.find(i => i.id === id)?.name} × ${q}`).join(', ')
      const confirmMsg: Message = {
        id: 'order-' + Date.now(),
        senderType: 'assistant',
        content: `${t(lang, 'orderPlaced')}\n\n${summary}\n\n**Total: ₹${cartTotal}**\n\n${t(lang, 'orderDelivery')}`,
        createdAt: new Date().toISOString(),
      }
      setMessages(prev => [...prev, confirmMsg])
      setCart({})
      setShowMenu(false)
    } catch (err: any) {
      setMessages(prev => [...prev, {
        id: 'order-err-' + Date.now(),
        senderType: 'assistant',
        content: err.message || 'Failed to place order. Please try again.',
        createdAt: new Date().toISOString(),
      }])
    }
    finally { setOrderLoading(false) }
  }

  const formatContent = (content: string) =>
    content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>')

  const filteredMenu = menuTab === 'all' ? menuItems : menuItems.filter(i => i.category === menuTab)

  // Recording pulse animation styles
  const micBtnClass = cn(
    "rounded-full w-10 h-10 flex-shrink-0 flex items-center justify-center transition-all duration-200",
    voiceState === 'recording'
      ? "bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/40 animate-pulse"
      : voiceState === 'processing'
      ? "bg-yellow-500 hover:bg-yellow-600"
      : voiceState === 'error'
      ? "bg-red-100 text-red-600 border border-red-300"
      : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
  )

  // Session expired — show feedback form, then farewell screen
  if (sessionExpired) {
    const submitFeedback = async () => {
      const { overallStay, roomCleanliness, staffService, stayflowRating } = feedbackRatings
      if (!overallStay || !roomCleanliness || !staffService || !stayflowRating) return
      setFeedbackSubmitting(true)
      try {
        await fetch('/api/guest/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-guest-token': guestToken! },
          body: JSON.stringify({ overallStay, roomCleanliness, staffService, stayflowRating, comments: feedbackComments }),
        })
      } catch {}
      setFeedbackSubmitting(false)
      setFeedbackSubmitted(true)
    }

    const StarRating = ({ field, label }: { field: keyof typeof feedbackRatings; label: string }) => (
      <div className="mb-5">
        <p className="text-white/80 text-sm mb-2">{label}</p>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              onClick={() => setFeedbackRatings(p => ({ ...p, [field]: n }))}
              className="transition-transform active:scale-90"
            >
              <Star
                size={28}
                className={cn(
                  "transition-colors",
                  n <= feedbackRatings[field] ? "fill-[#4F6EF7] text-[#4F6EF7]" : "fill-white/10 text-white/30"
                )}
              />
            </button>
          ))}
        </div>
      </div>
    )

    if (feedbackSubmitted) {
      return (
        <div className="h-screen flex flex-col items-center justify-center bg-[#0F172A] p-8 text-center" dir={isRTL(lang) ? 'rtl' : 'ltr'}>
          <div className="w-16 h-16 rounded-2xl bg-[#4F6EF7] flex items-center justify-center mx-auto mb-6">
            <Hotel size={30} className="text-white" />
          </div>
          <h1 className="font-display text-2xl font-bold text-white mb-2">{t(lang, 'thankYouHeading')}</h1>
          <p className="text-white/60 text-sm mb-1">{session?.hotelName}</p>
          <p className="text-white/40 text-xs mb-8">Room {session?.roomNumber} · {session?.guestName}</p>
          <div className="bg-white/10 rounded-2xl px-6 py-5 max-w-xs w-full">
            <p className="text-white/80 text-sm leading-relaxed">
              {t(lang, 'thankYouBody')}
            </p>
          </div>
          <p className="text-white/25 text-xs mt-8">{t(lang, 'powered')}</p>
        </div>
      )
    }

    const allRated = Object.values(feedbackRatings).every(v => v > 0)

    return (
      <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-start py-10 px-6" dir={isRTL(lang) ? 'rtl' : 'ltr'}>
        <div className="w-full max-w-sm">
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-[#4F6EF7] flex items-center justify-center mb-4">
              <Hotel size={26} className="text-white" />
            </div>
            <h1 className="font-display text-xl font-bold text-white mb-1">{t(lang, 'feedbackHeading')}</h1>
            <p className="text-white/50 text-xs">{session?.hotelName} · Room {session?.roomNumber}</p>
          </div>

          {/* Questions */}
          <div className="bg-white/8 rounded-2xl p-5">
            <StarRating field="overallStay" label={t(lang, 'q1')} />
            <StarRating field="roomCleanliness" label={t(lang, 'q2')} />
            <StarRating field="staffService" label={t(lang, 'q3')} />
            <StarRating field="stayflowRating" label={t(lang, 'q4')} />

            <div className="mb-2">
              <p className="text-white/80 text-sm mb-2">{t(lang, 'q5')} <span className="text-white/40">{t(lang, 'q5Optional')}</span></p>
              <textarea
                value={feedbackComments}
                onChange={e => setFeedbackComments(e.target.value)}
                placeholder={t(lang, 'q5Placeholder')}
                rows={3}
                maxLength={1000}
                className="w-full bg-white/10 text-white placeholder-white/30 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#4F6EF7]/50 border border-white/10"
              />
            </div>
          </div>

          <button
            onClick={submitFeedback}
            disabled={!allRated || feedbackSubmitting}
            className={cn(
              "w-full mt-5 py-3 rounded-xl font-semibold text-sm transition-all",
              allRated
                ? "bg-[#4F6EF7] text-white hover:bg-[#4F6EF7]/90 active:scale-98"
                : "bg-white/10 text-white/30 cursor-not-allowed"
            )}
          >
            {feedbackSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={14} className="animate-spin" /> {t(lang, 'submitting')}
              </span>
            ) : t(lang, 'submitFeedback')}
          </button>

          <button
            onClick={() => setFeedbackSubmitted(true)}
            className="w-full mt-3 text-white/30 text-xs hover:text-white/50 transition-colors"
          >
            {t(lang, 'skipFeedback')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen-mobile flex flex-col bg-[#F1F5F9]/50 max-w-lg mx-auto relative" dir={isRTL(lang) ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="bg-[#0F172A] text-white px-4 py-3 flex items-center gap-3 flex-shrink-0 safe-top">
        <div className="w-9 h-9 rounded-xl bg-[#4F6EF7] flex items-center justify-center flex-shrink-0">
          <Hotel size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{session?.hotelName || 'Hotel'}</p>
          <p className="text-xs text-white/60">Room {session?.roomNumber} · {session?.guestName}</p>
        </div>
        {/* Language picker button */}
        <button
          onClick={() => { setPickerLang(getLang() as Lang); setShowLangPicker(true) }}
          className="text-white/60 hover:text-white transition-colors flex items-center gap-1"
          title="Change language"
        >
          <Globe size={16} />
          <span className="text-xs font-medium">{SUPPORTED_LANGS.find(l => l.code === lang)?.flag}</span>
        </button>
        {/* TTS toggle */}
        {voiceEnabled && (
          <button
            onClick={() => { setTtsEnabled(p => !p); if (speaking) stopSpeaking() }}
            className="text-white/60 hover:text-white transition-colors"
            title={ttsEnabled ? 'Mute voice responses' : 'Enable voice responses'}
          >
            {ttsEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
        )}
      </div>

      {/* Language picker overlay */}
      {showLangPicker && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#0F172A] rounded-2xl p-5 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <p className="text-white font-medium">{t(lang, 'pickLanguage')}</p>
              <button onClick={() => setShowLangPicker(false)} className="text-white/50 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {SUPPORTED_LANGS.map(l => (
                <button
                  key={l.code}
                  onClick={() => setPickerLang(l.code)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all active:scale-95 ${
                    pickerLang === l.code
                      ? 'bg-[#4F6EF7] border-[#4F6EF7] text-white'
                      : 'bg-white/10 border-white/20 text-white/80 hover:bg-white/20'
                  }`}
                >
                  <span className="text-2xl">{l.flag}</span>
                  <span className="text-xs font-medium leading-tight text-center">{l.name}</span>
                </button>
              ))}
            </div>
            <button
              className="w-full bg-[#4F6EF7] hover:bg-[#4F6EF7]/90 text-white h-11 rounded-xl font-medium transition-colors"
              onClick={() => applyLang(pickerLang)}
            >
              {t(pickerLang, 'continue')}
            </button>
          </div>
        </div>
      )}

      {/* Voice error banner */}
      {showVoiceError && voiceError && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 flex items-center gap-2 text-sm text-red-700">
          <span className="flex-1">{voiceError}</span>
          <button onClick={() => { setShowVoiceError(false); clearError() }}><X size={14} /></button>
        </div>
      )}

      {/* Voice recording overlay */}
      {voiceState === 'recording' && (
        <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
          <div className="bg-black/60 backdrop-blur-sm rounded-2xl px-6 py-4 text-white text-center pointer-events-auto">
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-ping" />
              <span className="text-sm font-medium">{t(lang, 'listening')}</span>
            </div>
            <button
              onClick={toggleRecording}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-1.5 rounded-full text-xs font-medium transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin">
        {messages.map(msg => (
          <div key={msg.id} className={cn("flex gap-2", msg.senderType === 'guest' ? "justify-end" : "justify-start")}>
            {msg.senderType !== 'guest' && (
              <div className={cn("w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                msg.senderType === 'staff' ? "bg-blue-100" : "bg-amber-100")}>
                {msg.senderType === 'staff' ? <Headphones size={13} className="text-blue-600" /> : <Bot size={13} className="text-amber-700" />}
              </div>
            )}
            <div className={cn(
              "max-w-[80%] px-4 py-2.5 rounded-2xl text-sm",
              msg.senderType === 'guest'
                ? "bg-[#0F172A] text-white rounded-br-sm"
                : "bg-white border text-foreground rounded-bl-sm shadow-sm"
            )}>
              {/* Voice badge */}
              {msg.inputType === 'voice' && msg.senderType === 'guest' && (
                <div className="flex items-center gap-1 mb-1 opacity-60">
                  <Mic size={10} />
                  <span className="text-xs">{t(lang, 'voiceLabel')}</span>
                </div>
              )}
              <div className="chat-content" dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }} />
              {/* Inline action buttons */}
              {messageButtons[msg.id] && (
                <div className={cn(
                  "mt-3",
                  messageButtons[msg.id].length > 2 ? "grid grid-cols-2 gap-2" : "flex gap-2 flex-wrap"
                )}>
                  {messageButtons[msg.id].map((btn, i) => (
                    <button
                      key={btn.value}
                      onClick={() => handleButtonClick(msg.id, btn.value, btn.label)}
                      className={cn(
                        "px-3 py-2 rounded-xl text-xs font-semibold border-2 transition-all active:scale-95 shadow-sm",
                        messageButtons[msg.id].length > 2
                          ? "bg-[#EEF2FF] border-[#4F6EF7]/40 text-[#3730A3] hover:bg-[#4F6EF7] hover:text-white hover:border-[#4F6EF7] text-left"
                          : i === 0
                          ? "bg-red-500 border-red-500 text-white hover:bg-red-600 hover:border-red-600"
                          : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400"
                      )}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between gap-2 mt-1">
                <span className="text-xs opacity-40">{format(new Date(msg.createdAt), 'HH:mm')}</span>
                {/* TTS button for assistant messages */}
                {msg.senderType === 'assistant' && voiceEnabled && (
                  <button
                    onClick={() => speaking ? stopSpeaking() : speak(msg.content, voiceLang)}
                    className="opacity-40 hover:opacity-80 transition-opacity"
                    title="Play audio"
                  >
                    {speaking ? <VolumeX size={11} /> : <Volume2 size={11} />}
                  </button>
                )}
              </div>
            </div>
            {msg.senderType === 'guest' && (
              <div className="w-7 h-7 rounded-full bg-[#4F6EF7] flex items-center justify-center flex-shrink-0 mt-0.5">
                <User size={13} className="text-white" />
              </div>
            )}
          </div>
        ))}
        {sending && (
          <div className="flex gap-2 justify-start">
            <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center"><Bot size={13} className="text-amber-700" /></div>
            <div className="bg-white border px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="bg-white border-t px-3 py-2.5 flex-shrink-0 safe-bottom">
        {/* Voice settings bar */}
        {voiceEnabled && isSupported && (
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => setAutoSend(p => !p)}
              className={cn(
                "flex items-center gap-1 text-xs border rounded-full px-2 py-0.5 transition-colors",
                autoSend ? "bg-primary text-white border-primary" : "text-muted-foreground hover:text-foreground"
              )}
              title="Auto-send voice messages"
            >
              {t(lang, 'autoSend')}
            </button>
            {voiceState === 'processing' && (
              <span className="text-xs text-yellow-600 flex items-center gap-1">
                <Loader2 size={11} className="animate-spin" /> {t(lang, 'processing')}
              </span>
            )}
          </div>
        )}

        <div className="flex gap-2 items-center">
          {/* Mic button */}
          {voiceEnabled && isSupported && (
            <button
              onClick={toggleRecording}
              disabled={voiceState === 'processing'}
              className={micBtnClass}
              title={voiceState === 'recording' ? 'Stop recording' : 'Start voice input'}
            >
              {voiceState === 'processing'
                ? <Loader2 size={16} className="animate-spin text-white" />
                : voiceState === 'recording'
                ? <MicOff size={16} className="text-white" />
                : <Mic size={16} />}
            </button>
          )}

          <input
            className="flex-1 border rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder={voiceState === 'recording' ? t(lang, 'listening') : t(lang, 'typePlaceholder')}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
            disabled={voiceState === 'recording'}
          />

          <button
            className={cn(
              "rounded-full w-10 h-10 flex-shrink-0 flex items-center justify-center transition-colors",
              input.trim() ? "bg-[#0F172A] text-white hover:bg-[#0F172A]/90" : "bg-muted text-muted-foreground"
            )}
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || sending}
          >
            <Send size={16} />
          </button>
        </div>
      </div>

      {/* Menu drawer */}
      {showMenu && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-end">
          <div className="bg-white w-full max-h-[85vh] rounded-t-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0">
              <h2 className="font-display font-semibold text-lg">{t(lang, 'menuTitle')}</h2>
              <div className="flex items-center gap-3">
                {cartCount > 0 && (
                  <Button size="sm" className="gap-1.5 bg-[#0F172A] hover:bg-[#0F172A]/90" onClick={placeOrder} disabled={orderLoading}>
                    {orderLoading ? <Loader2 size={13} className="animate-spin" /> : <ShoppingBag size={13} />}
                    {t(lang, 'orderBtn')} ({cartCount}) · ₹{cartTotal}
                  </Button>
                )}
                <button onClick={() => setShowMenu(false)} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
              </div>
            </div>
            <div className="flex gap-2 px-4 py-2 overflow-x-auto flex-shrink-0 border-b">
              {['all', ...CATEGORIES].map(cat => (
                <button
                  key={cat}
                  onClick={() => setMenuTab(cat)}
                  className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${menuTab === cat ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}
                >
                  {cat === 'all' ? t(lang, 'menuCategoryAll') : cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {filteredMenu.map(item => (
                <div key={item.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium">{item.name}</span>
                      <span className="text-xs">{item.isVegetarian ? '🟢' : '🔴'}</span>
                    </div>
                    {item.description && <p className="text-xs text-muted-foreground line-clamp-1">{item.description}</p>}
                    <p className="text-sm font-semibold mt-0.5">₹{item.price}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    {cart[item.id] ? (
                      <div className="flex items-center gap-2">
                        <button onClick={() => removeFromCart(item.id)} className="w-7 h-7 rounded-full border flex items-center justify-center text-sm hover:bg-muted">−</button>
                        <span className="text-sm font-semibold w-4 text-center">{cart[item.id]}</span>
                        <button onClick={() => addToCart(item)} className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-sm">+</button>
                      </div>
                    ) : (
                      <button onClick={() => addToCart(item)} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-full text-xs font-medium">{t(lang, 'addToCart')}</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
