import { useState } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/primitives'
import { Hotel, CheckCircle2, XCircle } from 'lucide-react'

export default function ResetPasswordPage() {
  const [params]       = useSearchParams()
  const navigate       = useNavigate()
  const token          = params.get('token') || ''

  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [loading, setLoading]     = useState(false)
  const [done, setDone]           = useState(false)
  const [error, setError]         = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 6)  { setError('Password must be at least 6 characters'); return }
    setLoading(true)
    try {
      await api.post('/auth/reset-password', { token, password })
      setDone(true)
      setTimeout(() => navigate('/login'), 2500)
    } catch (err: any) {
      setError(err.message || 'Invalid or expired link. Please request a new one.')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <XCircle size={40} className="text-red-500 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Invalid reset link.</p>
          <Link to="/forgot-password" className="text-sm text-primary hover:underline mt-2 block">
            Request a new one
          </Link>
        </div>
      </div>
    )
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
          {done ? (
            <div className="text-center">
              <CheckCircle2 size={40} className="text-green-500 mx-auto mb-3" />
              <h2 className="font-display text-lg font-semibold mb-2">Password updated</h2>
              <p className="text-sm text-muted-foreground">Redirecting you to login…</p>
            </div>
          ) : (
            <>
              <h1 className="font-display text-xl font-semibold mb-1">Set new password</h1>
              <p className="text-sm text-muted-foreground mb-6">Choose a strong password.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">New password</label>
                  <Input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    required autoFocus
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Confirm password</label>
                  <Input
                    type="password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Same password again"
                    required
                  />
                </div>

                {error && <p className="text-sm text-red-500">{error}</p>}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Updating…' : 'Update password'}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
