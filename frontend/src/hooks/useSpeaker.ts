import { useState, useEffect, useCallback } from 'react';

export interface UseSpeakerReturn {
  isSpeaking: boolean;
  isSupported: boolean;
  speak: (text: string, langCode?: string) => void;
  stop: () => void;
}

export function useSpeaker(): UseSpeakerReturn {
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => {
    if (!isSupported) return;

    const synth = window.speechSynthesis;

    // Periodically check speaking status to keep UI in sync
    const interval = setInterval(() => {
      if (synth && !synth.speaking && isSpeaking) {
        setIsSpeaking(false);
      }
    }, 500);

    return () => {
      clearInterval(interval);
      if (synth) {
        synth.cancel();
      }
    };
  }, [isSupported, isSpeaking]);

  const speak = useCallback(
    (text: string, langCode: string = 'en') => {
      if (!isSupported) {
        console.warn('[useSpeaker] Web Speech API is not supported on this device/browser.');
        return;
      }

      const synth = window.speechSynthesis;
      synth.cancel(); // Stop any active speech

      if (!text.trim()) return;

      const utterance = new SpeechSynthesisUtterance(text);

      // Map language codes to BCP 47 tags
      const langMap: Record<string, string> = {
        en: 'en-IN',
        hi: 'hi-IN',
        bn: 'bn-IN',
        te: 'te-IN',
        mr: 'mr-IN',
        ta: 'ta-IN',
        gu: 'gu-IN',
        kn: 'kn-IN',
        ml: 'ml-IN',
        or: 'or-IN',
        pa: 'pa-IN',
        as: 'as-IN',
        ur: 'ur-IN'
      };

      utterance.lang = langMap[langCode] || 'en-IN';
      utterance.rate = 0.95; // Clear government announcement pace

      // Attempt to pick a matching language voice if available
      const voices = synth.getVoices();
      const matchingVoice = voices.find((v) => v.lang.startsWith(langCode) || v.lang === utterance.lang);
      if (matchingVoice) {
        utterance.voice = matchingVoice;
      }

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      synth.speak(utterance);
    },
    [isSupported]
  );

  const stop = useCallback(() => {
    if (isSupported) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [isSupported]);

  return { isSpeaking, isSupported, speak, stop };
}
