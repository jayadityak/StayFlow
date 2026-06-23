import { useState, useRef } from 'react'
import { Upload, Download, CheckCircle2, AlertCircle, FileText, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ImportResult {
  created: number
  skipped: number
  errors: string[]
}

export default function ImportPage() {
  const [file, setFile]         = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState<ImportResult | null>(null)
  const [error, setError]       = useState('')
  const inputRef                = useRef<HTMLInputElement>(null)

  const handleFile = (f: File) => {
    if (!f.name.endsWith('.csv')) { setError('Please upload a .csv file'); return }
    setFile(f)
    setResult(null)
    setError('')
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  const handleUpload = async () => {
    if (!file) return
    setLoading(true)
    setError('')
    try {
      const token = localStorage.getItem('stayflow_token')
      const form  = new FormData()
      form.append('file', file)
      const res  = await fetch('/api/import/guests', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setResult(data)
      setFile(null)
    } catch (err: any) {
      setError(err.message || 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  const downloadTemplate = () => {
    const token = localStorage.getItem('stayflow_token')
    const a = document.createElement('a')
    a.href = `/api/import/template`
    a.setAttribute('Authorization', `Bearer ${token}`)
    window.open(`/api/import/template`, '_blank')
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold">Import Guests</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Upload a CSV exported from your PMS to automatically create guest sessions.
        </p>
      </div>

      {/* How it works */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6">
        <h3 className="text-sm font-semibold text-blue-800 mb-2">How it works</h3>
        <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
          <li>Export today's reservations from your PMS as a CSV</li>
          <li>Upload the file here — we'll create guest sessions automatically</li>
          <li>Guests scan their room QR and they're instantly recognised</li>
        </ol>
        <button
          onClick={downloadTemplate}
          className="mt-3 flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium"
        >
          <Download size={12} /> Download sample CSV template
        </button>
      </div>

      {/* Required columns */}
      <div className="bg-muted/50 rounded-xl p-4 mb-6 text-sm">
        <p className="font-medium mb-2">Required CSV columns:</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground font-mono text-xs">
          <span>room_number</span>
          <span>guest_name</span>
          <span>check_in <span className="font-sans not-italic">(YYYY-MM-DD)</span></span>
          <span>check_out <span className="font-sans not-italic">(YYYY-MM-DD)</span></span>
          <span className="text-muted-foreground/60">phone <span className="font-sans not-italic">(optional)</span></span>
          <span className="text-muted-foreground/60">email <span className="font-sans not-italic">(optional)</span></span>
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors mb-4',
          dragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30',
          file && 'border-green-400 bg-green-50',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        {file ? (
          <div className="flex items-center justify-center gap-3">
            <FileText size={24} className="text-green-600" />
            <div className="text-left">
              <p className="font-medium text-sm text-green-800">{file.name}</p>
              <p className="text-xs text-green-600">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
            <button
              onClick={e => { e.stopPropagation(); setFile(null) }}
              className="ml-2 text-muted-foreground hover:text-foreground"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <>
            <Upload size={28} className="mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-sm font-medium">Drop your CSV here or click to browse</p>
            <p className="text-xs text-muted-foreground mt-1">Max 5 MB</p>
          </>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm mb-4 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      <Button
        onClick={handleUpload}
        disabled={!file || loading}
        className="w-full"
      >
        {loading ? 'Importing…' : 'Import guest sessions'}
      </Button>

      {/* Result */}
      {result && (
        <div className="mt-6 bg-white border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 size={18} className="text-green-500" />
            <span className="font-semibold">Import complete</span>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-700">{result.created}</div>
              <div className="text-xs text-green-600 mt-0.5">Sessions created</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-muted-foreground">{result.skipped}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Skipped (already exist)</div>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="text-xs text-red-600 space-y-1">
              <p className="font-medium">Errors:</p>
              {result.errors.map((e, i) => <p key={i} className="opacity-80">• {e}</p>)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
