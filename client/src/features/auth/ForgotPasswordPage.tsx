import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/primitives'
import { Hotel, ArrowLeft, CheckCircle2 } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail]   = useState('')
  const [sent, setSent]     = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/forgot-password', { email })
      setSent(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4F6EF7] to-[#818CF8] flex items-center justify-center shadow-lg">
            <Hotel size={18} className="text-white" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border shadow-sm p-8">
          {sent ? (
            <div className="text-center">
              <CheckCircle2 size={40} className="text-green-500 mx-auto mb-3" />
              <h2 className="font-display text-lg font-semibold mb-2">Check your email</h2>
              <p className="text-sm text-muted-foreground mb-6">
                We sent a password reset link to <strong>{email}</strong>. It expires in 1 hour.
              </p>
              <Link to="/login" className="text-sm text-primary hover:underline">
                Back to login
              </Link>
            </div>
          ) : (
            <>
              <h1 className="font-display text-xl font-semibold mb-1">Forgot password?</h1>
              <p className="text-sm text-muted-foreground mb-6">
                Enter your email and we'll send you a reset link.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Email</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@hotel.com"
                    required
                    autoFocus
                  />
                </div>

                {error && <p className="text-sm text-red-500">{error}</p>}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Sending…' : 'Send reset link'}
                </Button>
              </form>

              <div className="mt-4 text-center">
                <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-1">
                  <ArrowLeft size={13} /> Back to login
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
