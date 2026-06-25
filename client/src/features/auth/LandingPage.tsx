import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { useEffect, useRef, useState } from 'react'
import {
  QrCode, MessageSquare, BarChart3, Globe, Bot,
  Bell, Shield, Sparkles, ArrowRight, CheckCircle2,
  Utensils, Wrench, ClipboardCheck,
} from 'lucide-react'

// ── All CSS keyframes in one place ────────────────────────────────────────────
const GLOBAL_CSS = `
  @keyframes sf-ticker  { from { transform:translateX(0) } to { transform:translateX(-50%) } }
  @keyframes sf-orb1    { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(50px,-35px) scale(1.08)} 66%{transform:translate(-30px,45px) scale(0.93)} }
  @keyframes sf-orb2    { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(-55px,28px) scale(1.06)} 66%{transform:translate(28px,-45px) scale(0.9)} }
  @keyframes sf-orb3    { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(18px,22px) scale(1.12)} }
  @keyframes sf-glow    { 0%,100%{box-shadow:0 0 0 0 rgba(99,102,241,0.55),0 4px 24px rgba(99,102,241,0.25)} 50%{box-shadow:0 0 0 10px rgba(99,102,241,0),0 4px 52px rgba(99,102,241,0.5)} }
  @keyframes sf-typing  { 0%,80%,100%{opacity:0.2;transform:translateY(0)} 40%{opacity:1;transform:translateY(-3px)} }
  @keyframes sf-fadeup  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes sf-flow-dot { 0%{left:0%;opacity:0} 10%{opacity:1} 90%{opacity:1} 100%{left:100%;opacity:0} }
  @keyframes sf-node-ping { 0%{transform:scale(1);opacity:1} 60%{transform:scale(1.7);opacity:0} 100%{transform:scale(1.7);opacity:0} }
  @keyframes sf-connector { 0%{stroke-dashoffset:80} 100%{stroke-dashoffset:0} }
`

// ── Fade-in on scroll ─────────────────────────────────────────────────────────
function FadeIn({ children, delay = 0, className = '', style = {} }: {
  children: React.ReactNode
  delay?: number
  className?: string
  style?: React.CSSProperties
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold: 0.1 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(28px)',
        transition: `opacity 0.65s ease ${delay}ms, transform 0.65s ease ${delay}ms`,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// ── Animated counter ──────────────────────────────────────────────────────────
function AnimatedCounter({ value, suffix = '', prefix = '' }: {
  value: number
  suffix?: string
  prefix?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const [count, setCount] = useState(0)
  const [started, setStarted] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setStarted(true); obs.disconnect() } },
      { threshold: 0.5 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  useEffect(() => {
    if (!started) return
    let start: number
    const duration = 1700
    const step = (now: number) => {
      if (!start) start = now
      const p = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setCount(Math.round(eased * value))
      if (p < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [started, value])
  return <span ref={ref}>{prefix}{count}{suffix}</span>
}

// ── Gradient orbs ─────────────────────────────────────────────────────────────
function GradientOrbs() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      <div style={{
        position: 'absolute', top: '-15%', left: '-8%',
        width: 700, height: 700, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 68%)',
        filter: 'blur(40px)',
        animation: 'sf-orb1 14s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', bottom: '-20%', right: '-8%',
        width: 580, height: 580, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(168,85,247,0.15) 0%, transparent 68%)',
        filter: 'blur(50px)',
        animation: 'sf-orb2 18s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', top: '38%', left: '32%',
        width: 340, height: 340, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(59,130,246,0.09) 0%, transparent 70%)',
        filter: 'blur(60px)',
        animation: 'sf-orb3 9s ease-in-out infinite',
      }} />
    </div>
  )
}

// ── Animated chat preview ─────────────────────────────────────────────────────
const CHAT_STEPS: { type: 'guest' | 'bot' | 'typing'; text?: string }[] = [
  { type: 'guest', text: "I'd like 2 butter chickens and a mango lassi 🙏" },
  { type: 'typing' },
  { type: 'bot',   text: "Order placed! 🎉\nButter Chicken ×2 — ₹1,440\nMango Lassi ×1 — ₹180\nTotal: ₹1,620 · est. 30 min" },
  { type: 'guest', text: "Also need extra towels please" },
  { type: 'typing' },
  { type: 'bot',   text: "Housekeeping will bring towels to Room 203 within 15 minutes. ✅" },
]
const STEP_DELAYS = [700, 900, 1200, 800, 1400]

