import { useEffect, useRef, useState } from 'react';
import parseVoice, { VoiceParseResult } from './parseVoice';

export interface VoiceRecognitionResult {
  startListening: () => void;
  cancelVoice: () => void;
  confirmNow: () => void;
  listenState: 'idle' | 'listening' | 'processing';
  transcript: string;
  parsed: VoiceParseResult | null;
  err: string;
  supported: boolean;
}

export default function useVoiceRecognition(onResult: (parsed: VoiceParseResult) => void): VoiceRecognitionResult {
  const [listenState, setLS] = useState<'idle' | 'listening' | 'processing'>('idle');
  const [transcript, setTxt] = useState('');
  const [parsed, setParsed] = useState<VoiceParseResult | null>(null);
  const [err, setErr] = useState('');
  const recRef = useRef<any>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const supported = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  function startListening() {
    if (!supported) {
      setErr('Voice not supported in this browser');
      return;
    }
    setErr('');
    setTxt('');
    setParsed(null);
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = 'en-US';
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    recRef.current = rec;

    rec.onstart = () => {
      setLS('listening');
    };

    rec.onresult = (e: any) => {
      let interim = '';
      let final = '';
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      setTxt(final || interim);
    };

    rec.onerror = (e: any) => {
      if (e.error === 'no-speech') setErr('No speech detected — try again');
      else if (e.error === 'not-allowed') setErr('Mic access denied — check browser settings');
      else setErr('Error: ' + e.error);
      setLS('idle');
    };

    rec.onend = () => {
      setLS('processing');
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        // Process final transcript
      }, 100);
    };

    rec.start();
    // Auto-stop after 8 seconds
    setTimeout(() => {
      try {
        rec.stop();
      } catch (_e) { /* intentionally empty */ }
    }, 8000);
  }

  // Process transcript when we move to "processing" state
  useEffect(() => {
    if (listenState === 'processing' && transcript) {
      const p = parseVoice(transcript);
      if (p) {
        setParsed(p);
        // Auto-confirm after 2 seconds
        timeoutRef.current = setTimeout(() => {
          onResult(p);
          setParsed(null);
          setTxt('');
          setLS('idle');
        }, 2000);
      } else {
        setErr('Didn\'t catch that — try: "bottle 4 oz" or "wet diaper" or "nap"');
        setLS('idle');
      }
    }
  }, [listenState, transcript]);

  function cancelVoice() {
    if (recRef.current)
      try {
        recRef.current.stop();
      } catch (_e) { /* intentionally empty */ }
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setParsed(null);
    setTxt('');
    setLS('idle');
    setErr('');
  }

  function confirmNow() {
    if (parsed) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      onResult(parsed);
      setParsed(null);
      setTxt('');
      setLS('idle');
    }
  }

  return {
    startListening,
    cancelVoice,
    confirmNow,
    listenState,
    transcript,
    parsed,
    err,
    supported,
  };
}
