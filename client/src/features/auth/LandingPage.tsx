import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { useEffect } from 'react'
import {
  QrCode, MessageSquare, BarChart3, Globe, Bot,
  Bell, Shield, Sparkles, ArrowRight, CheckCircle2,
} from 'lucide-react'

// Color tokens for dark theme
// bg-page:    #09090b  (zinc-950)
// bg-surface: #111114  (slightly lifted)
// bg-card:    #18181b  (zinc-900)
// border:     rgba(255,255,255,0.07)
// text-head:  #ffffff
// text-body:  rgba(255,255,255,0.55)
// text-muted: rgba(255,255,255,0.30)
// accent:     #6366f1  (indigo-500)
// accent-dim: rgba(99,102,241,0.15)

// ── Scrolling wordmark ticker ──────────────────────────────────────────────
// TODO: replace names with logo image files once available
const HOTEL_NAMES = [
  'Marriott', 'Hyatt', 'Hilton', 'ITC Hotels', 'Taj Hotels',
  'Oberoi', 'Leela', 'Radisson', 'Novotel', 'Sheraton',
]

function LogoTicker() {
  const repeated = [...HOTEL_NAMES, ...HOTEL_NAMES]
  return (
    <div style={{
      width: '100%', overflow: 'hidden',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      background: '#111114', padding: '20px 0',
    }}>
      <div
        style={{ display: 'flex', alignItems: 'center', width: 'max-content', animation: 'sf-ticker 30s linear infinite' }}
        onMouseEnter={e => (e.currentTarget.style.animationPlayState = 'paused')}
        onMouseLeave={e => (e.currentTarget.style.animationPlayState = 'running')}
      >
        {repeated.map((name, i) => (
          <span key={i} style={{
            margin: '0 48px', fontSize: 12, fontWeight: 700,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.25)', whiteSpace: 'nowrap',
            flexShrink: 0, transition: 'color 0.2s', cursor: 'default',
          }}
            onMouseEnter={e => ((e.target as HTMLElement).style.color = 'rgba(255,255,255,0.65)')}
            onMouseLeave={e => ((e.target as HTMLElement).style.color = 'rgba(255,255,255,0.25)')}
          >{name}</span>
        ))}
      </div>
      <style>{`@keyframes sf-ticker { from { transform:translateX(0) } to { transform:translateX(-50%) } }`}</style>
    </div>
  )
}

