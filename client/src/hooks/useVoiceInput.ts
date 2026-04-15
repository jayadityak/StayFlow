import { useState, useRef, useCallback, useEffect } from 'react'

export type VoiceState = 'idle' | 'recording' | 'processing' | 'error'
export type VoiceLang = 'en-IN' | 'hi-IN'

interface UseVoiceInputOptions {
  language?: VoiceLang
  autoSend?: boolean
  onResult: (text: string) => void
  onAutoSend?: (text: string) => void
}

export function useVoiceInput({ language = 'en-IN', autoSend = false, onResult, onAutoSend }: UseVoiceInputOptions) {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<any>(null)
  const isSupported = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setVoiceState('idle')
  }, [])

  const startRecording = useCallback(() => {
    if (!isSupported) {
      setError('Voice input not supported. Please use Chrome or Safari.')
      setVoiceState('error')
      return
    }
    setError(null)

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(() => {
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        const recognition = new SR()
        recognition.lang = language
        recognition.continuous = false
        recognition.interimResults = false
        recognition.maxAlternatives = 1

        recognition.onstart = () => setVoiceState('recording')

        recognition.onresult = (event: any) => {
          setVoiceState('processing')
          const transcript = event.results[0][0].transcript.trim()
          if (transcript) {
            onResult(transcript)
            if (autoSend && onAutoSend) setTimeout(() => onAutoSend(transcript), 400)
          }
          setTimeout(() => setVoiceState('idle'), 500)
        }

        recognition.onerror = (event: any) => {
          const msgs: Record<string, string> = {
            'not-allowed': 'Microphone permission denied.',
            'no-speech': 'No speech detected. Try again.',
            'network': 'Network error.',
            'audio-capture': 'No microphone found.',
          }
          setError(msgs[event.error] || 'Voice recognition failed.')
          setVoiceState('error')
          recognitionRef.current = null
        }

        recognition.onend = () => {
          recognitionRef.current = null
          setVoiceState(s => s === 'recording' ? 'idle' : s)
        }

        recognitionRef.current = recognition
        recognition.start()
      })
      .catch(() => {
        setError('Microphone permission denied. Allow access in browser settings.')
        setVoiceState('error')
      })
  }, [isSupported, language, autoSend, onResult, onAutoSend])

  const toggleRecording = useCallback(() => {
    if (voiceState === 'recording') stopRecording()
    else startRecording()
  }, [voiceState, startRecording, stopRecording])

  useEffect(() => () => { recognitionRef.current?.stop() }, [])

  return { voiceState, isSupported, startRecording, stopRecording, toggleRecording, error, clearError: () => setError(null) }
}

export function useTextToSpeech() {
  const [speaking, setSpeaking] = useState(false)
  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

  const speak = useCallback((text: string, lang = 'en-IN') => {
    if (!isSupported) return
    window.speechSynthesis.cancel()
    const clean = text.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\n/g, '. ').replace(/[#*_🙏✅🏊]/g, '').trim()
    const utt = new SpeechSynthesisUtterance(clean)
    utt.lang = lang
    utt.rate = 0.92
    utt.pitch = 1
    utt.volume = 1
    const voices = window.speechSynthesis.getVoices()
    const match = voices.find(v => v.lang === lang) || voices.find(v => v.lang.startsWith(lang.split('-')[0]))
    if (match) utt.voice = match
    utt.onstart = () => setSpeaking(true)
    utt.onend = () => setSpeaking(false)
    utt.onerror = () => setSpeaking(false)
    window.speechSynthesis.speak(utt)
  }, [isSupported])

  const stop = useCallback(() => {
    if (isSupported) window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [isSupported])

  return { speak, stop, speaking, isSupported }
}
