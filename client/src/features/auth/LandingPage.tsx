import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { useEffect } from 'react'
import {
  QrCode, MessageSquare, BarChart3, Globe, Bot,
  Bell, Wifi, Shield, Sparkles, ArrowRight,
} from 'lucide-react'

export default function LandingPage() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true })
  }, [isAuthenticated, navigate])

  const goDemo = () => navigate('/login')

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-white overflow-x-hidden">
      {/* Dot-grid background */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Gradient orb */}
      <div className="pointer-events-none fixed top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-gradient-to-br from-indigo-600/20 via-purple-500/10 to-transparent blur-3xl" />

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-[#0e0e0e]/80 border-b border-white/5">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <span className="text-xl font-bold tracking-tight">StayFlow</span>
          <button
            onClick={goDemo}
            className="px-5 py-2 text-sm rounded-full border border-white/20 hover:bg-white hover:text-black transition-all duration-200"
          >
            Book a Demo
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative max-w-4xl mx-auto text-center px-6 pt-28 pb-20">
        <div className="inline-block mb-6 px-4 py-1.5 text-xs tracking-widest uppercase rounded-full border border-white/10 text-white/50">
          AI-Powered Hotel Guest Experience
        </div>
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold leading-[1.08] tracking-tight">
          Your guests deserve
          <br />
          <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            a smarter stay
          </span>
        </h1>
        <p className="mt-6 text-lg text-white/50 max-w-xl mx-auto leading-relaxed">
          One QR scan connects guests to an AI concierge that handles room service,
          housekeeping, requests, and more — in 12 languages.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <button
            onClick={goDemo}
            className="px-8 py-3 rounded-full bg-white text-black font-semibold hover:bg-white/90 transition-all duration-200"
          >
            Book a Demo
          </button>
          <button
            onClick={goDemo}
            className="px-8 py-3 rounded-full border border-white/20 font-semibold hover:bg-white hover:text-black transition-all duration-200"
          >
            See it Live
          </button>
        </div>
      </section>

      {/* ── Stats strip ── */}
      <section className="border-y border-white/5 py-10">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center px-6">
          {[
            ['12', 'Languages supported'],
            ['< 2s', 'AI response time'],
            ['85%', 'Requests automated'],
            ['24/7', 'Always available'],
          ].map(([stat, label]) => (
            <div key={label}>
              <div className="text-3xl font-bold">{stat}</div>
              <div className="text-sm text-white/40 mt-1">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">Everything your front desk needs</h2>
        <p className="text-center text-white/40 mb-16 max-w-lg mx-auto">
          Replace paper menus, phone calls, and WhatsApp chaos with one intelligent system.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: QrCode, title: 'QR Check-In', desc: 'Guests scan a room QR code — no app download, no login friction.' },
            { icon: Bot, title: 'AI Concierge', desc: 'Powered by Claude. Handles orders, FAQs, requests, and escalations.' },
            { icon: Globe, title: '12 Languages', desc: 'Real-time Google Translate. Guests chat in their language, staff see English.' },
            { icon: MessageSquare, title: 'Live Chat', desc: 'Staff can jump into any conversation. AI + human handoff built in.' },
            { icon: Bell, title: 'Smart Notifications', desc: 'Escalations, new orders, and requests — all in one real-time feed.' },
            { icon: BarChart3, title: 'Analytics', desc: 'QR scans, popular items, request patterns — actionable insights.' },
          ].map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="group rounded-2xl border border-white/5 bg-white/[0.02] p-6 hover:border-white/10 hover:bg-white/[0.04] transition-all duration-300"
            >
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center mb-4 group-hover:bg-white/10 transition-colors">
                <Icon className="w-5 h-5 text-white/60" />
              </div>
              <h3 className="font-semibold text-lg mb-2">{title}</h3>
              <p className="text-sm text-white/40 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Why StayFlow ── */}
      <section className="border-t border-white/5 py-24">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-16">Why hotels choose StayFlow</h2>
          <div className="space-y-10">
            {[
              { icon: Sparkles, title: 'Zero friction for guests', desc: 'No app install, no sign-up. One QR scan and they are chatting with your AI concierge.' },
              { icon: Shield, title: 'Staff stay in control', desc: 'Every AI response is grounded in your hotel data. Staff can intervene anytime.' },
              { icon: Wifi, title: 'Works on any device', desc: 'Mobile-first responsive design. Works on the oldest Android to the newest iPhone.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex gap-5 items-start">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-5 h-5 text-white/60" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{title}</h3>
                  <p className="text-white/40 mt-1 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Integrations ── */}
      <section className="border-t border-white/5 py-24">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Integrations</h2>
          <p className="text-white/40 mb-12">Connects with the tools your hotel already uses.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {['Opera PMS', 'Google Translate', 'Anthropic Claude', 'WhatsApp (soon)'].map((name) => (
              <div
                key={name}
                className="rounded-xl border border-white/5 bg-white/[0.02] py-5 px-4 text-sm text-white/50 hover:border-white/10 transition-colors"
              >
                {name}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 text-center px-6">
        <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to upgrade your guest experience?</h2>
        <p className="text-white/40 mb-10 max-w-md mx-auto">
          See StayFlow in action with a live demo tailored to your property.
        </p>
        <button
          onClick={goDemo}
          className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-white text-black font-semibold hover:bg-white/90 transition-all duration-200"
        >
          Book a Demo <ArrowRight className="w-4 h-4" />
        </button>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm text-white/30">&copy; {new Date().getFullYear()} StayFlow. All rights reserved.</span>
          <span className="text-sm text-white/30">Built in India</span>
        </div>
      </footer>
    </div>
  )
}
