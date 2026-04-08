import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/primitives'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts'
import { format } from 'date-fns'
import { BarChart3 } from 'lucide-react'

const COLORS = ['#4F6EF7', '#0F172A', '#818CF8', '#6366F1', '#3B82F6', '#A5B4FC']

export default function AnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics'],
    queryFn: () => api.get<any>('/analytics/overview'),
  })

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-muted animate-pulse rounded-lg" />)}
        </div>
      </div>
    )
  }

  const s = data?.summary || {}

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">Usage metrics and operational insights</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total QR Scans', value: s.totalScans },
          { label: 'Total Chats', value: s.totalChats },
          { label: 'Billable Events', value: s.billableEvents },
          { label: 'Active Guests', value: s.activeGuests },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              <p className="text-3xl font-bold font-display">{value ?? 0}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Daily scans */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Daily QR Scans — Last 7 Days</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data?.charts?.dailyScans || []}>
                <XAxis dataKey="date" tickFormatter={d => format(new Date(d), 'EEE')} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip labelFormatter={d => format(new Date(d), 'MMM d')} formatter={(v: any) => [v, 'Scans']} />
                <Line type="monotone" dataKey="count" stroke="#4F6EF7" strokeWidth={2.5} dot={{ r: 4, fill: '#4F6EF7' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Requests by type */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Top Service Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data?.charts?.requestsByType || []} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis dataKey="type" type="category" tick={{ fontSize: 10 }} width={100} />
                <Tooltip formatter={(v: any) => [v, 'Requests']} />
                <Bar dataKey="count" fill="#4F6EF7" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top menu items */}
        {data?.charts?.topMenuItems?.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Most Ordered Items</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.charts.topMenuItems}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip formatter={(v: any) => [v, 'Orders']} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {data.charts.topMenuItems.map((_: any, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Most delayed requests */}
        {data?.charts?.delayedByType?.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Most Delayed Requests</CardTitle>
              <p className="text-xs text-muted-foreground">Avg. resolution time (minutes) — last 30 days</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.charts.delayedByType} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 11 }} unit=" min" />
                  <YAxis dataKey="type" type="category" tick={{ fontSize: 10 }} width={110} />
                  <Tooltip formatter={(v: any) => [`${v} min`, 'Avg. delay']} />
                  <Bar dataKey="avgMinutes" fill="#818CF8" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
