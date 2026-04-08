import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import api from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { QrCode, Download, Copy, Check, Printer, Grid, List } from 'lucide-react'
import QRCode from 'qrcode'

interface Room {
  id: string
  roomNumber: string
  roomType: string
  floor: number
}

export default function QrPage() {
  const [copied, setCopied] = useState(false)
  const [view, setView] = useState<'hotel' | 'rooms'>('hotel')
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null)
  const hotelCanvasRef = useRef<HTMLCanvasElement>(null)
  const roomCanvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({})

  const { data: qrData } = useQuery({
    queryKey: ['qr'],
    queryFn: () => api.get<{ hotelSlug: string; hotelName: string; guestUrl: string }>('/qr'),
  })

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => api.get<Room[]>('/rooms'),
  })

  const baseUrl = window.location.origin

  // Generate hotel-level QR
  useEffect(() => {
    if (qrData?.guestUrl && hotelCanvasRef.current) {
      QRCode.toCanvas(hotelCanvasRef.current, qrData.guestUrl, {
        width: 220,
        margin: 2,
        color: { dark: '#0F172A', light: '#FFFFFF' },
      })
    }
  }, [qrData])

  // Generate per-room QRs
  useEffect(() => {
    if (!qrData?.hotelSlug) return
    rooms.forEach(room => {
      const canvas = roomCanvasRefs.current[room.id]
      if (canvas) {
        const url = `${baseUrl}/hotel/${qrData.hotelSlug}/room/${room.roomNumber}`
        QRCode.toCanvas(canvas, url, {
          width: 160,
          margin: 2,
          color: { dark: '#0F172A', light: '#FFFFFF' },
        })
      }
    })
  }, [rooms, qrData, baseUrl])

  const downloadQR = (canvas: HTMLCanvasElement | null, filename: string) => {
    if (!canvas) return
    const link = document.createElement('a')
    link.download = filename
    link.href = canvas.toDataURL()
    link.click()
  }

  const downloadAllRooms = async () => {
    if (!qrData?.hotelSlug) return
    for (const room of rooms) {
      const canvas = roomCanvasRefs.current[room.id]
      if (canvas) {
        await new Promise(r => setTimeout(r, 100))
        downloadQR(canvas, `room-${room.roomNumber}-qr.png`)
      }
    }
  }

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const printRoom = (room: Room) => {
    if (!qrData?.hotelSlug) return
    const url = `${baseUrl}/hotel/${qrData.hotelSlug}/room/${room.roomNumber}`
    const canvas = roomCanvasRefs.current[room.id]
    if (!canvas) return
    const dataUrl = canvas.toDataURL()
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html>
        <head>
          <title>Room ${room.roomNumber} QR</title>
          <style>
            body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: white; }
            .card { text-align: center; padding: 40px; border: 2px solid #0F172A; border-radius: 16px; max-width: 300px; }
            .hotel { font-size: 14px; color: #666; margin-bottom: 4px; }
            .room { font-size: 48px; font-weight: bold; color: #0F172A; margin: 8px 0; }
            .type { font-size: 13px; color: #888; text-transform: capitalize; margin-bottom: 20px; }
            img { width: 200px; height: 200px; }
            .scan { font-size: 13px; color: #666; margin-top: 16px; }
            .url { font-size: 10px; color: #aaa; margin-top: 8px; word-break: break-all; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="hotel">${qrData.hotelName}</div>
            <div class="room">${room.roomNumber}</div>
            <div class="type">${room.roomType} · Floor ${room.floor}</div>
            <img src="${dataUrl}" />
            <div class="scan">Scan to connect with hotel services</div>
            <div class="url">${url}</div>
          </div>
        </body>
      </html>
    `)
    win.document.close()
    win.print()
  }

  const grouped = rooms.reduce<Record<number, Room[]>>((acc, room) => {
    if (!acc[room.floor]) acc[room.floor] = []
    acc[room.floor].push(room)
    return acc
  }, {})

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">QR Codes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generate and print QR codes for each room
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={view === 'hotel' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('hotel')}
            className="gap-2"
          >
            <QrCode size={14} /> Hotel QR
          </Button>
          <Button
            variant={view === 'rooms' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('rooms')}
            className="gap-2"
          >
            <Grid size={14} /> Per Room ({rooms.length})
          </Button>
        </div>
      </div>

      {view === 'hotel' && (
        <div className="grid md:grid-cols-2 gap-6 max-w-3xl">
          <Card>
            <CardContent className="p-8 flex flex-col items-center gap-4">
              <div className="p-4 bg-white rounded-2xl shadow-sm border">
                <canvas ref={hotelCanvasRef} />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                General hotel QR — guests enter room number manually
              </p>
              <div className="flex gap-2 w-full">
                <Button
                  className="flex-1 gap-2"
                  onClick={() => downloadQR(hotelCanvasRef.current, `${qrData?.hotelSlug}-qr.png`)}
                >
                  <Download size={14} /> Download
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => handleCopy(qrData?.guestUrl || '')}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied!' : 'Copy Link'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Recommendation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm font-medium text-amber-800 mb-1">
                  💡 Use per-room QR codes instead
                </p>
                <p className="text-xs text-amber-700">
                  Each room gets its own QR code. Guests scan and connect instantly — no room number typing, no errors.
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => setView('rooms')}
              >
                <Grid size={14} /> Switch to Per-Room QR
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {view === 'rooms' && (
        <div className="space-y-6">
          {/* Actions bar */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-sm text-muted-foreground">
              Each room has a unique QR. Guests scan → enter name → chat opens instantly.
            </p>
            <Button onClick={downloadAllRooms} variant="outline" className="gap-2">
              <Download size={14} /> Download All QR Codes
            </Button>
          </div>

          {/* Rooms by floor */}
          {Object.entries(grouped)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([floor, floorRooms]) => (
              <div key={floor}>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Floor {floor}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {floorRooms.map(room => {
                    const roomUrl = qrData?.hotelSlug
                      ? `${baseUrl}/hotel/${qrData.hotelSlug}/room/${room.roomNumber}`
                      : ''
                    return (
                      <Card key={room.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4 flex flex-col items-center gap-2">
                          {/* Room number */}
                          <div className="text-center mb-1">
                            <p className="font-display text-xl font-bold">{room.roomNumber}</p>
                            <p className="text-xs text-muted-foreground capitalize">{room.roomType}</p>
                          </div>

                          {/* QR canvas */}
                          <div className="bg-white rounded-lg p-2 border">
                            <canvas
                              ref={el => { roomCanvasRefs.current[room.id] = el }}
                            />
                          </div>

                          {/* Actions */}
                          <div className="flex gap-1.5 w-full">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 h-7 text-xs gap-1"
                              onClick={() => downloadQR(roomCanvasRefs.current[room.id], `room-${room.roomNumber}-qr.png`)}
                            >
                              <Download size={10} /> Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 h-7 text-xs gap-1"
                              onClick={() => printRoom(room)}
                            >
                              <Printer size={10} /> Print
                            </Button>
                          </div>

                          {/* Test link */}
                          <a
                            href={roomUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline"
                          >
                            Test link →
                          </a>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
