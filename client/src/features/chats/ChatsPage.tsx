import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input, Badge } from '@/components/ui/primitives'
import {
  Send, MessageSquare, AlertTriangle, User, Bot, Headphones,
  Sparkles, StickyNote, Info, Calendar, Globe, ShoppingBag,
  ClipboardList, Loader2, ChevronLeft, X,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Conversation {
  id: string
  status: string
  hasEscalation: boolean
  createdAt: string
  updatedAt: string
  guestSession: {
    guestName: string
    email: string
    checkInDate?: string
    checkOutDate?: string
    preferredLanguage?: string
  }
  room: { roomNumber: string; roomType: string; floor?: number }
  messages: Message[]
  _count?: { messages: number }
}

interface Message {
  id: string
  senderType: string
  content: string
  englishContent?: string | null
  originalLanguage?: string | null
  createdAt: string
}

interface GuestContext {
  requests: { id: string; type: string; status: string; details?: string | null; createdAt: string }[]
  orders: {
    id: string; totalAmount: number; status: string; createdAt: string
    items: { itemNameSnapshot: string; quantity: number; itemPriceSnapshot: number }[]
  }[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const LANG_NAMES: Record<string, string> = {
  en: 'English', hi: 'Hindi', ar: 'Arabic', zh: 'Chinese',
  fr: 'French', de: 'German', es: 'Spanish', ru: 'Russian',
  ja: 'Japanese', ko: 'Korean', pt: 'Portuguese', it: 'Italian',
}

const STATUS_CHIP: Record<string, string> = {
  pending:     'bg-yellow-100 text-yellow-700',
  'in-progress': 'bg-blue-100 text-blue-700',
  completed:   'bg-green-100 text-green-700',
  placed:      'bg-yellow-100 text-yellow-700',
  preparing:   'bg-blue-100 text-blue-700',
  delivered:   'bg-green-100 text-green-700',
  cancelled:   'bg-red-100 text-red-600',
}

function formatContent(content: string) {
  return content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>')
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ChatsPage() {
  const { toast } = useToast()
  const qc = useQueryClient()

  const [selectedId, setSelectedId]   = useState<string | null>(null)
  const [tab, setTab]                  = useState<'active' | 'past'>('active')
  const [inputMode, setInputMode]      = useState<'reply' | 'note'>('reply')
  const [text, setText]                = useState('')
  const [showSidebar, setShowSidebar]  = useState(false)
  const [suggestions, setSuggestions]  = useState<string[]>([])
  const [loadingSuggest, setLoadingSuggest] = useState(false)

  const messagesEndRef  = useRef<HTMLDivElement>(null)
  const inputRef        = useRef<HTMLInputElement>(null)
  const lastSeenCounts  = useRef<Record<string, number>>({})

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: activeConversations = [], isLoading: loadingActive } = useQuery({
    queryKey: ['chats', 'active'],
    queryFn: () => api.get<Conversation[]>('/chats'),
    refetchInterval: 30000,
  })

  const { data: pastConversations = [], isLoading: loadingPast } = useQuery({
    queryKey: ['chats', 'past'],
    queryFn: () => api.get<Conversation[]>('/chats/past'),
    enabled: tab === 'past',
    refetchInterval: 30000,
  })

  const conversations  = tab === 'active' ? activeConversations : pastConversations
  const isLoading      = tab === 'active' ? loadingActive : loadingPast

  const { data: activeConvo } = useQuery({
    queryKey: ['chat', selectedId],
    queryFn: () => api.get<Conversation>(`/chats/${selectedId}`),
    enabled: !!selectedId,
    refetchInterval: 15000,
  })

  const { data: guestContext } = useQuery({
    queryKey: ['chat-context', selectedId],
    queryFn: () => api.get<GuestContext>(`/chats/${selectedId}/context`),
    enabled: !!selectedId && showSidebar,
  })

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    conversations.forEach(conv => {
      if (!(conv.id in lastSeenCounts.current)) {
        lastSeenCounts.current[conv.id] = conv._count?.messages ?? 0
      }
    })
  }, [conversations.length])

  useEffect(() => {
    if (selectedId && activeConvo) {
      lastSeenCounts.current[selectedId] = activeConvo.messages?.length ?? 0
    }
  }, [activeConvo?.messages?.length, selectedId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeConvo?.messages?.length])

  // Reset suggestions when conversation changes
  useEffect(() => { setSuggestions([]) }, [selectedId])

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSelect = (id: string) => {
    setSelectedId(id)
    setSuggestions([])
    setText('')
    setInputMode('reply')
    const conv = conversations.find(c => c.id === id)
    if (conv) lastSeenCounts.current[id] = conv._count?.messages ?? 0
    setTimeout(() => inputRef.current?.focus(), 80)
  }

  const getUnreadCount = (conv: Conversation) => {
    const total = conv._count?.messages ?? 0
    const seen  = lastSeenCounts.current[conv.id] ?? total
    return Math.max(0, total - seen)
  }

  // ── Mutations ──────────────────────────────────────────────────────────────

  const replyMutation = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      api.post(`/chats/${id}/reply`, { content }),
    onMutate: async ({ id, content }) => {
      await qc.cancelQueries({ queryKey: ['chat', id] })
      const previous = qc.getQueryData<Conversation>(['chat', id])
      qc.setQueryData<Conversation>(['chat', id], old => old ? {
        ...old,
        messages: [...old.messages, {
          id: `optimistic-${Date.now()}`, senderType: 'staff',
          content, createdAt: new Date().toISOString(),
        } as Message],
      } : old)
      setText('')
      setSuggestions([])
      return { previous, id }
    },
    onError: (_e: any, _v, ctx: any) => {
      if (ctx?.previous) qc.setQueryData(['chat', ctx.id], ctx.previous)
      toast('Failed to send', 'error')
    },
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: ['chat', id] })
      qc.invalidateQueries({ queryKey: ['chats'] })
    },
  })

  const noteMutation = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      api.post(`/chats/${id}/note`, { content }),
    onMutate: async ({ id, content }) => {
      await qc.cancelQueries({ queryKey: ['chat', id] })
      const previous = qc.getQueryData<Conversation>(['chat', id])
      qc.setQueryData<Conversation>(['chat', id], old => old ? {
        ...old,
        messages: [...old.messages, {
          id: `optimistic-note-${Date.now()}`, senderType: 'note',
          content, createdAt: new Date().toISOString(),
        } as Message],
      } : old)
      setText('')
      return { previous, id }
    },
    onError: (_e: any, _v, ctx: any) => {
      if (ctx?.previous) qc.setQueryData(['chat', ctx.id], ctx.previous)
      toast('Failed to add note', 'error')
    },
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: ['chat', id] })
    },
  })

  const handleSend = () => {
    if (!text.trim() || !selectedId) return
    if (inputMode === 'note') {
      noteMutation.mutate({ id: selectedId, content: text.trim() })
    } else {
      replyMutation.mutate({ id: selectedId, content: text.trim() })
    }
  }

  const handleSuggest = async () => {
    if (!selectedId) return
    setLoadingSuggest(true)
    try {
      const res = await api.post<{ suggestions: string[] }>(`/chats/${selectedId}/suggest`, {})
      setSuggestions(res.suggestions || [])
    } catch {
      toast('AI suggest failed', 'error')
    } finally {
      setLoadingSuggest(false)
    }
  }

  const selected = conversations.find(c => c.id === selectedId)
  const isPending = replyMutation.isPending || noteMutation.isPending

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="h-[calc(100vh-56px)] flex overflow-hidden">

      {/* ── Left: conversation list ── */}
      <div className={cn(
        'w-full lg:w-72 xl:w-80 border-r bg-white flex flex-col flex-shrink-0',
        selectedId ? 'hidden lg:flex' : 'flex',
      )}>
        <div className="p-4 border-b">
          <h1 className="font-display text-lg font-semibold">Chats</h1>
          <div className="flex gap-1 mt-2">
            {(['active', 'past'] as const).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setSelectedId(null) }}
                className={cn(
                  'flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  tab === t ? 'bg-[#0F172A] text-white' : 'bg-muted text-muted-foreground hover:text-foreground',
                )}
              >
                {t === 'active' ? `Active (${activeConversations.length})` : 'Past Chats'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-muted animate-pulse rounded" />)}
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center">
              <MessageSquare size={32} className="mb-3 opacity-30" />
              <p className="text-sm">No conversations yet</p>
            </div>
          ) : conversations.map(conv => {
            const unread    = getUnreadCount(conv)
            const lastMsg   = conv.messages?.[0]
            const isNote    = lastMsg?.senderType === 'note'
            const preview   = isNote
              ? '📝 Internal note'
              : (lastMsg?.englishContent ?? lastMsg?.content ?? '')
                  .replace(/\*\*/g, '').substring(0, 60)

            return (
              <button
                key={conv.id}
                onClick={() => handleSelect(conv.id)}
                className={cn(
                  'w-full text-left px-4 py-3.5 border-b transition-colors hover:bg-muted/50',
                  selectedId === conv.id ? 'bg-primary/5 border-l-2 border-l-primary' : '',
                )}
              >
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-sm">{conv.room.roomNumber}</span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                      {conv.guestSession.guestName}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {conv.hasEscalation && <AlertTriangle size={12} className="text-amber-500" />}
                    {unread > 0 ? (
                      <span className="min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                        {unread > 9 ? '9+' : unread}
                      </span>
                    ) : conv.status === 'active' ? (
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                    ) : null}
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(conv.updatedAt), 'HH:mm')}
                    </span>
                  </div>
                </div>
                {lastMsg && (
                  <p className={cn(
                    'text-xs truncate',
                    isNote ? 'italic text-muted-foreground/70' : unread > 0 ? 'text-foreground font-medium' : 'text-muted-foreground',
                  )}>
                    {preview}
                  </p>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Center: message thread ── */}
      <div className={cn(
        'flex-1 flex flex-col min-w-0 bg-[#F1F5F9]/30',
        !selectedId ? 'hidden lg:flex' : 'flex',
      )}>
        {!selectedId ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageSquare size={48} className="mb-4 opacity-20" />
            <p className="text-sm">Select a conversation</p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="bg-white border-b px-4 py-3 flex items-center gap-3 flex-shrink-0">
              <button className="lg:hidden mr-1 text-muted-foreground hover:text-foreground" onClick={() => setSelectedId(null)}>
                <ChevronLeft size={20} />
              </button>
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm flex-shrink-0">
                {selected?.guestSession.guestName.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{selected?.guestSession.guestName}</div>
                <div className="text-xs text-muted-foreground">
                  Room {selected?.room.roomNumber} · {selected?.room.roomType}
                </div>
              </div>
              {selected?.hasEscalation && (
                <Badge variant="warning" className="gap-1 text-xs flex-shrink-0">
                  <AlertTriangle size={10} /> Escalated
                </Badge>
              )}
              <button
                onClick={() => setShowSidebar(v => !v)}
                className={cn(
                  'p-1.5 rounded-lg transition-colors flex-shrink-0',
                  showSidebar ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                )}
                title="Guest info"
              >
                <Info size={17} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
              {activeConvo?.messages?.map(msg => {
                if (msg.senderType === 'note') {
                  return (
                    <div key={msg.id ?? msg.createdAt} className="flex justify-center">
                      <div className="max-w-[80%] bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2 text-xs text-amber-800">
                        <div className="flex items-center gap-1.5 mb-1 font-medium opacity-60">
                          <StickyNote size={10} />
                          <span>Internal note</span>
                        </div>
                        <p className="italic">{msg.content}</p>
                        <div className="text-right mt-1 opacity-50">{format(new Date(msg.createdAt), 'HH:mm')}</div>
                      </div>
                    </div>
                  )
                }

                const isGuest = msg.senderType === 'guest'
                return (
                  <div
                    key={msg.id ?? msg.createdAt}
                    className={cn('flex gap-2.5', isGuest ? 'justify-start' : 'justify-end')}
                  >
                    {isGuest && (
                      <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <User size={13} className="text-gray-600" />
                      </div>
                    )}
                    <div className={cn(
                      'max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm',
                      isGuest
                        ? 'bg-white border text-foreground rounded-tl-sm'
                        : msg.senderType === 'staff'
                        ? 'bg-blue-600 text-white rounded-tr-sm'
                        : 'bg-[#0F172A] text-white rounded-tr-sm',
                      msg.id?.startsWith('optimistic') && 'opacity-70',
                    )}>
                      <div
                        className="chat-content leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: formatContent(msg.englishContent ?? msg.content) }}
                      />
                      {msg.originalLanguage && msg.originalLanguage !== 'en' && msg.content !== (msg.englishContent ?? msg.content) && (
                        <div className="mt-1.5 pt-1.5 border-t border-white/20 text-[10px] opacity-50 leading-snug">
                          {msg.content}
                        </div>
                      )}
                      <div className="text-xs mt-1 opacity-60 text-right">
                        {format(new Date(msg.createdAt), 'HH:mm')}
                      </div>
                    </div>
                    {(msg.senderType === 'assistant' || msg.senderType === 'staff') && (
                      <div className={cn(
                        'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
                        msg.senderType === 'staff' ? 'bg-blue-100' : 'bg-amber-100',
                      )}>
                        {msg.senderType === 'staff'
                          ? <Headphones size={13} className="text-blue-600" />
                          : <Bot size={13} className="text-amber-700" />}
                      </div>
                    )}
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            {tab === 'active' ? (
              <div className="bg-white border-t flex-shrink-0">
                {/* AI suggestions strip */}
                {suggestions.length > 0 && (
                  <div className="px-3 pt-2.5 pb-0 flex items-start gap-2">
                    <Sparkles size={13} className="text-violet-500 mt-1 flex-shrink-0" />
                    <div className="flex flex-wrap gap-1.5 flex-1">
                      {suggestions.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => { setText(s); setSuggestions([]); inputRef.current?.focus() }}
                          className="text-xs bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 rounded-lg px-2.5 py-1 text-left transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => setSuggestions([])} className="text-muted-foreground hover:text-foreground mt-0.5">
                      <X size={13} />
                    </button>
                  </div>
                )}

                {/* Mode toggle + input */}
                <div className="p-3">
                  <div className="flex gap-1 mb-2">
                    <button
                      onClick={() => setInputMode('reply')}
                      className={cn(
                        'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                        inputMode === 'reply' ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:text-foreground',
                      )}
                    >
                      Reply
                    </button>
                    <button
                      onClick={() => setInputMode('note')}
                      className={cn(
                        'px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1',
                        inputMode === 'note' ? 'bg-amber-400 text-amber-900' : 'bg-muted text-muted-foreground hover:text-foreground',
                      )}
                    >
                      <StickyNote size={11} />
                      Note
                    </button>
                    <button
                      onClick={handleSuggest}
                      disabled={loadingSuggest}
                      className="ml-auto px-2.5 py-1 rounded-md text-xs font-medium bg-muted text-muted-foreground hover:text-violet-600 hover:bg-violet-50 transition-colors flex items-center gap-1 disabled:opacity-50"
                    >
                      {loadingSuggest ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                      AI Suggest
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <Input
                      ref={inputRef}
                      value={text}
                      onChange={e => setText(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                      placeholder={inputMode === 'note' ? 'Add internal note…' : 'Reply to guest…'}
                      className={cn(
                        'flex-1 transition-colors',
                        inputMode === 'note' && 'border-amber-300 focus:ring-amber-200 bg-amber-50/50',
                      )}
                    />
                    <Button
                      onClick={handleSend}
                      disabled={!text.trim() || isPending}
                      size="icon"
                      className={cn(
                        inputMode === 'note'
                          ? 'bg-amber-400 hover:bg-amber-500 text-amber-900'
                          : 'bg-[#0F172A] hover:bg-[#0F172A]/90',
                      )}
                    >
                      {isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-muted/50 border-t p-3 text-center text-xs text-muted-foreground flex-shrink-0">
                This is a past conversation — guest has checked out
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Right: guest info sidebar ── */}
      {selectedId && showSidebar && (
        <div className="hidden lg:flex w-72 xl:w-80 border-l bg-white flex-col flex-shrink-0 overflow-y-auto scrollbar-thin">
          {activeConvo ? (
            <>
              {/* Guest card */}
              <div className="p-4 border-b">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                    {activeConvo.guestSession.guestName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{activeConvo.guestSession.guestName}</div>
                    <div className="text-xs text-muted-foreground truncate">{activeConvo.guestSession.email}</div>
                  </div>
                </div>
                {activeConvo.guestSession.preferredLanguage && activeConvo.guestSession.preferredLanguage !== 'en' && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Globe size={12} />
                    <span>{LANG_NAMES[activeConvo.guestSession.preferredLanguage] || activeConvo.guestSession.preferredLanguage}</span>
                  </div>
                )}
              </div>

              {/* Stay info */}
              <div className="p-4 border-b space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Stay</div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Room</span>
                  <span className="font-medium">{activeConvo.room.roomNumber} · {activeConvo.room.roomType}</span>
                </div>
                {activeConvo.room.floor != null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Floor</span>
                    <span className="font-medium">{activeConvo.room.floor}</span>
                  </div>
                )}
                {activeConvo.guestSession.checkInDate && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Check-in</span>
                    <span className="font-medium">{format(new Date(activeConvo.guestSession.checkInDate), 'MMM d')}</span>
                  </div>
                )}
                {activeConvo.guestSession.checkOutDate && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Check-out</span>
                    <span className="font-medium">{format(new Date(activeConvo.guestSession.checkOutDate), 'MMM d')}</span>
                  </div>
                )}
              </div>

              {/* Service requests */}
              <div className="p-4 border-b">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  <ClipboardList size={11} />
                  Requests
                </div>
                {!guestContext ? (
                  <div className="text-xs text-muted-foreground">Loading…</div>
                ) : guestContext.requests.length === 0 ? (
                  <div className="text-xs text-muted-foreground italic">No requests</div>
                ) : (
                  <div className="space-y-2">
                    {guestContext.requests.map(r => (
                      <div key={r.id} className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate">{r.type}</div>
                          {r.details && <div className="text-xs text-muted-foreground truncate">{r.details}</div>}
                          <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                            {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                          </div>
                        </div>
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0', STATUS_CHIP[r.status] || 'bg-muted text-muted-foreground')}>
                          {r.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Orders */}
              <div className="p-4">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  <ShoppingBag size={11} />
                  Orders
                </div>
                {!guestContext ? (
                  <div className="text-xs text-muted-foreground">Loading…</div>
                ) : guestContext.orders.length === 0 ? (
                  <div className="text-xs text-muted-foreground italic">No orders</div>
                ) : (
                  <div className="space-y-2.5">
                    {guestContext.orders.map(o => (
                      <div key={o.id} className="text-xs">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-medium">₹{o.totalAmount.toFixed(0)}</span>
                          <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', STATUS_CHIP[o.status] || 'bg-muted text-muted-foreground')}>
                            {o.status}
                          </span>
                        </div>
                        <div className="text-muted-foreground truncate">
                          {o.items.map(i => `${i.quantity}× ${i.itemNameSnapshot}`).join(', ')}
                        </div>
                        <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                          {formatDistanceToNow(new Date(o.createdAt), { addSuffix: true })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Loading…</div>
          )}
        </div>
      )}
    </div>
  )
}
