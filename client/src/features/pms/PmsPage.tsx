import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import {
  RefreshCw, Wifi, WifiOff, Users, ArrowDownToLine,
  ArrowUpFromLine, Clock, Star, MessageSquare, ChevronDown, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────
// These mirror the PmsReservation interface on the server (server/src/pms/types.ts)
interface Reservation {
  confirmationNumber: string
  guestFirstName: string
  guestLastName: string
  email: string
  phone?: string
  roomNumber: string
  roomType: string
  arrivalDate: string
  departureDate: string
  status: 'RESERVED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW'
  adults: number
  children: number
  rateCode?: string
  rateAmount?: number
  vipStatus?: string
  specialRequests?: string
}

interface PmsStatus {
  connected: boolean
  provider: string | null
  message: string
  lastSyncAt: string | null
}

interface SyncResult {
  created: number
  updated: number
  errors: string[]
}

// ── Tab definition ──────────────────────────────────────────────────────────
type Tab = 'in-house' | 'arrivals' | 'departures'

const TABS: { id: Tab; label: string; icon: React.ElementType; endpoint: string }[] = [
  { id: 'in-house',   label: 'In-House',   icon: Users,           endpoint: '/pms/in-house' },
  { id: 'arrivals',   label: 'Arrivals',   icon: ArrowDownToLine, endpoint: '/pms/arrivals' },
  { id: 'departures', label: 'Departures', icon: ArrowUpFromLine, endpoint: '/pms/departures' },
]

// ── Status badge colours ────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, string> = {
  CHECKED_IN:  'bg-green-50 text-green-700 border-green-200',
  RESERVED:    'bg-blue-50 text-blue-700 border-blue-200',
  CHECKED_OUT: 'bg-gray-100 text-gray-600 border-gray-200',
  CANCELLED:   'bg-red-50 text-red-600 border-red-200',
  NO_SHOW:     'bg-amber-50 text-amber-700 border-amber-200',
}