function AnimatedChat() {
  const [step, setStep]       = useState(0)
  const [msgs, setMsgs]       = useState<typeof CHAT_STEPS>([])
  const [typing, setTyping]   = useState(false)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    if (step >= CHAT_STEPS.length) {
      timer = setTimeout(() => { setMsgs([]); setTyping(false); setStep(0) }, 3200)
      return () => clearTimeout(timer)
    }
    timer = setTimeout(() => {
      const cur = CHAT_STEPS[step]
      if (cur.type === 'typing') { setTyping(true) }
      else { setTyping(false); setMsgs(p => [...p, cur]) }
      setStep(s => s + 1)
    }, step === 0 ? 500 : STEP_DELAYS[step - 1])
    return () => clearTimeout(timer)
  }, [step])

  return (
    <div style={{
      background: '#18181b', borderRadius: 24,
      border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden',
      boxShadow: '0 0 0 1px rgba(99,102,241,0.18), 0 32px 72px rgba(0,0,0,0.6), 0 0 100px rgba(99,102,241,0.1)',
    }}>
      {/* Header */}
      <div style={{ background: '#0f0f12', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg,#6366f1,#818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Bot size={15} color="#fff" />
        </div>
        <div>
          <p style={{ color: '#fff', fontSize: 12, fontWeight: 600, margin: 0 }}>Royal Palm Suites</p>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, margin: 0 }}>Room 203 · AI Concierge</p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Online</span>
        </div>
      </div>

      {/* Messages */}
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 228 }}>
        {msgs.map((msg, i) => msg.type === 'guest' ? (
          <div key={i} style={{ display: 'flex', justifyContent: 'flex-end', animation: 'sf-fadeup 0.28s ease' }}>
            <div style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', fontSize: 12, padding: '8px 12px', borderRadius: '16px 16px 4px 16px', maxWidth: '78%', lineHeight: 1.5 }}>
              {msg.text}
            </div>
          </div>
        ) : (
          <div key={i} style={{ display: 'flex', gap: 8, animation: 'sf-fadeup 0.28s ease' }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(251,191,36,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
              <Bot size={11} color="#fbbf24" />
            </div>
            <div style={{ background: '#232327', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.85)', fontSize: 12, padding: '8px 12px', borderRadius: '16px 16px 16px 4px', maxWidth: '80%', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
              {msg.text}
            </div>
          </div>
        ))}

        {typing && (
          <div style={{ display: 'flex', gap: 8, animation: 'sf-fadeup 0.2s ease' }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(251,191,36,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Bot size={11} color="#fbbf24" />
            </div>
            <div style={{ background: '#232327', border: '1px solid rgba(255,255,255,0.07)', padding: '10px 14px', borderRadius: '16px 16px 16px 4px', display: 'flex', gap: 4, alignItems: 'center' }}>
              {[0, 160, 320].map(d => (
                <span key={d} style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.4)', display: 'inline-block', animation: `sf-typing 1.2s ${d}ms ease-in-out infinite` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input bar */}
      <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: 999, padding: '6px 14px', fontSize: 12, color: 'rgba(255,255,255,0.22)' }}>
          Message hotel…
        </div>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ArrowRight size={12} color="#fff" />
        </div>
      </div>
    </div>
  )
}

// ── Hotel name ticker ─────────────────────────────────────────────────────────
const HOTEL_NAMES = ['Marriott', 'Hyatt', 'Hilton', 'ITC Hotels', 'Taj Hotels', 'Oberoi', 'Leela', 'Radisson', 'Novotel', 'Sheraton']

function LogoTicker() {
  const items = [...HOTEL_NAMES, ...HOTEL_NAMES]
  return (
    <div style={{ width: '100%', overflow: 'hidden', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#111114', padding: '20px 0' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', width: 'max-content', animation: 'sf-ticker 30s linear infinite' }}
        onMouseEnter={e => (e.currentTarget.style.animationPlayState = 'paused')}
        onMouseLeave={e => (e.currentTarget.style.animationPlayState = 'running')}
      >
        {items.map((name, i) => (
          <span key={i} style={{ margin: '0 48px', fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.22)', whiteSpace: 'nowrap', flexShrink: 0, transition: 'color 0.2s', cursor: 'default' }}
            onMouseEnter={e => ((e.target as HTMLElement).style.color = 'rgba(255,255,255,0.65)')}
            onMouseLeave={e => ((e.target as HTMLElement).style.color = 'rgba(255,255,255,0.22)')}
          >{name}</span>
        ))}
      </div>
    </div>
  )
}

// ── Glowing CTA button ────────────────────────────────────────────────────────
function GlowButton({ onClick, children, small = false }: {
  onClick: () => void
  children: React.ReactNode
  small?: boolean
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: small ? '9px 22px' : '13px 30px',
        fontSize: small ? 13 : 14,
        fontWeight: 600,
        borderRadius: 999,
        background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
        color: '#fff',
        border: 'none',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        animation: 'sf-glow 2.8s ease-in-out infinite',
        transition: 'transform 0.15s, opacity 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; e.currentTarget.style.opacity = '0.92' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.opacity = '1' }}
    >
      {children}
    </button>
  )
}

// ── Before / After comparison ─────────────────────────────────────────────────
const COMPARISON_ROWS = [
  { before: 'WhatsApp messages get buried in group chats',      after: 'Every request logged instantly, nothing missed' },
  { before: 'Staff miss requests during busy check-in hours',   after: 'AI handles 85% automatically, around the clock' },
  { before: 'Guests call front desk for everything',            after: 'Guests self-serve from a QR in their room' },
  { before: 'Paper menus, handwritten orders, lost tickets',    after: 'Digital orders with instant kitchen alerts' },
  { before: 'Language barriers cause misunderstandings',        after: '12 languages — guests chat in their own tongue' },
  { before: 'No data on what guests actually want',             after: 'Real-time analytics on every request and order' },
]

function BeforeAfter() {
  return (
    <section style={{ padding: '96px 0', background: '#111114', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="max-w-5xl mx-auto px-6">
        <FadeIn>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <h2 style={{ fontSize: 'clamp(28px,4vw,42px)', fontWeight: 800, color: '#fff', marginBottom: 14, letterSpacing: '-0.02em' }}>
              The old way vs StayFlow
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', maxWidth: 400, margin: '0 auto', lineHeight: 1.68 }}>
              Most hotels still run on WhatsApp groups and paper. Here's what changes.
            </p>
          </div>
        </FadeIn>

        {/* Column headers */}
        <FadeIn delay={60}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 48px 1fr', gap: 0, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 16 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Before</span>
            </div>
            <div />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 16 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>With StayFlow</span>
            </div>
          </div>
        </FadeIn>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {COMPARISON_ROWS.map(({ before, after }, i) => (
            <FadeIn key={i} delay={i * 50}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 48px 1fr', alignItems: 'center', gap: 0 }}>
                {/* Before */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.12)',
                  borderRadius: '12px 0 0 12px', padding: '14px 16px',
                  transition: 'background 0.2s',
                }}>
                  <span style={{ fontSize: 14, color: '#f87171', flexShrink: 0, fontWeight: 700, lineHeight: 1 }}>✕</span>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', lineHeight: 1.5 }}>{before}</span>
                </div>

                {/* Divider arrow */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: '#18181b', border: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, color: 'rgba(255,255,255,0.3)',
                  }}>→</div>
                </div>

                {/* After */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.18)',
                  borderRadius: '0 12px 12px 0', padding: '14px 16px',
                  transition: 'background 0.2s',
                }}>
                  <CheckCircle2 size={15} color="#4ade80" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.78)', lineHeight: 1.5, fontWeight: 500 }}>{after}</span>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Service flow chart ────────────────────────────────────────────────────────
const FLOW_NODES = [
  { icon: QrCode,        label: 'Guest scans QR',      sub: 'No app, no login',         color: '#6366f1' },
  { icon: MessageSquare, label: 'Sends a request',      sub: 'Chat, order, or complaint', color: '#8b5cf6' },
  { icon: Bot,           label: 'AI processes it',      sub: 'Claude responds instantly', color: '#a855f7' },
  { icon: Bell,          label: 'Staff notified',        sub: 'Real-time dashboard alert', color: '#ec4899' },
  { icon: ClipboardCheck,label: 'Request fulfilled',    sub: 'Status updated to done',   color: '#22c55e' },
]

// Branching sub-flows shown below the main nodes
const BRANCH_ITEMS = [
  { icon: Utensils,  label: 'Food order → Kitchen',    nodeIndex: 2 },
  { icon: Wrench,    label: 'Maintenance → Tech team', nodeIndex: 2 },
  { icon: Globe,     label: 'In guest\'s language',    nodeIndex: 2 },
]

function ServiceFlowChart() {
  const [active, setActive] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setActive(a => (a + 1) % FLOW_NODES.length), 1400)
    return () => clearInterval(id)
  }, [])

  return (
    <section style={{ padding: '96px 0', background: '#09090b' }}>
      <div className="max-w-6xl mx-auto px-6">
        <FadeIn>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <h2 style={{ fontSize: 'clamp(28px,4vw,42px)', fontWeight: 800, color: '#fff', marginBottom: 14, letterSpacing: '-0.02em' }}>
              From request to resolved
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.42)', maxWidth: 440, margin: '0 auto', lineHeight: 1.68 }}>
              Every guest request flows through a single intelligent pipeline — handled in seconds, tracked in real time.
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={120}>
          {/* ── Main flow row ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, overflowX: 'auto', paddingBottom: 8 }}>
            {FLOW_NODES.map((node, i) => {
              const isActive   = active === i
              const isDone     = active > i
              const Icon       = node.icon
              const nodeColor  = isDone ? '#22c55e' : isActive ? node.color : 'rgba(255,255,255,0.12)'
              const textColor  = isDone || isActive ? '#fff' : 'rgba(255,255,255,0.38)'

              return (
                <div key={node.label} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  {/* Node */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 120 }}>
                    {/* Circle with ping ring */}
                    <div style={{ position: 'relative', marginBottom: 14 }}>
                      {isActive && (
                        <div style={{
                          position: 'absolute', inset: -8, borderRadius: '50%',
                          border: `2px solid ${node.color}`,
                          animation: 'sf-node-ping 1.4s ease-out infinite',
                          pointerEvents: 'none',
                        }} />
                      )}
                      <div style={{
                        width: 56, height: 56, borderRadius: '50%',
                        background: isActive
                          ? `linear-gradient(135deg, ${node.color}33, ${node.color}22)`
                          : isDone
                          ? 'rgba(34,197,94,0.15)'
                          : 'rgba(255,255,255,0.04)',
                        border: `2px solid ${nodeColor}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.4s ease',
                        boxShadow: isActive ? `0 0 28px ${node.color}55` : 'none',
                      }}>
                        {isDone
                          ? <CheckCircle2 size={22} color="#22c55e" />
                          : <Icon size={22} color={isActive ? node.color : 'rgba(255,255,255,0.3)'} />
                        }
                      </div>
                    </div>

                    <p style={{ fontSize: 12, fontWeight: 700, color: textColor, textAlign: 'center', margin: '0 0 4px', transition: 'color 0.4s', lineHeight: 1.3 }}>
                      {node.label}
                    </p>
                    <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)', textAlign: 'center', margin: 0, lineHeight: 1.4 }}>
                      {node.sub}
                    </p>
                  </div>

                  {/* Connector line between nodes */}
                  {i < FLOW_NODES.length - 1 && (
                    <div style={{ position: 'relative', width: 56, height: 2, flexShrink: 0, margin: '0 4px', marginBottom: 42 }}>
                      {/* Track */}
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.07)', borderRadius: 2 }} />
                      {/* Filled progress */}
                      <div style={{
                        position: 'absolute', top: 0, left: 0, height: '100%', borderRadius: 2,
                        background: active > i ? '#22c55e' : active === i ? FLOW_NODES[i].color : 'transparent',
                        width: active > i ? '100%' : active === i ? '100%' : '0%',
                        transition: 'width 0.5s ease, background 0.4s ease',
                      }} />
                      {/* Travelling dot */}
                      {active === i && (
                        <div style={{
                          position: 'absolute', top: '50%', transform: 'translateY(-50%)',
                          width: 8, height: 8, borderRadius: '50%',
                          background: FLOW_NODES[i].color,
                          boxShadow: `0 0 8px ${FLOW_NODES[i].color}`,
                          animation: 'sf-flow-dot 1.4s ease-in-out',
                          animationFillMode: 'forwards',
                        }} />
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* ── Branch labels (3 sub-paths from AI node) ── */}
          <div style={{ marginTop: 48, display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
            {BRANCH_ITEMS.map(({ icon: Icon, label }) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 16px', borderRadius: 999,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                fontSize: 12, color: 'rgba(255,255,255,0.45)',
              }}>
                <Icon size={13} color="#818cf8" />
                {label}
              </div>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  useEffect(() => {
    if (isAuthenticated) navigate('/app/overview', { replace: true })
  }, [isAuthenticated, navigate])

  const goDemo = () => window.open('https://cal.com/jayaditya-khamesra-u4ek0s', '_blank')

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: '#09090b', color: '#fff' }}>
      <style>{GLOBAL_CSS}</style>

      {/* ── Nav ── */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(9,9,11,0.82)', backdropFilter: 'blur(18px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <span className="text-xl font-bold tracking-tight">StayFlow</span>
          <GlowButton onClick={goDemo} small>Book a Demo</GlowButton>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ position: 'relative', overflow: 'hidden' }}>
        <GradientOrbs />
        <div className="max-w-6xl mx-auto px-6 pt-24 pb-20" style={{ position: 'relative', zIndex: 1 }}>
          <div className="flex flex-col lg:flex-row items-center gap-14 lg:gap-20">

            {/* Left copy */}
            <div className="flex-1 text-center lg:text-left">
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 24, padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 999, background: 'rgba(99,102,241,0.12)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.25)' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1', display: 'inline-block' }} />
                AI-Powered Hotel Guest Experience
              </div>

              <h1 className="font-extrabold tracking-tight" style={{ fontSize: 'clamp(40px,6vw,66px)', lineHeight: 1.05, color: '#fff', marginBottom: 20 }}>
                The smarter way<br />to run a{' '}
                <span style={{ background: 'linear-gradient(135deg, #a5b4fc, #818cf8, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                  hotel.
                </span>
              </h1>

              <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.5)', maxWidth: 460, lineHeight: 1.72, marginBottom: 36 }}>
                One QR scan gives guests an AI concierge that handles room service,
                housekeeping, and requests — in 12 languages, around the clock.
              </p>

              <GlowButton onClick={goDemo}>
                Book a Demo <ArrowRight size={14} />
              </GlowButton>

              <div style={{ marginTop: 28, display: 'flex', flexWrap: 'wrap', gap: 18, justifyContent: 'center' }} className="lg:justify-start">
                {['No app download', '12 languages', 'Setup in 1 day'].map(item => (
                  <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                    <CheckCircle2 size={12} color="#4ade80" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {/* Right — animated chat */}
            <div className="flex-shrink-0 w-full" style={{ maxWidth: 330 }}>
              <AnimatedChat />
            </div>
          </div>
        </div>
      </section>

      {/* ── Logo ticker ── */}
      <div>
        <p style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.18)', marginBottom: 16 }}>
          Built for hotels like
        </p>
        <LogoTicker />
      </div>

      {/* ── Before / After ── */}
      <BeforeAfter />

      {/* ── Service flow chart ── */}
      <ServiceFlowChart />

      {/* ── Stats ── */}
      <section style={{ padding: '88px 0' }}>
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center px-6">
          {[
            { value: 12,   suffix: '',  prefix: '',   label: 'Languages supported', fixed: null  },
            { value: 2,    suffix: 's', prefix: '< ', label: 'AI response time',    fixed: null  },
            { value: 85,   suffix: '%', prefix: '',   label: 'Requests automated',  fixed: null  },
            { value: null, suffix: '',  prefix: '',   label: 'Always available',    fixed: '24/7' },
          ].map(({ value, suffix, prefix, label, fixed }) => (
            <FadeIn key={label}>
              <div style={{ fontSize: 38, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', marginBottom: 6 }}>
                {fixed ?? <AnimatedCounter value={value!} suffix={suffix} prefix={prefix} />}
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.32)' }}>{label}</div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ background: '#111114', padding: '96px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="max-w-6xl mx-auto px-6">
          <FadeIn>
            <div style={{ textAlign: 'center', marginBottom: 64 }}>
              <h2 style={{ fontSize: 'clamp(28px,4vw,42px)', fontWeight: 800, color: '#fff', marginBottom: 14, letterSpacing: '-0.02em' }}>
                Everything your hotel needs
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.42)', maxWidth: 480, margin: '0 auto', lineHeight: 1.68 }}>
                Replace paper menus, phone calls, and WhatsApp chaos with one intelligent platform.
              </p>
            </div>
          </FadeIn>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: QrCode,        title: 'QR Check-In',        desc: 'Guests scan a room QR — no app, no login, no friction. Works in seconds.' },
              { icon: Bot,           title: 'AI Concierge',        desc: 'Powered by Claude. Handles orders, FAQs, requests, and escalations naturally.' },
              { icon: Globe,         title: '12 Languages',        desc: 'Real-time Google Translate. Guests chat in their language, staff see English.' },
              { icon: MessageSquare, title: 'WhatsApp + Web Chat', desc: 'Guests connect via QR web chat or WhatsApp — both powered by the same AI.' },
              { icon: Bell,          title: 'Smart Notifications', desc: 'New orders, escalations, requests — real-time alerts to the right staff.' },
              { icon: BarChart3,     title: 'Insights',            desc: 'QR scans, popular items, request patterns. Know your property better.' },
            ].map(({ icon: Icon, title, desc }, i) => (
              <FadeIn key={title} delay={i * 55} style={{ height: '100%' }}>
                <div
                  style={{ background: '#18181b', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 24, height: '100%', transition: 'border-color 0.22s, transform 0.22s, box-shadow 0.22s' }}
                  onMouseEnter={e => { const el = e.currentTarget; el.style.borderColor = 'rgba(99,102,241,0.35)'; el.style.transform = 'translateY(-3px)'; el.style.boxShadow = '0 12px 40px rgba(99,102,241,0.12)' }}
                  onMouseLeave={e => { const el = e.currentTarget; el.style.borderColor = 'rgba(255,255,255,0.07)'; el.style.transform = 'translateY(0)'; el.style.boxShadow = 'none' }}
                >
                  <div style={{ width: 42, height: 42, borderRadius: 13, background: 'rgba(99,102,241,0.13)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                    <Icon size={19} color="#818cf8" />
                  </div>
                  <h3 style={{ fontWeight: 700, color: '#fff', marginBottom: 7, fontSize: 15 }}>{title}</h3>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.43)', lineHeight: 1.67, margin: 0 }}>{desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section style={{ padding: '96px 0' }}>
        <div className="max-w-4xl mx-auto px-6 text-center">
          <FadeIn>
            <h2 style={{ fontSize: 'clamp(28px,4vw,42px)', fontWeight: 800, color: '#fff', marginBottom: 14, letterSpacing: '-0.02em' }}>
              Live in under a day
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.42)', marginBottom: 64, maxWidth: 400, margin: '0 auto 64px', lineHeight: 1.68 }}>
              No complex setup. Print a QR code, place it in the room, and you're running.
            </p>
          </FadeIn>

          <div className="grid sm:grid-cols-3 gap-10 text-left">
            {[
              { step: '01', title: 'Print QR codes',     desc: 'Generate a unique QR for each room from your dashboard. Print and place.' },
              { step: '02', title: 'Guests scan & chat', desc: 'Guests scan on arrival. Pick their language, enter their name, start chatting.' },
              { step: '03', title: 'Staff get notified', desc: 'Orders, requests, and escalations appear in real-time on the staff dashboard.' },
            ].map(({ step, title, desc }, i) => (
              <FadeIn key={step} delay={i * 110}>
                <div style={{ fontSize: 56, fontWeight: 900, color: 'rgba(255,255,255,0.04)', lineHeight: 1, marginBottom: 14 }}>{step}</div>
                <h3 style={{ fontWeight: 700, color: '#fff', marginBottom: 8, fontSize: 15 }}>{title}</h3>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.42)', lineHeight: 1.67, margin: 0 }}>{desc}</p>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why StayFlow ── */}
      <section style={{ background: '#111114', padding: '96px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="max-w-4xl mx-auto px-6">
          <FadeIn>
            <h2 style={{ fontSize: 'clamp(28px,4vw,42px)', fontWeight: 800, color: '#fff', textAlign: 'center', marginBottom: 56, letterSpacing: '-0.02em' }}>
              Why hotels choose StayFlow
            </h2>
          </FadeIn>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { icon: Sparkles, title: 'Zero friction for guests',  desc: "No app install, no OTP, no account. One QR scan and they're chatting with your AI concierge in their language." },
              { icon: Shield,   title: 'Staff always in control',   desc: "Every AI response is grounded in your hotel's own data. Staff can override, escalate, or jump in anytime." },
              { icon: Globe,    title: 'Works for any guest',       desc: 'Supports 12 languages including Hindi, Arabic, Chinese, and Japanese. No guest left behind.' },
            ].map(({ icon: Icon, title, desc }, i) => (
              <FadeIn key={title} delay={i * 80}>
                <div
                  style={{ display: 'flex', gap: 20, alignItems: 'flex-start', background: '#18181b', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 24, transition: 'border-color 0.22s, transform 0.22s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.transform = 'translateY(0)' }}
                >
                  <div style={{ width: 42, height: 42, borderRadius: 13, background: 'rgba(99,102,241,0.13)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={19} color="#818cf8" />
                  </div>
                  <div>
                    <h3 style={{ fontWeight: 700, color: '#fff', marginBottom: 6, fontSize: 15 }}>{title}</h3>
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.43)', lineHeight: 1.67, margin: 0 }}>{desc}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Integrations ── */}
      <section style={{ padding: '96px 0' }}>
        <div className="max-w-5xl mx-auto px-6 text-center">
          <FadeIn>
            <h2 style={{ fontSize: 'clamp(28px,4vw,42px)', fontWeight: 800, color: '#fff', marginBottom: 14, letterSpacing: '-0.02em' }}>Integrations</h2>
            <p style={{ color: 'rgba(255,255,255,0.38)', marginBottom: 48 }}>Connects with the tools your hotel already uses.</p>
          </FadeIn>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { name: 'Opera PMS',       tag: 'PMS'     },
              { name: 'Hotelogix',       tag: 'PMS'     },
              { name: 'WhatsApp',        tag: 'Channel' },
              { name: 'Claude AI',       tag: 'AI'      },
            ].map(({ name, tag }, i) => (
              <FadeIn key={name} delay={i * 65}>
                <div
                  style={{ background: '#18181b', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '22px 16px', transition: 'border-color 0.22s, transform 0.22s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.35)'; e.currentTarget.style.transform = 'translateY(-3px)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.transform = 'translateY(0)' }}
                >
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#818cf8', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{tag}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.72)' }}>{name}</div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section style={{ background: '#111114', padding: '100px 24px', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', position: 'relative', overflow: 'hidden' }}>
        {/* Ambient glow behind CTA */}
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 700, height: 350, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.09) 0%, transparent 70%)', filter: 'blur(40px)', pointerEvents: 'none' }} />
        <FadeIn style={{ position: 'relative' }}>
          <h2 style={{ fontSize: 'clamp(28px,4vw,42px)', fontWeight: 800, color: '#fff', marginBottom: 14, letterSpacing: '-0.02em' }}>
            Ready to upgrade your guest experience?
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.38)', marginBottom: 36, maxWidth: 400, margin: '0 auto 36px', lineHeight: 1.68 }}>
            See StayFlow in action with a live demo tailored to your property.
          </p>
          <GlowButton onClick={goDemo}>
            Book a Demo <ArrowRight size={14} />
          </GlowButton>
        </FadeIn>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '28px 24px' }}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <span style={{ fontWeight: 700, color: '#fff' }}>StayFlow</span>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.22)' }}>&copy; {new Date().getFullYear()} StayFlow. Built in India.</span>
        </div>
      </footer>
    </div>
  )
}
