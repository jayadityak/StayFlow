const API_BASE = '/api'

function getToken() {
  return localStorage.getItem('stayflow_token')
}

export function setToken(token: string) {
  localStorage.setItem('stayflow_token', token)
}

export function clearToken() {
  localStorage.removeItem('stayflow_token')
  localStorage.removeItem('stayflow_user')
  localStorage.removeItem('stayflow_hotel')
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>
): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extraHeaders,
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(err.error || 'Request failed')
  }

  return res.json()
}

export const api = {
  get: <T>(path: string, extraHeaders?: Record<string, string>) =>
    request<T>('GET', path, undefined, extraHeaders),
  post: <T>(path: string, body: unknown, extraHeaders?: Record<string, string>) =>
    request<T>('POST', path, body, extraHeaders),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
}

export default api
