import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { useEffect } from 'react'
import {
  Hotel, QrCode, MessageSquare, BarChart3, ArrowRight,
  Zap, Shield, Globe, ChevronRight, Star,
  Bell, CheckCircle2, Clock, User, Bot,
} from 'lucide-react'

/* ─────────────────────────────────────────
   Mini dashboard mockup — pure CSS/HTML
───────────────────────────────────────── */
function DashboardMockup() {
  return (
    <div style={{
      width: '100%', maxWidth: 880,
      margin: '64px auto 0',
      borderRadius: 20,
      overflow: 'hidden',
      border: '1px solid #E2E8F0',
      boxShadow: '0 24px 64px rgba(79,110,247,0.13), 0 8px 24px rgba(0,0,0,0.08)',
      background: '#F1F5F9',
      position: 'relative',
    }}>
      {/* Browser chrome bar */}
      <div style={{
        background: '#F8FAFC',
        borderBottom: '1px solid #E2E8F0',
        padding: '10px 16px',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {['#FF5F57','#FEBC2E','#28C840'].map(c => (
            <div key={c} style={{ width: 11, height: 11, borderRadius: '50%', background: c }} />
          ))}
        </div>
        <div style={{
          flex: 1, marginLeft: 8, background: '#F1F5F9', border: '1px solid #E2E8F0',
          borderRadius: 6, padding: '4px 12px', fontSize: 11, color: '#94A3B8', textAlign: 'center',
        }}>
          app.stayflow.io/dashboard
        </div>
      </div>

      {/* Dashboard body */}
      <div style={{ display: 'flex', height: 400 }}>

        {/* Sidebar */}
        <div style={{
          width: 56, background: '#1E293B',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', paddingTop: 16, gap: 6, flexShrink: 0,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, #4F6EF7, #818CF8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 12,
          }}>
            <Hotel size={15} color="white" />
          </div>
          {[BarChart3, MessageSquare, Bell, QrCode, User].map((Icon, i) => (
            <div key={i} style={{
              width: 36, height: 36, borderRadius: 8,
              background: i === 1 ? 'rgba(79,110,247,0.25)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}>
              <Icon size={16} color={i === 1 ? '#818CF8' : '#64748B'} />
            </div>
          ))}
        </div>

        {/* Chat list panel */}
        <div style={{
          width: 200, background: 'white',
          borderRight: '1px solid #F1F5F9',
          display: 'flex', flexDirection: 'column', flexShrink: 0,
        }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #F1F5F9' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>Chats</div>
            <div style={{ display: 'flex', gap: 4 }}>
              <div style={{ flex: 1, background: '#0F172A', borderRadius: 6, padding: '4px 0', fontSize: 9.5, fontWeight: 600, color: 'white', textAlign: 'center' }}>Active (3)</div>
              <div style={{ flex: 1, background: '#F1F5F9', borderRadius: 6, padding: '4px 0', fontSize: 9.5, color: '#94A3B8', textAlign: 'center' }}>Past</div>
            </div>
          </div>
          {[
            { room: '103', name: 'Arjun K.', msg: 'Need extra towels', time: '2m', unread: 2, escalated: false },
            { room: '203', name: 'Sneha J.', msg: 'Room cleaning done?', time: '5m', unread: 0, escalated: true },
            { room: '302', name: 'Vikram N.', msg: 'Menu please', time: '12m', unread: 0, escalated: false },
          ].map((c, i) => (
            <div key={i} style={{
              padding: '10px 14px',
              borderBottom: '1px solid #F8FAFC',
              background: i === 0 ? '#F8FAFF' : 'white',
              borderLeft: i === 0 ? '2px solid #4F6EF7' : '2px solid transparent',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#0F172A' }}>{c.room}</span>
                  <span style={{ fontSize: 9.5, color: '#94A3B8' }}>· {c.name}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {c.escalated && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#F59E0B' }} />}
                  {c.unread > 0
                    ? <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: 'white', fontWeight: 700 }}>{c.unread}</div>
                    : <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E' }} />
                  }
                  <span style={{ fontSize: 9, color: '#CBD5E1' }}>{c.time}</span>
                </div>
              </div>
              <p style={{ fontSize: 10, color: '#64748B', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.msg}</p>
            </div>
          ))}
        </div>

        {/* Chat view */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F8FAFC' }}>
          {/* Chat header */}
          <div style={{
            background: 'white', borderBottom: '1px solid #F1F5F9',
            padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg, #4F6EF7, #818CF8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'white' }}>AK</span>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A' }}>Arjun Kapoor</div>
              <div style={{ fontSize: 10, color: '#94A3B8' }}>Room 103 · Deluxe Suite</div>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'hidden' }}>
            {[
              { sender: 'guest', text: 'Hello! I need extra towels please 🙏', time: '14:22' },
              { sender: 'bot', text: '📋 Your Housekeeping request has been received! A staff member will be with you shortly.', time: '14:22' },
              { sender: 'guest', text: 'Also can I get the menu?', time: '14:23' },
              { sender: 'bot', text: '🍽️ Here are our popular items:\n• Masala Dosa — ₹280\n• Club Sandwich — ₹320\n• Fresh Lime Soda — ₹120\n\nTap Order Food to place your order!', time: '14:23' },
            ].map((m, i) => (
              <div key={i} style={{ display: 'flex', gap: 7, justifyContent: m.sender === 'guest' ? 'flex-start' : 'flex-end' }}>
                {m.sender === 'guest' && (
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                    <User size={10} color="#64748B" />
                  </div>
                )}
                <div style={{
                  maxWidth: '72%', padding: '7px 11px',
                  borderRadius: m.sender === 'guest' ? '2px 12px 12px 12px' : '12px 2px 12px 12px',
                  background: m.sender === 'guest' ? 'white' : '#1E293B',
                  border: m.sender === 'guest' ? '1px solid #F1F5F9' : 'none',
                  fontSize: 10, color: m.sender === 'guest' ? '#0F172A' : 'white',
                  lineHeight: 1.5, whiteSpace: 'pre-line',
                }}>
                  {m.text}
                  <div style={{ fontSize: 8.5, opacity: 0.5, textAlign: 'right', marginTop: 3 }}>{m.time}</div>
                </div>
                {m.sender === 'bot' && (
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                    <Bot size={10} color="#D97706" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Reply input */}
          <div style={{
            background: 'white', borderTop: '1px solid #F1F5F9',
            padding: '10px 16px', display: 'flex', gap: 8, alignItems: 'center',
          }}>
            <div style={{ flex: 1, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '7px 12px', fontSize: 11, color: '#94A3B8' }}>
              Reply to guest…
            </div>
            <div style={{
              width: 30, height: 30, borderRadius: 8,
              background: 'linear-gradient(135deg, #4F6EF7, #6C8EFF)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ArrowRight size={13} color="white" />
            </div>
          </div>
        </div>

        {/* Stats sidebar */}
        <div style={{
          width: 168, background: 'white', borderLeft: '1px solid #F1F5F9',
          padding: '14px 14px', display: 'flex', flexDirection: 'column', gap: 12, flexShrink: 0,
        }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#0F172A', marginBottom: 2 }}>Today</div>
          {[
            { label: 'Active Guests', value: '12', color: '#4F6EF7' },
            { label: 'Open Requests', value: '5', color: '#F59E0B' },
            { label: 'Orders', value: '8', color: '#10B981' },
            { label: 'Escalations', value: '1', color: '#EF4444' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{
              background: '#F8FAFC', borderRadius: 10, padding: '10px 12px',
              border: '1px solid #F1F5F9',
            }}>
              <div style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1, marginBottom: 4 }}>{value}</div>
              <div style={{ fontSize: 9.5, color: '#94A3B8', lineHeight: 1.3 }}>{label}</div>
            </div>
          ))}
          {/* Mini bar chart */}
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 9.5, color: '#94A3B8', marginBottom: 8 }}>QR Scans · 7d</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 40 }}>
              {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                <div key={i} style={{
                  flex: 1, height: `${h}%`, borderRadius: '3px 3px 0 0',
                  background: i === 5 ? 'linear-gradient(to top, #4F6EF7, #818CF8)' : '#E2E8F0',
                }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────
   Main Landing Page
───────────────────────────────────────── */
export default function LandingPage() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (isAuthenticated) navigate('/app/overview')
  }, [isAuthenticated])

  return (
    <div style={{
      fontFamily: "'DM Sans', sans-serif",
      background: '#F8FAFC',
      color: '#0F172A',
      minHeight: '100vh',
      overflowX: 'hidden',
    }}>

      {/* ── HEADER ── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 56px', height: 68,
        background: 'rgba(248,250,252,0.92)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid #E2E8F0',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #4F6EF7 0%, #818CF8 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 10px rgba(79,110,247,0.32)',
          }}>
            <Hotel size={18} color="white" />
          </div>
          <span style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 20, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.3px',
          }}>
            StayFlow
          </span>
        </div>

        <nav style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => navigate('/login')}
            style={{
              padding: '8px 20px', borderRadius: 8, border: 'none',
              background: 'transparent', color: '#64748B',
              fontSize: 14, fontWeight: 500, cursor: 'pointer',
            }}
          >
            Log in
          </button>
          <button
            onClick={() => navigate('/signup')}
            style={{
              padding: '9px 22px', borderRadius: 9,
              background: 'linear-gradient(135deg, #4F6EF7, #6C8EFF)',
              color: 'white', fontSize: 14, fontWeight: 600,
              border: 'none', cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(79,110,247,0.30)',
            }}
          >
            Get started
          </button>
        </nav>
      </header>

      {/* ── HERO ── */}
      <section style={{
        position: 'relative',
        padding: '96px 56px 0',
        textAlign: 'center',
        overflow: 'hidden',
      }}>
        {/* Dot grid background */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(#CBD5E1 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          opacity: 0.45,
          pointerEvents: 'none',
        }} />
        {/* Radial fade over dot grid */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(248,250,252,0) 0%, #F8FAFC 75%)',
          pointerEvents: 'none',
        }} />
        {/* Color blobs */}
        <div style={{
          position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)',
          width: 1000, height: 500,
          background: 'radial-gradient(ellipse at center, rgba(79,110,247,0.09) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', maxWidth: 860, margin: '0 auto' }}>
          {/* Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(79,110,247,0.08)',
            border: '1px solid rgba(79,110,247,0.20)',
            color: '#4F6EF7', borderRadius: 100,
            padding: '7px 18px', fontSize: 13, fontWeight: 600,
            marginBottom: 36, letterSpacing: '0.01em',
          }}>
            <QrCode size={13} />
            QR-based in-stay guest services
          </div>

          {/* H1 */}
          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 66, fontWeight: 700, lineHeight: 1.07,
            letterSpacing: '-2.5px', color: '#0F172A',
            margin: '0 0 26px',
          }}>
            Modern hotel operations,<br />
            <span style={{
              background: 'linear-gradient(135deg, #4F6EF7 0%, #6366F1 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              zero friction
            </span>
          </h1>

          {/* Subtitle */}
          <p style={{
            fontSize: 19, color: '#64748B', lineHeight: 1.70,
            maxWidth: 540, margin: '0 auto 40px', fontWeight: 400,
          }}>
            Guests scan a QR code. They chat. They order. You handle it all
            from one clean dashboard. No app downloads. No complex setup.
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 40 }}>
            <button
              onClick={() => navigate('/signup')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 9,
                padding: '15px 34px', borderRadius: 11,
                background: 'linear-gradient(135deg, #4F6EF7, #6366F1)',
                color: 'white', fontSize: 15, fontWeight: 600,
                border: 'none', cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(79,110,247,0.36)',
              }}
            >
              Start for free <ArrowRight size={16} />
            </button>
            <button
              onClick={() => navigate('/login')}
              style={{
                padding: '15px 34px', borderRadius: 11,
                border: '1.5px solid #CBD5E1',
                background: 'white', color: '#374151',
                fontSize: 15, fontWeight: 600, cursor: 'pointer',
                boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
              }}
            >
              Demo login
            </button>
          </div>

          {/* Stars */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <div style={{ display: 'flex', gap: 3 }}>
              {[...Array(5)].map((_, i) => <Star key={i} size={15} fill="#FBBF24" color="#FBBF24" />)}
            </div>
            <span style={{ fontSize: 13.5, color: '#94A3B8', fontWeight: 500 }}>
              Loved by hotel operations teams
            </span>
          </div>
        </div>

        {/* Dashboard mockup — bleeds into next section */}
        <DashboardMockup />
      </section>

      {/* Separator gradient */}
      <div style={{ height: 80, background: 'linear-gradient(to bottom, #EEF2FF, #F8FAFC)' }} />

      {/* ── FEATURE CARDS ── */}
      <section style={{ maxWidth: 1120, margin: '0 auto', padding: '8px 56px 96px' }}>
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <h2 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 36, fontWeight: 700, color: '#0F172A',
            margin: '0 0 14px', letterSpacing: '-0.5px',
          }}>
            Everything your hotel needs
          </h2>
          <p style={{ fontSize: 16, color: '#64748B', maxWidth: 440, margin: '0 auto', lineHeight: 1.6 }}>
            One platform, every guest touchpoint. Designed to run quietly in the background.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
          {[
            {
              icon: QrCode, color: '#4F6EF7', bg: 'rgba(79,110,247,0.07)',
              title: 'Scan & Chat',
              desc: 'Guests scan a room QR, choose from 12 languages, and start chatting immediately. No app. No sign-up.',
            },
            {
              icon: MessageSquare, color: '#0EA5E9', bg: 'rgba(14,165,233,0.07)',
              title: 'Smart Requests',
              desc: 'Food, housekeeping, taxis, amenity bookings — all tracked and routed automatically to the right staff role.',
            },
            {
              icon: BarChart3, color: '#8B5CF6', bg: 'rgba(139,92,246,0.07)',
              title: 'Live Dashboard',
              desc: 'Front desk sees chats, requests, and orders in real-time with SSE-powered push. No refresh, ever.',
            },
          ].map(({ icon: Icon, color, bg, title, desc }) => (
            <div key={title} style={{
              background: 'white', border: '1px solid #E8EFFE',
              borderRadius: 18, padding: '32px 32px 36px',
              boxShadow: '0 2px 12px rgba(79,110,247,0.06)',
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 13,
                background: bg, display: 'flex',
                alignItems: 'center', justifyContent: 'center', marginBottom: 22,
              }}>
                <Icon size={23} color={color} />
              </div>
              <h3 style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: 19, fontWeight: 700, color: '#0F172A', marginBottom: 12,
              }}>
                {title}
              </h3>
              <p style={{ fontSize: 14.5, color: '#64748B', lineHeight: 1.68, margin: 0 }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{
        background: 'white',
        borderTop: '1px solid #E2E8F0',
        borderBottom: '1px solid #E2E8F0',
        padding: '88px 56px',
      }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <h2 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 38, fontWeight: 700, color: '#0F172A',
              margin: '0 0 16px', letterSpacing: '-0.5px',
            }}>
              Up and running in minutes
            </h2>
            <p style={{ fontSize: 16.5, color: '#64748B', maxWidth: 440, margin: '0 auto', lineHeight: 1.6 }}>
              No complex integrations. No staff training. Your team sees everything in one place.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 48 }}>
            {[
              { step: '01', icon: QrCode, title: 'Generate QR codes', desc: 'One QR code per room. Guests scan it from the desk card or door sticker.' },
              { step: '02', icon: MessageSquare, title: 'Guests chat in their language', desc: 'The assistant replies in 12 languages. Requests route to the right team automatically.' },
              { step: '03', icon: BarChart3, title: 'Staff manages everything', desc: 'Real-time dashboard for chats, requests, orders and escalations — one view.' },
            ].map(({ step, icon: Icon, title, desc }) => (
              <div key={step} style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                <div style={{ flexShrink: 0, marginTop: 2 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: 'linear-gradient(135deg, #4F6EF7, #818CF8)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 3px 10px rgba(79,110,247,0.28)',
                  }}>
                    <Icon size={20} color="white" />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 800, color: '#4F6EF7', letterSpacing: '0.12em', marginBottom: 8 }}>
                    STEP {step}
                  </div>
                  <h4 style={{ fontSize: 15.5, fontWeight: 700, color: '#0F172A', margin: '0 0 10px' }}>{title}</h4>
                  <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.65, margin: 0 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PERKS STRIP ── */}
      <section style={{ maxWidth: 1120, margin: '0 auto', padding: '80px 56px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {[
            { icon: Zap, color: '#F59E0B', bg: '#FFFBEB', border: 'rgba(245,158,11,0.15)', label: 'Real-time SSE', sub: 'Instant push, no polling lag' },
            { icon: Globe, color: '#0EA5E9', bg: '#F0F9FF', border: 'rgba(14,165,233,0.15)', label: '12 Languages', sub: 'Arabic RTL, Hindi, Chinese & 9 more' },
            { icon: Shield, color: '#10B981', bg: '#ECFDF5', border: 'rgba(16,185,129,0.15)', label: 'Multi-tenant', sub: 'Every hotel fully isolated' },
          ].map(({ icon: Icon, color, bg, border, label, sub }) => (
            <div key={label} style={{
              display: 'flex', alignItems: 'center', gap: 18,
              background: 'white', border: `1px solid ${border}`,
              borderRadius: 14, padding: '22px 26px',
              boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
            }}>
              <div style={{ width: 44, height: 44, borderRadius: 11, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={21} color={color} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 13, color: '#94A3B8', lineHeight: 1.4 }}>{sub}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── DEMO CTA ── */}
      <section style={{
        borderTop: '1px solid #E2E8F0',
        padding: '96px 56px',
        textAlign: 'center',
        background: 'linear-gradient(175deg, #F8FAFC 0%, #EEF2FF 100%)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', bottom: -120, left: '50%', transform: 'translateX(-50%)',
          width: 900, height: 500,
          background: 'radial-gradient(ellipse, rgba(79,110,247,0.07) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', maxWidth: 520, margin: '0 auto' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            background: 'rgba(79,110,247,0.08)', border: '1px solid rgba(79,110,247,0.18)',
            color: '#4F6EF7', borderRadius: 100, padding: '6px 16px',
            fontSize: 12.5, fontWeight: 600, marginBottom: 24,
          }}>
            <CheckCircle2 size={12} /> Free to try · No credit card
          </div>

          <h2 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 40, fontWeight: 700, color: '#0F172A',
            margin: '0 0 14px', letterSpacing: '-0.6px',
          }}>
            Try the demo right now
          </h2>
          <p style={{ fontSize: 16, color: '#64748B', margin: '0 0 36px', lineHeight: 1.6 }}>
            Log in with demo credentials to explore the full staff dashboard.
          </p>

          <div style={{
            background: 'white', border: '1px solid #E2E8F0', borderRadius: 14,
            padding: '24px 32px', display: 'inline-block', marginBottom: 32,
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)', textAlign: 'left', minWidth: 320,
          }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: '#CBD5E1', letterSpacing: '0.12em', marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid #F1F5F9' }}>
              DEMO CREDENTIALS
            </div>
            {[
              { label: 'Email', value: 'admin@royalpalm.com' },
              { label: 'Password', value: 'admin123' },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: '#94A3B8', width: 58, flexShrink: 0 }}>{label}</span>
                <code style={{
                  fontSize: 13.5, color: '#0F172A', fontWeight: 500,
                  background: '#F8FAFC', border: '1px solid #E2E8F0',
                  padding: '3px 10px', borderRadius: 6, fontFamily: 'monospace',
                }}>
                  {value}
                </code>
              </div>
            ))}
          </div>

          <div>
            <button
              onClick={() => navigate('/login')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 9,
                padding: '14px 32px', borderRadius: 11,
                background: 'linear-gradient(135deg, #4F6EF7, #6366F1)',
                color: 'white', fontSize: 15, fontWeight: 600,
                border: 'none', cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(79,110,247,0.32)',
              }}
            >
              Open dashboard <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{
        borderTop: '1px solid #E2E8F0', padding: '24px 56px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#F8FAFC',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: 'linear-gradient(135deg, #4F6EF7, #818CF8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 1px 6px rgba(79,110,247,0.25)',
          }}>
            <Hotel size={14} color="white" />
          </div>
          <span style={{ fontSize: 14.5, fontWeight: 700, color: '#0F172A' }}>StayFlow</span>
        </div>
        <span style={{ fontSize: 13, color: '#94A3B8' }}>© 2026 StayFlow. Built for modern hotels.</span>
      </footer>

    </div>
  )
}
