import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { Header } from '../components/Header';
import { Button } from '../components/ui/button';
import {
  Scale, MapPin, Briefcase, Phone, Mail, Home, Star,
  CheckCircle2, Loader2, ArrowLeft, Send, X, TrendingUp, Shield
} from 'lucide-react';

interface LawyerMatch {
  id: number;
  full_name: string;
  city: string;
  specialization: string;
  years_of_experience: string;
  bar_council_name: string;
  chamber_address: string;
  phone: string;
  email: string;
  matchPercent: number;
}

interface ConsultStatus {
  [lawyerId: number]: 'idle' | 'sending' | 'sent' | 'error' | 'duplicate';
}

const MATCH_COLORS = [
  { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-500', text: 'text-emerald-700', label: 'Top Match' },
  { bg: 'bg-blue-50',    border: 'border-blue-200',    badge: 'bg-blue-500',    text: 'text-blue-700',    label: 'Strong Match' },
  { bg: 'bg-violet-50',  border: 'border-violet-200',  badge: 'bg-violet-500',  text: 'text-violet-700',  label: 'Good Match' },
];

export function MatchedLawyers() {
  const navigate = useNavigate();
  const location = useLocation();

  const [lawyers, setLawyers] = useState<LawyerMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [consultStatus, setConsultStatus] = useState<ConsultStatus>({});
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [userSummary, setUserSummary] = useState('');

  useEffect(() => {
    // Try to get pre-fetched results passed via navigation state (fast path)
    const stateRecs = (location.state as any)?.recommendations;
    if (stateRecs && stateRecs.length > 0) {
      setLawyers(stateRecs);
      setLoading(false);
      return;
    }
    // Fallback: re-fetch from server using stored profile/chat
    fetchRecommendations();
  }, []);

  const fetchRecommendations = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('auth_token');
      const profileRaw = localStorage.getItem('user_profile');
      const userProfile = profileRaw ? JSON.parse(profileRaw) : null;

      const res = await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userProfile, chatMessages: [] }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Could not load recommendations.');
      }
      const data = await res.json();
      if (!data.recommendations || data.recommendations.length === 0) {
        setError('No matching lawyers found yet. Please ask the administrator to approve and sync lawyers to the database.');
      } else {
        setLawyers(data.recommendations);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load recommendations.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async (lawyer: LawyerMatch) => {
    setSendingId(lawyer.id);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/consultations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          lawyerProfileId: lawyer.id,
          userSummary: userSummary.trim() || undefined,
        }),
      });
      if (res.status === 409) {
        setConsultStatus(s => ({ ...s, [lawyer.id]: 'duplicate' }));
        return;
      }
      if (!res.ok) throw new Error('Request failed');
      setConsultStatus(s => ({ ...s, [lawyer.id]: 'sent' }));
    } catch {
      setConsultStatus(s => ({ ...s, [lawyer.id]: 'error' }));
    } finally {
      setSendingId(null);
      setConfirmId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      <Header />

      <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-8 lg:py-12">

        {/* Back button */}
        <button
          onClick={() => navigate('/chat')}
          className="flex items-center gap-2 text-[14px] text-slate-500 hover:text-slate-800 mb-8 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Back to Chat
        </button>

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Scale className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-[28px] font-bold text-slate-800">Your Matched Lawyers</h1>
          </div>
          <p className="text-[15px] text-slate-500 ml-[52px]">
            These lawyers were matched to your case using AI-powered similarity search based on your profile and legal concern.
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-slate-500 text-[15px]">Finding the best-matched lawyers for your case…</p>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="bg-amber-50 border border-amber-200 rounded-[12px] p-6 text-center">
            <p className="text-amber-800 text-[14px] font-medium mb-4">{error}</p>
            <Button onClick={fetchRecommendations} variant="outline" size="sm">Try Again</Button>
          </div>
        )}

        {/* Lawyer Cards */}
        {!loading && !error && lawyers.length > 0 && (
          <div className="space-y-6">
            {lawyers.map((lawyer, idx) => {
              const theme = MATCH_COLORS[idx] || MATCH_COLORS[2];
              const status = consultStatus[lawyer.id] || 'idle';

              return (
                <div
                  key={lawyer.id}
                  className={`relative rounded-[20px] border-2 ${theme.border} ${theme.bg} p-6 sm:p-8 shadow-[0px_8px_32px_rgba(15,23,42,0.06)] transition-all`}
                >
                  {/* Rank badge */}
                  <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full ${theme.badge} text-white flex items-center justify-center text-[14px] font-bold shadow-sm`}>
                        {idx + 1}
                      </div>
                      <div>
                        <h2 className="text-[20px] font-bold text-slate-800">{lawyer.full_name}</h2>
                        <p className={`text-[13px] font-semibold ${theme.text}`}>{theme.label}</p>
                      </div>
                    </div>
                    {/* Match % */}
                    <div className={`flex items-center gap-1.5 ${theme.badge} bg-opacity-15 px-3 py-1.5 rounded-full border ${theme.border}`}>
                      <TrendingUp className={`w-3.5 h-3.5 ${theme.text}`} />
                      <span className={`text-[13px] font-bold ${theme.text}`}>
                        {lawyer.matchPercent}% Match
                      </span>
                    </div>
                  </div>

                  {/* Details grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                    <div className="flex items-start gap-2.5">
                      <Scale className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Specialization</p>
                        <p className="text-[14px] text-slate-700 font-medium">{lawyer.specialization}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">City</p>
                        <p className="text-[14px] text-slate-700 font-medium">{lawyer.city}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <Briefcase className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Experience</p>
                        <p className="text-[14px] text-slate-700 font-medium">{lawyer.years_of_experience} years</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <Shield className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Bar Council</p>
                        <p className="text-[14px] text-slate-700 font-medium capitalize">{lawyer.bar_council_name || '—'}</p>
                      </div>
                    </div>
                    {lawyer.phone && (
                      <div className="flex items-start gap-2.5">
                        <Phone className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Phone</p>
                          <a href={`tel:${lawyer.phone}`} className="text-[14px] text-primary font-medium hover:underline">{lawyer.phone}</a>
                        </div>
                      </div>
                    )}
                    {lawyer.email && (
                      <div className="flex items-start gap-2.5">
                        <Mail className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Email</p>
                          <a href={`mailto:${lawyer.email}`} className="text-[14px] text-primary font-medium hover:underline truncate">{lawyer.email}</a>
                        </div>
                      </div>
                    )}
                    {lawyer.chamber_address && (
                      <div className="flex items-start gap-2.5 sm:col-span-2">
                        <Home className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Chamber Address</p>
                          <p className="text-[14px] text-slate-700">{lawyer.chamber_address}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action area */}
                  {status === 'sent' && (
                    <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-[10px] px-4 py-3">
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                      <p className="text-[13px] text-green-700 font-medium">
                        Consultation request sent! {lawyer.full_name} will contact you soon.
                      </p>
                    </div>
                  )}
                  {status === 'duplicate' && (
                    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-[10px] px-4 py-3">
                      <Star className="w-4 h-4 text-amber-500 shrink-0" />
                      <p className="text-[13px] text-amber-700 font-medium">
                        You already have a pending request with this lawyer.
                      </p>
                    </div>
                  )}
                  {status === 'error' && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-[10px] px-4 py-3">
                      <X className="w-4 h-4 text-red-500 shrink-0" />
                      <p className="text-[13px] text-red-700 font-medium">
                        Something went wrong. Please try again.
                      </p>
                    </div>
                  )}
                  {status === 'idle' && (
                    confirmId === lawyer.id ? (
                      <div className="bg-white/80 rounded-[12px] border border-slate-200 p-4 space-y-3">
                        <p className="text-[13px] text-slate-700 font-medium">
                          Add a short note for {lawyer.full_name} <span className="text-slate-400 font-normal">(optional)</span>
                        </p>
                        <textarea
                          value={userSummary}
                          onChange={e => setUserSummary(e.target.value)}
                          placeholder="Briefly describe your situation or any specific questions..."
                          className="w-full rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700 resize-none h-20 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                        />
                        <div className="flex gap-3">
                          <Button
                            onClick={() => handleSendRequest(lawyer)}
                            disabled={sendingId === lawyer.id}
                            className="flex-1 bg-primary text-white hover:bg-primary/90 h-10 rounded-[8px] text-[13px] flex items-center justify-center gap-2"
                          >
                            {sendingId === lawyer.id ? (
                              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending...</>
                            ) : (
                              <><Send className="w-3.5 h-3.5" /> Confirm & Send</>
                            )}
                          </Button>
                          <Button
                            onClick={() => setConfirmId(null)}
                            variant="outline"
                            className="h-10 px-4 rounded-[8px] text-[13px]"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        onClick={() => setConfirmId(lawyer.id)}
                        className={`w-full sm:w-auto h-11 px-6 rounded-[10px] text-[14px] font-semibold flex items-center gap-2 shadow-sm ${theme.badge} text-white hover:opacity-90 transition-opacity`}
                      >
                        <Send className="w-4 h-4" />
                        Send Consultation Request
                      </Button>
                    )
                  )}
                </div>
              );
            })}

            {/* Bottom info note */}
            <div className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-[12px] p-4 mt-4">
              <Shield className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <p className="text-[12px] text-slate-500 leading-relaxed">
                All lawyers on RAAH are verified by our administrative team. By sending a request, 
                you share your interview profile and a brief case summary with the selected lawyer.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
