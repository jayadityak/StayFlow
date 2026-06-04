import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { useEffect } from 'react'
import {
  QrCode, MessageSquare, BarChart3, Globe, Bot,
  Bell, Shield, Sparkles, ArrowRight, CheckCircle2,
} from 'lucide-react'

// ── Scrolling hotel name ticker ────────────────────────────────────────────
const HOTEL_NAMES = [
  'Marriott', 'Hyatt', 'Hilton', 'ITC Hotels', 'Taj Hotels',
  'Oberoi', 'Leela', 'Radisson', 'Novotel', 'Le Méridien',
  'Sheraton', 'Westin', 'Four Points', 'Courtyard', 'Renaissance',
]

function LogoTicker() {
  const repeated = [...HOTEL_NAMES, ...HOTEL_NAMES]
  return (
    <div className="w-full overflow-hidden border-y border-gray-100 py-5 bg-gray-50/60">
      <div className="flex animate-ticker whitespace-nowrap">
        {repeated.map((name, i) => (
          <span
            key={i}
            className="mx-10 text-sm font-semibold text-gray-400 tracking-wide uppercase shrink-0"
          >
            {name}
          </span>
        ))}
      </div>
      <style>{`
        @keyframes ticker {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .animate-ticker {
          animation: ticker 30s linear infinite;
        }
        .animate-ticker:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  )
}

// ── Mock chat preview card ─────────────────────────────────────────────────
function ChatPreview() {
  return (
    <div className="w-full max-w-sm mx-auto bg-white rounded-3xl shadow-2xl shadow-gray-200/80 border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="bg-[#0F172A] px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-[#4F6EF7] flex items-center justify-center">
          <Bot size={15} className="text-white" />
        </div>
        <div>
          <p className="text-white text-xs font-semibold">Royal Palm Suites</p>
          <p className="text-white/50 text-[10px]">Room 203 · AI Concierge</p>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
          <span className="text-[10px] text-white/40">Online</span>
        </div>
      </div>

      {/* Messages */}
      <div className="p-4 space-y-3 bg-gray-50/50">
        {/* Guest */}
        <div className="flex justify-end">
          <div className="bg-[#0F172A] text-white text-xs px-3 py-2 rounded-2xl rounded-br-sm max-w-[75%]">
            I'd like 2 butter chickens and a mango lassi 🙏
          </div>
        </div>
        {/* AI */}
        <div className="flex gap-2">
          <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
            <Bot size={11} className="text-amber-700" />
          </div>
          <div className="bg-white border text-xs px-3 py-2 rounded-2xl rounded-bl-sm shadow-sm max-w-[80%] text-gray-800">
            Order placed! 🎉<br />
            <span className="text-gray-500">Butter Chicken ×2 — ₹1,440<br />Mango Lassi ×1 — ₹180</span><br />
            <span className="font-semibold">Total: ₹1,620 · 30–45 min</span>
          </div>
        </div>
        {/* Guest */}
        <div className="flex justify-end">
          <div className="bg-[#0F172A] text-white text-xs px-3 py-2 rounded-2xl rounded-br-sm max-w-[75%]">
            Also need extra towels please
          </div>
        </div>
        {/* AI */}
        <div className="flex gap-2">
          <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
            <Bot size={11} className="text-amber-700" />
          </div>
          <div className="bg-white border text-xs px-3 py-2 rounded-2xl rounded-bl-sm shadow-sm max-w-[80%] text-gray-800">
            Done! Housekeeping will bring extra towels to Room 203 within 15 minutes.
          </div>
        </div>
      </div>

      {/* Input bar */}
      <div className="px-4 py-3 border-t bg-white flex items-center gap-2">
        <div className="flex-1 bg-gray-100 rounded-full px-3 py-1.5 text-xs text-gray-400">
          Message hotel…
        </div>
        <div className="w-7 h-7 rounded-full bg-[#0F172A] flex items-center justify-center">
          <ArrowRight size={12} className="text-white" />
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
    <div className="min-h-screen bg-white text-gray-900 overflow-x-hidden">

      {/* ── Nav ──────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <span className="text-xl font-bold tracking-tight text-gray-900">StayFlow</span>
          <div className="flex items-center gap-3">
            <button
              onClick={goDemo}
              className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              Login
            </button>
            <button
              onClick={goDemo}
              className="px-5 py-2 text-sm font-semibold rounded-full bg-gray-900 text-white hover:bg-gray-700 transition-colors"
            >
              Book a Demo
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">

          {/* Left — copy */}
          <div className="flex-1 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 text-xs font-medium rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
              AI-Powered Hotel Guest Experience
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-[64px] font-extrabold leading-[1.06] tracking-tight text-gray-900">
              The smarter way<br />
              to run a{' '}
              <span className="text-[#4F6EF7]">hotel.</span>
            </h1>

            <p className="mt-6 text-lg text-gray-500 max-w-lg leading-relaxed">
              One QR scan gives guests an AI concierge that handles room service,
              housekeeping, and requests — in 12 languages, around the clock.
            </p>

            <div className="mt-8 flex items-center gap-3 justify-center lg:justify-start">
              <button
                onClick={goDemo}
                className="px-7 py-3 text-sm font-semibold rounded-full bg-gray-900 text-white hover:bg-gray-700 transition-colors"
              >
                Book a Demo
              </button>
              <button
                onClick={goDemo}
                className="px-7 py-3 text-sm font-semibold rounded-full border border-gray-200 text-gray-700 hover:border-gray-400 transition-colors"
              >
                See it Live →
              </button>
            </div>

            {/* Trust line */}
            <div className="mt-8 flex items-center gap-4 justify-center lg:justify-start">
              {['No app download', '12 languages', 'Setup in 1 day'].map(item => (
                <div key={item} className="flex items-center gap-1.5 text-xs text-gray-400">
                  <CheckCircle2 size={12} className="text-green-500 shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Right — chat preview */}
          <div className="flex-shrink-0 w-full max-w-xs lg:max-w-sm">
            <ChatPreview />
          </div>
        </div>
      </section>

      {/* ── Logo ticker ───────────────────────────────────────────── */}
      <div className="mb-2">
        <p className="text-center text-xs text-gray-400 uppercase tracking-widest mb-4">
          Built for hotels like
        </p>
        <LogoTicker />
      </div>

      {/* ── Stats strip ───────────────────────────────────────────── */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center px-6">
          {[
            ['12', 'Languages supported'],
            ['< 2s', 'AI response time'],
            ['85%', 'Requests automated'],
            ['24/7', 'Always available'],
          ].map(([stat, label]) => (
            <div key={label}>
              <div className="text-4xl font-extrabold text-gray-900 tracking-tight">{stat}</div>
              <div className="text-sm text-gray-400 mt-1.5">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────── */}
      <section className="bg-gray-50 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">
              Everything your hotel needs
            </h2>
            <p className="text-gray-500 max-w-lg mx-auto">
              Replace paper menus, phone calls, and WhatsApp chaos with one intelligent platform.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: QrCode,        title: 'QR Check-In',          desc: 'Guests scan a room QR — no app, no login, no friction. Works in seconds.' },
              { icon: Bot,           title: 'AI Concierge',          desc: 'Powered by Claude. Handles orders, FAQs, requests, and escalations naturally.' },
              { icon: Globe,         title: '12 Languages',          desc: 'Real-time Google Translate. Guests chat in Hindi, Japanese, Arabic — staff always see English.' },
              { icon: MessageSquare, title: 'Live Staff Chat',       desc: 'Staff jump into any conversation. Seamless AI-to-human handoff, built in.' },
              { icon: Bell,          title: 'Smart Notifications',   desc: 'New orders, escalations, and requests — real-time alerts to the right staff.' },
              { icon: BarChart3,     title: 'Insights & Analytics',  desc: 'QR scans, popular items, request patterns. Know your property better.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-md hover:border-gray-200 transition-all duration-200 group"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center mb-4 group-hover:bg-indigo-100 transition-colors">
                  <Icon className="w-5 h-5 text-[#4F6EF7]" />
                </div>
                <h3 className="font-bold text-gray-900 mb-1.5">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────── */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">
            Live in under a day
          </h2>
          <p className="text-gray-500 mb-16 max-w-md mx-auto">
            No complex setup. Print a QR code, place it in the room, and you're running.
          </p>

          <div className="grid sm:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Print QR codes', desc: 'Generate a unique QR for each room from your dashboard. Print and place.' },
              { step: '02', title: 'Guests scan & chat', desc: 'Guests scan on arrival. Pick their language, enter their name, start chatting instantly.' },
              { step: '03', title: 'Staff get notified', desc: 'Orders, requests, and escalations appear in real-time on the staff dashboard.' },
            ].map(({ step, title, desc }) => (
              <div key={step} className="text-left">
                <div className="text-5xl font-black text-gray-100 mb-3">{step}</div>
                <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why StayFlow ──────────────────────────────────────────── */}
      <section className="bg-gray-50 py-24">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 text-center mb-16">
            Why hotels choose StayFlow
          </h2>
          <div className="space-y-8">
            {[
              { icon: Sparkles, title: 'Zero friction for guests',   desc: 'No app install, no OTP, no account. One QR scan and they\'re chatting with your AI concierge in their language.' },
              { icon: Shield,   title: 'Staff always in control',    desc: 'Every AI response is grounded in your hotel\'s own data. Staff can override, escalate, or jump in anytime.' },
              { icon: Globe,    title: 'Works for any guest',        desc: 'Supports 12 languages including Hindi, Arabic, Chinese, and Japanese. No guest left behind.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex gap-5 items-start bg-white rounded-2xl border border-gray-100 p-6">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-[#4F6EF7]" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">{title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Integrations ──────────────────────────────────────────── */}
      <section className="py-24">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">
            Integrations
          </h2>
          <p className="text-gray-500 mb-12">Connects with the tools your hotel already uses.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { name: 'Opera PMS',        tag: 'PMS' },
              { name: 'Hotelogix',        tag: 'PMS' },
              { name: 'Google Translate', tag: 'AI' },
              { name: 'Anthropic Claude', tag: 'AI' },
            ].map(({ name, tag }) => (
              <div
                key={name}
                className="rounded-2xl border border-gray-100 bg-gray-50 py-5 px-4 hover:border-gray-200 hover:bg-white transition-all duration-200"
              >
                <div className="text-xs font-medium text-indigo-500 mb-1">{tag}</div>
                <div className="text-sm font-semibold text-gray-700">{name}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────── */}
      <section className="bg-gray-900 py-24 text-center px-6">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
          Ready to upgrade your guest experience?
        </h2>
        <p className="text-gray-400 mb-10 max-w-md mx-auto">
          See StayFlow in action with a live demo tailored to your property.
        </p>
        <button
          onClick={goDemo}
          className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-white text-gray-900 font-semibold hover:bg-gray-100 transition-colors"
        >
          Book a Demo <ArrowRight className="w-4 h-4" />
        </button>
      </section>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="font-bold text-gray-900">StayFlow</span>
          <span className="text-sm text-gray-400">&copy; {new Date().getFullYear()} StayFlow. Built in India.</span>
        </div>
      </footer>
    </div>
  )
}
