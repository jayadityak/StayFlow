import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import api, { setToken, clearToken } from '@/lib/api'

interface User {
  id: string
  name: string
  email: string
  role: string
}

interface Hotel {
  id: string
  name: string
  slug: string
}

interface AuthContextType {
  user: User | null
  hotel: Hotel | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('stayflow_user')
    return saved ? JSON.parse(saved) : null
  })
  const [hotel, setHotel] = useState<Hotel | null>(() => {
    const saved = localStorage.getItem('stayflow_hotel')
    return saved ? JSON.parse(saved) : null
  })
  const [isLoading, setIsLoading] = useState(false)

  const login = async (email: string, password: string) => {
    const data = await api.post<{ token: string; user: User; hotel: Hotel }>(
      '/auth/login',
      { email, password }
    )
    setToken(data.token)
    setUser(data.user)
    setHotel(data.hotel)
    localStorage.setItem('stayflow_user', JSON.stringify(data.user))
    localStorage.setItem('stayflow_hotel', JSON.stringify(data.hotel))
  }

  const logout = () => {
    clearToken()
    setUser(null)
    setHotel(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        hotel,
        isLoading,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
