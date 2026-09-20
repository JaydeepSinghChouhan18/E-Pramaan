import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Bot,
  Send,
  Sparkles,
  Volume2,
  VolumeX,
  AlertCircle,
  FileText,
  ShieldCheck,
  CheckCircle,
  Info,
  Clock,
  RefreshCw,
  Mic,
  MicOff,
  Globe
} from 'lucide-react';
import {
  UserRole,
  AIAssistantMessage,
  TenderAISummary,
  TenderListItem,
  SupportedLanguage
} from '@e-pramaan/shared';
import { useRoleContext } from '../../contexts/RoleContext';
import { useSpeaker } from '../../hooks/useSpeaker';
import { Wave3Api } from '../../services/wave3';
import { TendersApi } from '../../services/tenders';

interface AIAssistantPageProps {
  forcedRole?: UserRole;
}

export const AIAssistantPage: React.FC<AIAssistantPageProps> = ({ forcedRole }) => {
  const { activeRole, language, t } = useRoleContext();
  const effectiveRole = forcedRole || activeRole;
  const location = useLocation();
  const { isSpeaking, isSupported: speakerSupported, speak, stop: stopSpeaker } = useSpeaker();

  // Parse query params (e.g., ?tenderId=... or ?bidId=...)
  const queryParams = new URLSearchParams(location.search);
  const initialTenderId = queryParams.get('tenderId') || '';
  const initialBidId = queryParams.get('bidId') || '';

  const [tenders, setTenders] = useState<TenderListItem[]>([]);
  const [selectedTenderId, setSelectedTenderId] = useState<string>(initialTenderId);
  const [assistantLanguage, setAssistantLanguage] = useState<string>(language || 'en');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [micState, setMicState] = useState<'OFF' | 'LISTENING' | 'PROCESSING' | 'ERROR'>('OFF');
  const recognitionRef = useRef<any>(null);
  const selectedBidId = initialBidId;

  // Chat message history
  const [messages, setMessages] = useState<AIAssistantMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: effectiveRole === UserRole.OFFICER
        ? 'Welcome Officer. I am your e-Pramaan Procurement AI Advisor. I can analyze requirement applicability, synthesize compliance evidence, evaluate cross-document discrepancies, and review risk indicators based strictly on verified records.'
        : 'Welcome Bidder. I am your e-Pramaan Guidance Assistant. I can explain public tender requirements, clarify required compliance evidence, and provide clarity on your submitted application verification status.',
      timestamp: new Date().toLocaleTimeString()
    }
  ]);
  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [loadingResponse, setLoadingResponse] = useState<boolean>(false);

  // Active AI Tender Summary
  const [tenderSummary, setTenderSummary] = useState<TenderAISummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    loadTenders();
  }, []);

  useEffect(() => {
    if (selectedTenderId) {
      loadTenderSummary(selectedTenderId);
    } else {
      setTenderSummary(null);
    }
  }, [selectedTenderId]);

  const loadTenders = async () => {
    try {
      const res = await TendersApi.listTenders({ pageSize: 50 });
      setTenders(res.items || []);
    } catch {
      // ignore
    }
  };

  const loadTenderSummary = async (tenderId: string) => {
    try {
      setLoadingSummary(true);
      const data = await Wave3Api.getTenderSummary(tenderId);
      setTenderSummary(data);
    } catch {
      setTenderSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const prompt = inputPrompt.trim();
    if (!prompt || loadingResponse) return;

    const userMsg: AIAssistantMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: prompt,
      timestamp: new Date().toLocaleTimeString()
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt('');
    setLoadingResponse(true);

    try {
      const res = await Wave3Api.queryAssistant({
        prompt,
        tenderId: selectedTenderId || undefined,
        bidId: selectedBidId || undefined,
        language: assistantLanguage as SupportedLanguage
      });

      const assistantMsg: AIAssistantMessage = {
        id: `asst-${Date.now()}`,
        role: 'assistant',
        content: res.answer,
        timestamp: new Date().toLocaleTimeString(),
        evidenceGroundedRefs: res.groundedReferences,
        status: res.status === 'AI_UNAVAILABLE' ? 'AI_UNAVAILABLE' : 'SUCCESS'
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: AIAssistantMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: err.message || 'Failed to communicate with AI Assistant service.',
        timestamp: new Date().toLocaleTimeString(),
        status: 'ERROR'
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoadingResponse(false);
    }
  };

  const toggleListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported by your browser. Please use Google Chrome or Microsoft Edge.');
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      setMicState('OFF');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = false;
      recognition.interimResults = false;

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
        ur: 'ur-IN'
      };
      recognition.lang = langMap[assistantLanguage] || 'en-IN';

      recognition.onstart = () => {
        setIsListening(true);
        setMicState('LISTENING');
      };

      recognition.onresult = (event: any) => {
        setMicState('PROCESSING');
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputPrompt((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
        setMicState('ERROR');
        setTimeout(() => setMicState('OFF'), 3000);
      };

      recognition.onend = () => {
        setIsListening(false);
        setMicState('OFF');
      };

      recognition.start();
    } catch (err) {
      setIsListening(false);
      setMicState('ERROR');
      setTimeout(() => setMicState('OFF'), 3000);
    }
  };

  const handleListen = (text: string) => {
    if (isSpeaking) {
      stopSpeaker();
    } else {
      speak(text, assistantLanguage);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg">
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 font-serif">
                {activeRole === UserRole.OFFICER ? 'Procurement AI Decision Co-Pilot' : 'Bidder AI Guidance Assistant'}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Statutory procurement reasoning grounded strictly in verified database evidence.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Assistant Language Selector */}
          <div className="flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-slate-500" />
            <label className="text-xs font-bold text-slate-600 uppercase">Assistant Language:</label>
            <select
              value={assistantLanguage}
              onChange={(e) => setAssistantLanguage(e.target.value)}
              className="text-xs border border-slate-300 rounded-md py-1.5 px-2 bg-white text-slate-800 font-semibold focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="en">English (India)</option>
              <option value="hi">हिंदी (Hindi)</option>
              <option value="bn">বাংলা (Bengali)</option>
              <option value="te">తెలుగు (Telugu)</option>
              <option value="mr">मराठी (Marathi)</option>
              <option value="ta">தமிழ் (Tamil)</option>
              <option value="gu">ગુજરાતી (Gujarati)</option>
              <option value="kn">ಕನ್ನಡ (Kannada)</option>
              <option value="ml">മലയാളം (Malayalam)</option>
              <option value="pa">ਪੰਜਾਬੀ (Punjabi)</option>
              <option value="or">ଓଡ଼ିଆ (Odia)</option>
            </select>
          </div>

          {/* Tender Context Selector */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase">Select Tender:</label>
            <select
              value={selectedTenderId}
              onChange={(e) => setSelectedTenderId(e.target.value)}
              className="text-xs border border-slate-300 rounded-md py-1.5 px-2 bg-white text-slate-800 font-medium focus:ring-indigo-500 focus:border-indigo-500 min-w-[220px]"
            >
              <option value="">-- All / Global Scope --</option>
              {tenders.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.tenderNumber} — {t.title.slice(0, 26)}...
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Interactive Grounded Conversation */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col h-[640px] overflow-hidden">
          {/* Chat Header */}
          <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-600" />
              <span className="text-xs font-bold text-slate-800">Grounded Conversation</span>
              <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-mono font-bold">
                Language: {assistantLanguage.toUpperCase()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setMessages([
                    {
                      id: `welcome-${Date.now()}`,
                      role: 'assistant',
                      content: effectiveRole === UserRole.OFFICER
                        ? 'Welcome Officer. Conversation reset. Ask me about requirement applicability, compliance evidence, or discrepancy flags from verified records.'
                        : 'Welcome Bidder. Conversation reset. Select a published tender to review requirements, checklists, and pre-submission guidance.',
                      timestamp: new Date().toLocaleTimeString()
                    }
                  ]);
                }}
                className="text-[11px] px-2 py-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 font-semibold transition flex items-center gap-1 border border-slate-200 bg-white"
                title="Start a new conversation and clear chat history"
              >
                <RefreshCw className="h-3 w-3" /> New Chat
              </button>
              {speakerSupported && (
                <button
                  onClick={() => isSpeaking && stopSpeaker()}
                  className={`text-[11px] px-2 py-1 rounded flex items-center gap-1 font-semibold transition ${
                    isSpeaking ? 'bg-amber-100 text-amber-800 animate-pulse' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {isSpeaking ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                  {isSpeaking ? t('action.speaking') : t('action.listen')}
                </button>
              )}
            </div>
          </div>

          {/* Message Thread */}
          <div className="flex-1 p-5 overflow-y-auto space-y-4">
            {messages.map((msg) => {
              const isAsst = msg.role === 'assistant';
              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-3 ${isAsst ? 'justify-start' : 'justify-end'}`}
                >
                  {isAsst && (
                    <div className="w-8 h-8 rounded-full bg-indigo-700 text-white flex items-center justify-center flex-shrink-0 text-xs shadow-sm">
                      <Bot className="h-4 w-4" />
                    </div>
                  )}
                  <div
                    className={`max-w-xl rounded-lg p-4 text-sm space-y-2 leading-relaxed shadow-sm ${
                      isAsst
                        ? msg.status === 'AI_UNAVAILABLE'
                          ? 'bg-amber-50 border border-amber-200 text-amber-950'
                          : msg.status === 'ERROR'
                          ? 'bg-rose-50 border border-rose-200 text-rose-950'
                          : 'bg-slate-50 border border-slate-200 text-slate-800'
                        : 'bg-indigo-700 text-white font-medium'
                    }`}
                  >
                    <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>

                    {/* Evidence Grounding References */}
                    {msg.evidenceGroundedRefs && msg.evidenceGroundedRefs.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-200 space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                          <ShieldCheck className="h-3 w-3 text-emerald-600" /> Grounded In Database Records:
                        </span>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {msg.evidenceGroundedRefs.map((ref, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-white text-slate-700 border border-slate-200 shadow-2xs"
                            >
                              <span className="text-indigo-600">[{ref.type}]</span> {ref.title}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 font-mono">
                      <span>{msg.timestamp}</span>
                      {isAsst && speakerSupported && (
                        <button
                          onClick={() => handleListen(msg.content)}
                          className="hover:text-indigo-600 flex items-center gap-1 font-sans"
                        >
                          <Volume2 className="h-3 w-3" /> Listen
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Bar */}
          <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center gap-2 overflow-x-auto text-[11px]">
            <span className="text-slate-400 font-bold whitespace-nowrap">Suggested:</span>
            <button
              onClick={() => setInputPrompt('What are the mandatory eligibility criteria for this tender?')}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded hover:bg-slate-100 text-slate-700 whitespace-nowrap"
            >
              Mandatory Requirements?
            </button>
            <button
              onClick={() => setInputPrompt('What specific statutory documents must be attached?')}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded hover:bg-slate-100 text-slate-700 whitespace-nowrap"
            >
              Required Documents?
            </button>
            {effectiveRole === UserRole.OFFICER && (
              <button
                onClick={() => setInputPrompt('Explain any cross-document discrepancies found in submitted applications.')}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded hover:bg-slate-100 text-slate-700 whitespace-nowrap"
              >
                Discrepancies & Risk?
              </button>
            )}
          </div>

          {/* Input Bar */}
          <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-200 bg-white flex items-center gap-2">
            <input
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder={effectiveRole === UserRole.OFFICER ? "Ask about compliance criteria, discrepancy analysis, or risk factors..." : "Ask about tender requirements, document checklists, or application status..."}
              disabled={loadingResponse}
              className="flex-1 text-sm border border-slate-300 rounded-md p-2.5 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800"
            />
            {/* Speech to text microphone button & visible state badge */}
            <div className="flex items-center gap-1.5">
              {micState === 'LISTENING' && (
                <span className="text-[10px] bg-rose-100 text-rose-700 px-2 py-1 rounded font-bold animate-pulse flex items-center gap-1 border border-rose-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                  LISTENING
                </span>
              )}
              {micState === 'PROCESSING' && (
                <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-1 rounded font-bold flex items-center gap-1 border border-amber-200">
                  <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                  PROCESSING
                </span>
              )}
              {micState === 'ERROR' && (
                <span className="text-[10px] bg-rose-100 text-rose-800 px-2 py-1 rounded font-bold border border-rose-200">
                  MIC ERROR
                </span>
              )}
              {micState === 'OFF' && (
                <span className="text-[10px] text-slate-400 font-semibold px-1.5 py-0.5 rounded border border-slate-200 hidden sm:inline-block">
                  MIC OFF
                </span>
              )}
              <button
                type="button"
                onClick={toggleListening}
                className={`p-2.5 rounded-md border text-xs font-bold transition flex items-center justify-center ${
                  isListening
                    ? 'bg-rose-600 text-white border-rose-700 animate-pulse shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-300'
                }`}
                title={isListening ? "Listening... click to stop" : "Speak question in chosen language"}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
            </div>
            <button
              type="submit"
              disabled={loadingResponse || !inputPrompt.trim()}
              className="px-4 py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded-md text-xs font-bold transition disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
            >
              {loadingResponse ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send
            </button>
          </form>
        </div>

        {/* Right 1 Col: Tender AI Summary & Context Details */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5 space-y-4 flex flex-col h-[640px] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-indigo-700" />
              <h2 className="text-sm font-bold text-slate-900">Tender Executive Summary</h2>
            </div>
            {tenderSummary && speakerSupported && (
              <button
                onClick={() => handleListen(tenderSummary.purposeAndScope + ' ' + tenderSummary.mandatoryRequirements.join('. '))}
                className="text-xs text-indigo-700 hover:text-indigo-900 font-semibold flex items-center gap-1"
                title="Read AI Summary"
              >
                <Volume2 className="h-3.5 w-3.5" />
                {t('action.listen')}
              </button>
            )}
          </div>

          {loadingSummary ? (
            <div className="p-12 text-center text-slate-500">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto text-indigo-600 mb-2" />
              <p className="text-xs">Generating verified tender summary...</p>
            </div>
          ) : !tenderSummary ? (
            <div className="p-12 text-center text-slate-400 text-xs space-y-2">
              <Info className="h-6 w-6 mx-auto text-slate-300" />
              <p>Select a tender from the top dropdown to view its synthesized summary and compliance areas.</p>
            </div>
          ) : (
            <div className="space-y-4 text-xs text-slate-700">
              <div className="p-3 bg-indigo-50/50 rounded border border-indigo-100">
                <span className="font-bold text-indigo-950 block mb-1">Purpose & Scope:</span>
                <p className="leading-relaxed">{tenderSummary.purposeAndScope}</p>
              </div>

              <div>
                <span className="font-bold text-slate-800 block mb-1.5 flex items-center gap-1">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-600" /> Mandatory Requirements:
                </span>
                <ul className="list-disc pl-4 space-y-1 text-slate-600">
                  {tenderSummary.mandatoryRequirements.map((r, i) => (
                    <li key={i} className="font-medium text-slate-800">{r}</li>
                  ))}
                </ul>
              </div>

              <div>
                <span className="font-bold text-slate-800 block mb-1.5 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-slate-500" /> Key Timeline & Dates:
                </span>
                <div className="space-y-1">
                  {tenderSummary.importantDates.map((d, i) => (
                    <div key={i} className="flex items-center justify-between p-1.5 bg-slate-50 rounded border border-slate-100">
                      <span className="text-slate-500">{d.label}</span>
                      <span className="font-mono font-bold text-slate-800">{new Date(d.date).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <span className="font-bold text-slate-800 block mb-1.5 flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5 text-slate-500" /> Required Evidence & Documents:
                </span>
                <div className="flex flex-wrap gap-1">
                  {tenderSummary.requiredDocuments.map((doc, i) => (
                    <span key={i} className="px-2 py-0.5 bg-slate-100 rounded text-[11px] text-slate-700 border border-slate-200">
                      {doc}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-amber-50 rounded border border-amber-200 text-amber-900 space-y-1">
                <span className="font-bold text-[11px] flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-700" /> Sovereign Compliance Conditions:
                </span>
                <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                  {tenderSummary.warningsAndConditions.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>

              <div className="text-[10px] text-slate-400 italic pt-2 border-t border-slate-100">
                Notice: AI Summary synthesized from verified tender criteria and General Financial Rules (GFR). Does not constitute legal advice.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
