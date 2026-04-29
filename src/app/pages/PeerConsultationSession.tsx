import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import {
  Video, PhoneOff, FileText, Shield, AlertTriangle,
  Mic, MicOff, VideoOff, Camera, Loader2
} from 'lucide-react';

export function PeerConsultationSession() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [roomUrl, setRoomUrl] = useState<string | null | 'loading'>('loading');
  const [sessionNotes, setSessionNotes] = useState('');
  const [ending, setEnding] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const joinSession = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const res = await fetch(`/api/consultations/sessions/${id}/join`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });

        if (res.ok) {
          const data = await res.json();
          setRoomUrl(data.url); // null = mock mode, string = real Daily.co URL
        } else {
          setRoomUrl('error');
        }
      } catch (err) {
        console.error('Error joining session:', err);
        setRoomUrl('error');
      }
    };

    if (id) joinSession();
  }, [id]);

  // Start elapsed time counter when session is joined
  useEffect(() => {
    if (roomUrl !== 'loading' && roomUrl !== 'error') {
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [roomUrl]);

  const formatTime = (secs: number) => {
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleEndSession = async () => {
    setEnding(true);
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/consultations/sessions/${id}/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ session_notes: sessionNotes })
      });

      if (res.ok) {
        navigate('/lawyer/consultant-dashboard');
      }
    } catch (err) {
      console.error('Error ending session:', err);
      setEnding(false);
    }
  };

  // ── Loading state ────────────────────────────────────────────────────────
  if (roomUrl === 'loading') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center flex-col text-white gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <h2 className="text-xl font-medium">Connecting to secure session…</h2>
        <p className="text-slate-400 text-sm">Please wait while we establish an encrypted connection.</p>
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────
  if (roomUrl === 'error') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center flex-col px-4">
        <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Session Error</h2>
        <p className="text-slate-600 mb-6 max-w-md text-center">
          We couldn't connect you to this consultation session. It may have expired or you don't have access.
        </p>
        <Button onClick={() => navigate('/lawyer/consultant-dashboard')} className="bg-slate-900 text-white">
          Return to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen flex flex-col lg:flex-row bg-center bg-no-repeat"
      style={{
        backgroundSize: '100% 100%',
        backgroundImage: 'url("/Lawyer dashboard.png")',
      }}
    >

      {/* ── Video Area ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col relative">

        {/* Top bar */}
        <div className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-emerald-500/10 flex items-center justify-center">
              <Shield className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-[15px]">Peer Consultation #{id}</h3>
              <p className="text-emerald-500 text-[11px] font-medium tracking-wide">END-TO-END ENCRYPTED</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-slate-400 text-sm font-mono tabular-nums">
              {formatTime(elapsed)}
            </span>
            <Button
              onClick={handleEndSession}
              disabled={ending}
              className="bg-red-500 hover:bg-red-600 text-white rounded-full px-6 gap-2 font-medium"
            >
              <PhoneOff className="w-4 h-4" />
              {ending ? 'Ending…' : 'End Consultation'}
            </Button>
          </div>
        </div>

        {/* Video panel */}
        <div className="flex-1 relative bg-slate-950">
          {roomUrl ? (
            /* Real Daily.co iframe */
            <iframe
              src={roomUrl}
              allow="camera; microphone; fullscreen; display-capture"
              className="w-full h-full border-0 absolute inset-0"
              title="Consultation Video Session"
            />
          ) : (
            /* ── Mock video UI ─────────────────────────────────────── */
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
              {/* Remote participant tile */}
              <div className="relative w-full max-w-2xl aspect-video bg-slate-800 rounded-2xl overflow-hidden border border-slate-700 shadow-xl flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-slate-500">
                  <div className="w-20 h-20 rounded-full bg-slate-700 flex items-center justify-center text-4xl font-bold text-slate-400">
                    P
                  </div>
                  <span className="text-sm">Peer Consultant</span>
                  <span className="text-xs text-slate-600">(Video simulation — configure DAILY_API_KEY for live calls)</span>
                </div>

                {/* Live badge */}
                <div className="absolute top-3 left-3 flex items-center gap-2 bg-slate-900/80 backdrop-blur-sm px-3 py-1.5 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs text-white font-medium">LIVE</span>
                </div>
              </div>

              {/* Self tile */}
              <div className="absolute bottom-24 right-6 w-44 aspect-video bg-slate-700 rounded-xl overflow-hidden border border-slate-600 shadow-lg flex items-center justify-center">
                {camOn ? (
                  <div className="flex flex-col items-center gap-1 text-slate-400">
                    <Camera className="w-6 h-6" />
                    <span className="text-[10px]">Your camera</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1 text-slate-500">
                    <VideoOff className="w-6 h-6" />
                    <span className="text-[10px]">Camera off</span>
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="absolute bottom-6 flex items-center gap-4">
                <button
                  onClick={() => setMicOn(m => !m)}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${micOn ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white'}`}
                  title={micOn ? 'Mute' : 'Unmute'}
                >
                  {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                </button>
                <button
                  onClick={() => setCamOn(c => !c)}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${camOn ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white'}`}
                  title={camOn ? 'Turn off camera' : 'Turn on camera'}
                >
                  {camOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Side Panel: Encrypted Notes ─────────────────────────────── */}
      <div className="w-full lg:w-[400px] bg-white flex flex-col border-l border-slate-200">
        <div className="p-5 border-b border-slate-100 flex items-center gap-3 bg-slate-50">
          <FileText className="w-5 h-5 text-slate-700" />
          <div>
            <h3 className="font-semibold text-slate-900">Session Notes</h3>
            <p className="text-[12px] text-slate-500">Notes are AES-256 encrypted on save.</p>
          </div>
        </div>

        <div className="flex-1 p-5 flex flex-col">
          <Textarea
            placeholder="Document key advice, findings, or legal strategies discussed during this session…"
            value={sessionNotes}
            onChange={(e) => setSessionNotes(e.target.value)}
            className="flex-1 resize-none bg-slate-50/50 border-slate-200 focus-visible:ring-primary/20 text-[14px] leading-relaxed p-4 rounded-xl"
          />

          <div className="mt-4 flex items-start gap-3 p-4 bg-primary/5 rounded-xl border border-primary/10">
            <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <p className="text-[12px] text-primary/80 leading-relaxed">
              These notes are strictly confidential between you and the consulting peer. They will be encrypted before being stored and cannot be read by RAAH administrators.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
