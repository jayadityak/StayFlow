import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'

/**
 * Subscribes to /api/events SSE stream for real-time staff dashboard updates.
 * Uses fetch-based streaming (not EventSource) to support Authorization headers.
 * Automatically reconnects on connection loss.
 *
 * Call this once in DashboardLayout to cover all staff pages.
 */
export function useSSEEvents() {
  const qc = useQueryClient()
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null

    const connect = async () => {
      const token = localStorage.getItem('token')
      if (!token) return

      abortRef.current = new AbortController()

      try {
        const response = await fetch('/api/events', {
          headers: { Authorization: `Bearer ${token}` },
          signal: abortRef.current.signal,
        })

        if (!response.ok || !response.body) return

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          // SSE blocks are delimited by double newlines
          const blocks = buffer.split('\n\n')
          buffer = blocks.pop() ?? ''

          for (const block of blocks) {
            const eventMatch = block.match(/^event:\s*(\w+)/m)
            if (!eventMatch) continue

            switch (eventMatch[1]) {
              case 'new_request':
                qc.invalidateQueries({ queryKey: ['requests'] })
                qc.invalidateQueries({ queryKey: ['rooms'] })
                qc.invalidateQueries({ queryKey: ['notifications'] })
                qc.invalidateQueries({ queryKey: ['staffboard'] })
                break
              case 'new_order':
                qc.invalidateQueries({ queryKey: ['orders'] })
                qc.invalidateQueries({ queryKey: ['rooms'] })
                qc.invalidateQueries({ queryKey: ['notifications'] })
                break
              case 'new_chat':
                qc.invalidateQueries({ queryKey: ['conversations'] })
                qc.invalidateQueries({ queryKey: ['rooms'] })
                qc.invalidateQueries({ queryKey: ['notifications'] })
                break
              case 'escalation':
                qc.invalidateQueries({ queryKey: ['conversations'] })
                qc.invalidateQueries({ queryKey: ['notifications'] })
                qc.invalidateQueries({ queryKey: ['rooms'] })
                break
              case 'message_created': {
                // Parse conversationId to refresh the specific thread + the chat list
                const dataMatch = block.match(/^data:\s*(.+)$/m)
                const payload = dataMatch ? JSON.parse(dataMatch[1]) : {}
                qc.invalidateQueries({ queryKey: ['chats'] })
                if (payload.conversationId) {
                  qc.invalidateQueries({ queryKey: ['chat', payload.conversationId] })
                }
                break
              }
            }
          }
        }
      } catch (err: any) {
        // Ignore abort errors (intentional disconnect on unmount)
        if (err?.name === 'AbortError') return
      }

      // Reconnect after 5s on unexpected disconnect
      if (!abortRef.current?.signal.aborted) {
        reconnectTimeout = setTimeout(connect, 5000)
      }
    }

    connect()

    return () => {
      abortRef.current?.abort()
      if (reconnectTimeout) clearTimeout(reconnectTimeout)
    }
  }, [qc])
}
