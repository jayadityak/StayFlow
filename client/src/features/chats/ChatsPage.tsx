import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input, Badge } from '@/components/ui/primitives'
import { Send, MessageSquare, AlertTriangle, User, Bot, Headphones } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

interface Conversation {
  id: string
  status: string
  hasEscalation: boolean
  createdAt: string
  updatedAt: string
  guestSession: { guestName: string; email: string }
  room: { roomNumber: string; roomType: string }
  messages: { id?: string; content: string; englishContent?: string | null; originalLanguage?: string | null; senderType: string; createdAt: string }[]
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

export default function ChatsPage() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reply, setReply] = useState('')
  const [tab, setTab] = useState<'active' | 'past'>('active')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const lastSeenCounts = useRef<Record<string, number>>({})

  const { data: activeConversations = [], isLoading: loadingActive } = useQuery({
    queryKey: ['chats', 'active'],
    queryFn: () => api.get<Conversation[]>('/chats'),
    refetchInterval: 30000, // SSE handles real-time; polling is fallback only
  })

  const { data: pastConversations = [], isLoading: loadingPast } = useQuery({
    queryKey: ['chats', 'past'],
    queryFn: () => api.get<Conversation[]>('/chats/past'),
    enabled: tab === 'past',
    refetchInterval: 30000,
  })

  const conversations = tab === 'active' ? activeConversations : pastConversations
  const isLoading = tab === 'active' ? loadingActive : loadingPast

  const { data: activeConvo } = useQuery({
    queryKey: ['chat', selectedId],
    queryFn: () => api.get<Conversation>(`/chats/${selectedId}`),
    enabled: !!selectedId,
    refetchInterval: 15000, // SSE push via message_created is the primary update path
  })

  // Initialise lastSeen for all conversations on first load so existing
  // messages don't appear as "unread" from a fresh page load.
  useEffect(() => {
    conversations.forEach(conv => {
      if (!(conv.id in lastSeenCounts.current)) {
        lastSeenCounts.current[conv.id] = conv._count?.messages ?? 0
      }
    })
  }, [conversations.length])

  // When new messages arrive for the active conversation, mark as seen.
  useEffect(() => {
    if (selectedId && activeConvo) {
      lastSeenCounts.current[selectedId] = activeConvo.messages?.length ?? 0
    }
  }, [activeConvo?.messages?.length, selectedId])

  // Auto-scroll to bottom whenever messages change.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeConvo?.messages?.length])

  const handleSelect = (id: string) => {
    setSelectedId(id)
    // Mark current count as seen immediately on click.
    const conv = conversations.find(c => c.id === id)
    if (conv) lastSeenCounts.current[id] = conv._count?.messages ?? 0
    // Focus the reply input.
    setTimeout(() => inputRef.current?.focus(), 80)
  }

  const getUnreadCount = (conv: Conversation) => {
    const total = conv._count?.messages ?? 0
    const seen = lastSeenCounts.current[conv.id] ?? total
    return Math.max(0, total - seen)
  }

  const replyMutation = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      api.post(`/chats/${id}/reply`, { content }),

    // Optimistic update — add message to cache immediately so the UI
    // updates without waiting for the server round-trip.
    onMutate: async ({ id, content }) => {
      await qc.cancelQueries({ queryKey: ['chat', id] })
      const previous = qc.getQueryData<Conversation>(['chat', id])
      qc.setQueryData<Conversation>(['chat', id], old => old ? {
        ...old,
        messages: [
          ...old.messages,
          {
            id: `optimistic-${Date.now()}`,
            senderType: 'staff',
            content,
            createdAt: new Date().toISOString(),
          } as Message,
        ],
      } : old)
      setReply('')
      return { previous, id }
    },

    onError: (_err: any, _vars, context: any) => {
      if (context?.previous) qc.setQueryData(['chat', context.id], context.previous)
      toast('Failed to send message', 'error')
    },

    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['chat', id] })
      qc.invalidateQueries({ queryKey: ['chats'] })
    },
  })

  const handleSend = () => {
    if (!reply.trim() || !selectedId) return
    replyMutation.mutate({ id: selectedId, content: reply.trim() })
  }

  const formatContent = (content: string) =>
    content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br/>')

  const selected = conversations.find(c => c.id === selectedId)

  return (
    <div className="h-[calc(100vh-64px)] flex">
      {/* Conversation list */}
      <div className={cn(
        "w-full lg:w-80 border-r bg-white flex flex-col flex-shrink-0",
        selectedId ? "hidden lg:flex" : "flex"
      )}>
        <div className="p-4 border-b">
          <h1 className="font-display text-lg font-semibold">Chats</h1>
          <div className="flex gap-1 mt-2">
            <button
              onClick={() => { setTab('active'); setSelectedId(null) }}
              className={cn(
                'flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors',
                tab === 'active'
                  ? 'bg-[#0F172A] text-white'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              Active ({activeConversations.length})
            </button>
            <button
              onClick={() => { setTab('past'); setSelectedId(null) }}
              className={cn(
                'flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors',
                tab === 'past'
                  ? 'bg-[#0F172A] text-white'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              Past Chats
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center">
              <MessageSquare size={32} className="mb-3 opacity-30" />
              <p className="text-sm">No conversations yet</p>
            </div>
          ) : (
            conversations.map(conv => {
              const unread = getUnreadCount(conv)
              return (
                <button
                  key={conv.id}
                  onClick={() => handleSelect(conv.id)}
                  className={cn(
                    "w-full text-left px-4 py-3.5 border-b transition-colors hover:bg-muted/50",
                    selectedId === conv.id ? "bg-primary/5 border-l-2 border-l-primary" : ""
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
                  {conv.messages?.[0] && (
                    <p className={cn(
                      "text-xs truncate",
                      unread > 0 ? "text-foreground font-medium" : "text-muted-foreground"
                    )}>
                      {(conv.messages[0].englishContent ?? conv.messages[0].content).replace(/\*\*/g, '').substring(0, 60)}
                    </p>
                  )}
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Chat view */}
      <div className={cn(
        "flex-1 flex flex-col bg-[#F1F5F9]/30",
        !selectedId ? "hidden lg:flex" : "flex"
      )}>
        {!selectedId ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageSquare size={48} className="mb-4 opacity-20" />
            <p className="text-sm">Select a conversation</p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="bg-white border-b px-4 py-3 flex items-center gap-3">
              <button
                className="lg:hidden mr-1 text-muted-foreground hover:text-foreground"
                onClick={() => setSelectedId(null)}
              >
                ←
              </button>
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                {selected?.guestSession.guestName.charAt(0)}
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm">{selected?.guestSession.guestName}</div>
                <div className="text-xs text-muted-foreground">
                  Room {selected?.room.roomNumber} · {selected?.room.roomType}
                </div>
              </div>
              {selected?.hasEscalation && (
                <Badge variant="warning" className="gap-1 text-xs">
                  <AlertTriangle size={10} /> Escalated
                </Badge>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
              {activeConvo?.messages?.map((msg) => (
                <div
                  key={msg.id ?? msg.createdAt}
                  className={cn(
                    "flex gap-2.5",
                    msg.senderType === 'guest' ? "justify-start" : "justify-end"
                  )}
                >
                  {msg.senderType === 'guest' && (
                    <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User size={13} className="text-gray-600" />
                    </div>
                  )}
                  <div className={cn(
                    "max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm",
                    msg.senderType === 'guest'
                      ? "bg-white border text-foreground rounded-tl-sm"
                      : msg.senderType === 'staff'
                      ? "bg-blue-600 text-white rounded-tr-sm"
                      : "bg-[#0F172A] text-white rounded-tr-sm",
                    msg.id?.startsWith('optimistic-') && "opacity-70"
                  )}>
                    {/* Staff always sees English content; fall back to content for old messages */}
                    <div
                      className="chat-content leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: formatContent(msg.englishContent ?? msg.content) }}
                    />
                    {/* Show original text below if it was in a non-English language */}
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
                      "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                      msg.senderType === 'staff' ? "bg-blue-100" : "bg-amber-100"
                    )}>
                      {msg.senderType === 'staff'
                        ? <Headphones size={13} className="text-blue-600" />
                        : <Bot size={13} className="text-amber-700" />}
                    </div>
                  )}
                </div>
              ))}
              {/* Scroll anchor */}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply input — hidden for past chats */}
            {tab === 'active' && (
              <div className="bg-white border-t p-3 flex gap-2">
                <Input
                  ref={inputRef}
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder="Reply to guest..."
                  className="flex-1"
                />
                <Button
                  onClick={handleSend}
                  disabled={!reply.trim() || replyMutation.isPending}
                  size="icon"
                  className="bg-[#0F172A] hover:bg-[#0F172A]/90"
                >
                  <Send size={16} />
                </Button>
              </div>
            )}
            {tab === 'past' && (
              <div className="bg-muted/50 border-t p-3 text-center text-xs text-muted-foreground">
                This is a past conversation — guest has checked out
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