// ── Single reservation row (collapsible for special requests / VIP notes) ──
function ReservationRow({ r }: { r: Reservation }) {
  const [expanded, setExpanded] = useState(false)
  const hasExtra = r.specialRequests || r.vipStatus || r.phone

  return (
    <>
      <tr
        className={cn(
          'border-b last:border-0 transition-colors',
          hasExtra ? 'cursor-pointer hover:bg-muted/40' : 'hover:bg-muted/20',
        )}
        onClick={() => hasExtra && setExpanded(p => !p)}
      >
        {/* Confirmation # */}
        <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
          {r.confirmationNumber}
        </td>

        {/* Guest name + VIP badge */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">
              {r.guestFirstName} {r.guestLastName}
            </span>
            {r.vipStatus && (
              <span className="flex items-center gap-0.5 text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-1.5 py-0.5">
                <Star size={9} className="fill-amber-500 text-amber-500" />
                {r.vipStatus}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">{r.email}</div>
        </td>

        {/* Room */}
        <td className="px-4 py-3 text-sm font-semibold">{r.roomNumber}</td>

        {/* Dates */}
        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
          {format(new Date(r.arrivalDate), 'dd MMM')} → {format(new Date(r.departureDate), 'dd MMM')}
        </td>

        {/* Guests */}
        <td className="px-4 py-3 text-xs text-muted-foreground">
          {r.adults}A {r.children > 0 ? `${r.children}C` : ''}
        </td>

        {/* Status */}
        <td className="px-4 py-3">
          <span className={cn(
            'text-xs border rounded-full px-2 py-0.5',
            STATUS_STYLES[r.status] ?? 'bg-gray-100 text-gray-600',
          )}>
            {r.status.replace('_', ' ')}
          </span>
        </td>

        {/* Expand toggle */}
        <td className="px-4 py-3 text-muted-foreground">
          {hasExtra && (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
        </td>
      </tr>

      {/* Expanded detail row — shows special requests, VIP note, phone */}
      {expanded && hasExtra && (
        <tr className="bg-muted/30 border-b">
          <td colSpan={7} className="px-6 py-3 text-xs space-y-1">
            {r.phone && (
              <div className="text-muted-foreground">
                <span className="font-medium text-foreground">Phone:</span> {r.phone}
              </div>
            )}
            {r.specialRequests && (
              <div className="flex items-start gap-1.5 text-amber-700">
                <MessageSquare size={11} className="mt-0.5 flex-shrink-0" />
                <span>{r.specialRequests}</span>
              </div>
            )}
            {r.rateCode && (
              <div className="text-muted-foreground">
                <span className="font-medium text-foreground">Rate:</span> {r.rateCode}
                {r.rateAmount ? ` — ₹${r.rateAmount.toLocaleString('en-IN')}/night` : ''}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function PmsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('in-house')
  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const queryClient = useQueryClient()

  // ── Fetch PMS connection status ──────────────────────────────────
  // Hits GET /api/pms/status — returns connected, provider name, last sync time
  const { data: status } = useQuery<PmsStatus>({
    queryKey: ['pms-status'],
    queryFn: () => api.get('/pms/status'),
    refetchInterval: 30000, // Recheck connection every 30 seconds
  })

  // ── Fetch reservations for the active tab ────────────────────────
  // Arrivals/departures include a date param; in-house does not
  const currentTab = TABS.find(t => t.id === activeTab)!
  const endpoint = activeTab === 'in-house'
    ? currentTab.endpoint
    : `${currentTab.endpoint}?date=${date}`

  const { data: reservations = [], isLoading } = useQuery<Reservation[]>({
    queryKey: ['pms', activeTab, activeTab !== 'in-house' ? date : null],
    queryFn: () => api.get(endpoint),
    enabled: !!status?.connected, // Only fetch if PMS is connected
  })

  // ── Sync mutation ────────────────────────────────────────────────
  // Calls POST /api/pms/sync/reservations (admin only)
  // Pulls in-house guests from PMS and upserts GuestSession records
  const { mutate: syncNow, isPending: syncing } = useMutation<SyncResult>({
    mutationFn: () => api.post('/pms/sync/reservations', {}),
    onSuccess: (result) => {
      // Refresh all PMS data after sync
      queryClient.invalidateQueries({ queryKey: ['pms'] })
      queryClient.invalidateQueries({ queryKey: ['pms-status'] })
      alert(`Sync complete — ${result.created} created, ${result.updated} updated${result.errors.length ? `\n\nErrors:\n${result.errors.join('\n')}` : ''}`)
    },
    onError: () => alert('Sync failed. Check server logs.'),
  })

  return (
    <div className="p-6 space-y-6">

      {/* ── Page header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">PMS Integration</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live reservation data from your Property Management System
          </p>
        </div>

        {/* Sync button — only makes sense when a PMS is connected */}
        {status?.connected && (
          <Button
            onClick={() => syncNow()}
            disabled={syncing}
            className="gap-2"
          >
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing…' : 'Sync Now'}
          </Button>
        )}
      </div>

      {/* ── Connection status card ───────────────────────────────── */}
      {/*
        This card shows whether StayFlow is connected to a PMS.
        Green = live connection (Hotelogix/Opera/etc.)
        Gray  = no PMS configured (using mock data or manual mode)
        The "Sync" button triggers syncReservations() which upserts
        guest sessions from PMS data into our database.
      */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center',
                status?.connected ? 'bg-green-50' : 'bg-gray-100',
              )}>
                {status?.connected
                  ? <Wifi size={18} className="text-green-600" />
                  : <WifiOff size={18} className="text-gray-400" />
                }
              </div>
              <div>
                <p className="font-medium text-sm">
                  {status?.connected
                    ? `Connected — ${status.provider}`
                    : 'No PMS Connected'
                  }
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {status?.message ?? 'Checking connection…'}
                </p>
              </div>
            </div>

            {/* Last sync time */}
            {status?.lastSyncAt && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock size={12} />
                Last sync: {format(new Date(status.lastSyncAt), 'dd MMM, HH:mm')}
              </div>
            )}
          </div>

          {/* Show setup instructions when no PMS is connected */}
          {!status?.connected && (
            <div className="mt-4 bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-800">
              <p className="font-medium mb-1">How to connect a PMS:</p>
              <ol className="list-decimal list-inside space-y-0.5 text-blue-700">
                <li>Contact Hotelogix at developer@hotelogix.com for API credentials</li>
                <li>Add HOTELOGIX_CONSUMER_SECRET and HOTELOGIX_ACCESS_SECRET to your .env</li>
                <li>Create a PmsConnection row in the DB with provider='hotelogix'</li>
                <li>Restart the server — it will auto-initialize the provider</li>
              </ol>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Tabs + date picker ───────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'bg-white text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <tab.icon size={14} />
              {tab.label}
              {/* Show count badge */}
              {!isLoading && (
                <span className={cn(
                  'text-xs rounded-full px-1.5 min-w-[18px] text-center',
                  activeTab === tab.id ? 'bg-primary/10 text-primary' : 'bg-muted-foreground/10',
                )}>
                  {reservations.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Date picker — only shown for arrivals and departures */}
        {activeTab !== 'in-house' && (
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="h-8 text-sm border rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-ring"
          />
        )}
      </div>

      {/* ── Reservations table ───────────────────────────────────── */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            // Loading skeleton
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : !status?.connected ? (
            // No PMS connected
            <div className="p-12 text-center">
              <WifiOff size={32} className="text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No PMS connected</p>
              <p className="text-xs text-muted-foreground mt-1">
                Connect a PMS to see live reservation data here
              </p>
            </div>
          ) : reservations.length === 0 ? (
            // Connected but no data
            <div className="p-12 text-center">
              <Users size={32} className="text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                No {activeTab === 'in-house' ? 'in-house guests' : activeTab} for this date
              </p>
            </div>
          ) : (
            // Reservation table
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Confirmation
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Guest
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Room
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Dates
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Guests
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Status
                    </th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {reservations.map(r => (
                    <ReservationRow key={r.confirmationNumber} r={r} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