// ── Mock chat preview ──────────────────────────────────────────────────────
function ChatPreview() {
  return (
    <div style={{ background: '#18181b', borderRadius: 24, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden', boxShadow: '0 32px 64px rgba(0,0,0,0.5)' }}>
      {/* Header */}
      <div style={{ background: '#0f0f12', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ background: '#6366f1', color: '#fff', fontSize: 12, padding: '8px 12px', borderRadius: '16px 16px 4px 16px', maxWidth: '78%' }}>
            I'd like 2 butter chickens and a mango lassi 🙏
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(251,191,36,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
            <Bot size={11} color="#fbbf24" />
          </div>
          <div style={{ background: '#232327', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.8)', fontSize: 12, padding: '8px 12px', borderRadius: '16px 16px 16px 4px', maxWidth: '80%', lineHeight: 1.5 }}>
            Order placed! 🎉<br />
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>Butter Chicken ×2 — ₹1,440<br />Mango Lassi ×1 — ₹180</span><br />
            <span style={{ fontWeight: 600 }}>Total: ₹1,620 · 30–45 min</span>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ background: '#6366f1', color: '#fff', fontSize: 12, padding: '8px 12px', borderRadius: '16px 16px 4px 16px', maxWidth: '78%' }}>
            Also need extra towels please
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(251,191,36,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
            <Bot size={11} color="#fbbf24" />
          </div>
          <div style={{ background: '#232327', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.8)', fontSize: 12, padding: '8px 12px', borderRadius: '16px 16px 16px 4px', maxWidth: '80%' }}>
            Done! Housekeeping will bring extra towels within 15 minutes.
          </div>
        </div>
      </div>

      {/* Input */}
      <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: 999, padding: '6px 14px', fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>
          Message hotel…
        </div>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ArrowRight size={12} color="#fff" />
        </div>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function LandingPage() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  useEffect(() => {
    if (isAuthenticated) navigate('/app/overview', { replace: true })
  }, [isAuthenticated, navigate])

  const goDemo = () => window.open('https://cal.com/jayaditya-khamesra-u4ek0s', '_blank')

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: '#09090b', color: '#fff' }}>

      {/* ── Nav ── */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(9,9,11,0.85)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <span className="text-xl font-bold tracking-tight">StayFlow</span>
          <button onClick={goDemo} style={{ padding: '8px 20px', fontSize: 13, fontWeight: 600, borderRadius: 999, background: '#fff', color: '#09090b', border: 'none', cursor: 'pointer', transition: 'opacity 0.2s' }}
            onMouseEnter={e => ((e.target as HTMLElement).style.opacity = '0.85')}
            onMouseLeave={e => ((e.target as HTMLElement).style.opacity = '1')}
          >
            Book a Demo
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20">
        <div className="flex flex-col lg:flex-row items-center gap-14 lg:gap-20">

          {/* Left */}
          <div className="flex-1 text-center lg:text-left">
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 24, padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 999, background: 'rgba(99,102,241,0.12)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.25)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1', display: 'inline-block' }} />
              AI-Powered Hotel Guest Experience
            </div>

            <h1 className="font-extrabold tracking-tight" style={{ fontSize: 'clamp(40px,6vw,64px)', lineHeight: 1.06, color: '#fff', marginBottom: 20 }}>
              The smarter way<br />
              to run a{' '}
              <span style={{ color: '#818cf8' }}>hotel.</span>
            </h1>

            <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.5)', maxWidth: 460, lineHeight: 1.7, marginBottom: 32 }}>
              One QR scan gives guests an AI concierge that handles room service,
              housekeeping, and requests — in 12 languages, around the clock.
            </p>

            <button onClick={goDemo} style={{ padding: '12px 28px', fontSize: 14, fontWeight: 600, borderRadius: 999, background: '#fff', color: '#09090b', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              onMouseEnter={e => ((e.target as HTMLElement).style.background = '#e5e7eb')}
              onMouseLeave={e => ((e.target as HTMLElement).style.background = '#fff')}
            >
              Book a Demo <ArrowRight size={14} />
            </button>

            {/* Trust badges */}
            <div style={{ marginTop: 24, display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center' }} className="lg:justify-start">
              {['No app download', '12 languages', 'Setup in 1 day'].map(item => (
                <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                  <CheckCircle2 size={12} color="#4ade80" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Right — chat card */}
          <div className="flex-shrink-0 w-full" style={{ maxWidth: 320 }}>
            <ChatPreview />
          </div>
        </div>
      </section>

      {/* ── Logo ticker ── */}
      <div>
        <p style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', marginBottom: 16 }}>
          Built for hotels like
        </p>
        <LogoTicker />
      </div>

      {/* ── Stats ── */}
      <section style={{ padding: '72px 0' }}>
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center px-6">
          {[
            ['12', 'Languages supported'],
            ['< 2s', 'AI response time'],
            ['85%', 'Requests automated'],
            ['24/7', 'Always available'],
          ].map(([stat, label]) => (
            <div key={label}>
              <div style={{ fontSize: 36, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>{stat}</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginTop: 6 }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ background: '#111114', padding: '96px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="max-w-6xl mx-auto px-6">
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <h2 style={{ fontSize: 'clamp(28px,4vw,40px)', fontWeight: 800, color: '#fff', marginBottom: 14, letterSpacing: '-0.02em' }}>
              Everything your hotel needs
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.45)', maxWidth: 480, margin: '0 auto', lineHeight: 1.65 }}>
              Replace paper menus, phone calls, and WhatsApp chaos with one intelligent platform.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: QrCode,        title: 'QR Check-In',         desc: 'Guests scan a room QR — no app, no login, no friction. Works in seconds.' },
              { icon: Bot,           title: 'AI Concierge',         desc: 'Powered by Claude. Handles orders, FAQs, requests, and escalations naturally.' },
              { icon: Globe,         title: '12 Languages',         desc: 'Real-time Google Translate. Guests chat in their language, staff see English.' },
              { icon: MessageSquare, title: 'Live Staff Chat',      desc: 'Staff jump into any conversation. Seamless AI-to-human handoff, built in.' },
              { icon: Bell,          title: 'Smart Notifications',  desc: 'New orders, escalations, and requests — real-time alerts to the right staff.' },
              { icon: BarChart3,     title: 'Insights',             desc: 'QR scans, popular items, request patterns. Know your property better.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} style={{ background: '#18181b', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 24, transition: 'border-color 0.2s' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.14)')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)')}
              >
                <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <Icon size={18} color="#818cf8" />
                </div>
                <h3 style={{ fontWeight: 700, color: '#fff', marginBottom: 6, fontSize: 15 }}>{title}</h3>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.65, margin: 0 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section style={{ padding: '96px 0' }}>
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 style={{ fontSize: 'clamp(28px,4vw,40px)', fontWeight: 800, color: '#fff', marginBottom: 14, letterSpacing: '-0.02em' }}>
            Live in under a day
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.45)', marginBottom: 64, maxWidth: 400, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.65 }}>
            No complex setup. Print a QR code, place it in the room, and you're running.
          </p>

          <div className="grid sm:grid-cols-3 gap-10 text-left">
            {[
              { step: '01', title: 'Print QR codes',      desc: 'Generate a unique QR for each room from your dashboard. Print and place.' },
              { step: '02', title: 'Guests scan & chat',  desc: 'Guests scan on arrival. Pick their language, enter their name, start chatting.' },
              { step: '03', title: 'Staff get notified',  desc: 'Orders, requests, and escalations appear in real-time on the staff dashboard.' },
            ].map(({ step, title, desc }) => (
              <div key={step}>
                <div style={{ fontSize: 52, fontWeight: 900, color: 'rgba(255,255,255,0.05)', lineHeight: 1, marginBottom: 12 }}>{step}</div>
                <h3 style={{ fontWeight: 700, color: '#fff', marginBottom: 8, fontSize: 15 }}>{title}</h3>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.65, margin: 0 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why StayFlow ── */}
      <section style={{ background: '#111114', padding: '96px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="max-w-4xl mx-auto px-6">
          <h2 style={{ fontSize: 'clamp(28px,4vw,40px)', fontWeight: 800, color: '#fff', textAlign: 'center', marginBottom: 56, letterSpacing: '-0.02em' }}>
            Why hotels choose StayFlow
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { icon: Sparkles, title: 'Zero friction for guests',  desc: "No app install, no OTP, no account. One QR scan and they're chatting with your AI concierge in their language." },
              { icon: Shield,   title: 'Staff always in control',   desc: "Every AI response is grounded in your hotel's own data. Staff can override, escalate, or jump in anytime." },
              { icon: Globe,    title: 'Works for any guest',       desc: 'Supports 12 languages including Hindi, Arabic, Chinese, and Japanese. No guest left behind.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} style={{ display: 'flex', gap: 20, alignItems: 'flex-start', background: '#18181b', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 24 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={18} color="#818cf8" />
                </div>
                <div>
                  <h3 style={{ fontWeight: 700, color: '#fff', marginBottom: 6, fontSize: 15 }}>{title}</h3>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.65, margin: 0 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Integrations ── */}
      <section style={{ padding: '96px 0' }}>
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h2 style={{ fontSize: 'clamp(28px,4vw,40px)', fontWeight: 800, color: '#fff', marginBottom: 14, letterSpacing: '-0.02em' }}>Integrations</h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', marginBottom: 48 }}>Connects with the tools your hotel already uses.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { name: 'Opera PMS',        tag: 'PMS' },
              { name: 'Hotelogix',        tag: 'PMS' },
              { name: 'Google Translate', tag: 'AI' },
              { name: 'Anthropic Claude', tag: 'AI' },
            ].map(({ name, tag }) => (
              <div key={name} style={{ background: '#18181b', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '20px 16px', transition: 'border-color 0.2s' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.14)')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)')}
              >
                <div style={{ fontSize: 11, fontWeight: 600, color: '#818cf8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{tag}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>{name}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section style={{ background: '#111114', padding: '96px 24px', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <h2 style={{ fontSize: 'clamp(28px,4vw,40px)', fontWeight: 800, color: '#fff', marginBottom: 14, letterSpacing: '-0.02em' }}>
          Ready to upgrade your guest experience?
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.4)', marginBottom: 36, maxWidth: 400, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.65 }}>
          See StayFlow in action with a live demo tailored to your property.
        </p>
        <button onClick={goDemo} style={{ padding: '12px 28px', fontSize: 14, fontWeight: 600, borderRadius: 999, background: '#fff', color: '#09090b', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          onMouseEnter={e => ((e.target as HTMLElement).style.background = '#e5e7eb')}
          onMouseLeave={e => ((e.target as HTMLElement).style.background = '#fff')}
        >
          Book a Demo <ArrowRight size={14} />
        </button>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '28px 24px' }}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <span style={{ fontWeight: 700, color: '#fff' }}>StayFlow</span>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)' }}>&copy; {new Date().getFullYear()} StayFlow. Built in India.</span>
        </div>
      </footer>
    </div>
  )
}
