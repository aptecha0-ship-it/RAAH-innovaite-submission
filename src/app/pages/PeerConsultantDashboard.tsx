import { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  CheckCircle2, XCircle, ArrowLeft, Video, Clock,
  DollarSign, Calendar, RefreshCcw, Loader2,
  Link2, ExternalLink, X, CheckCircle
} from 'lucide-react';
import { Link } from 'react-router';
import { useAppContext } from '../context/AppContext';

interface Request {
  id: number;
  session_id?: number;
  requester_name: string;
  case_type: string;
  case_summary: string;
  preferred_slot: string;
  urgency_level: string;
  status: 'pending' | 'accepted' | 'declined';
  payment_status: string;
  amount_due: string;
  created_at: string;
  video_room_url?: string;
}

export function PeerConsultantDashboard() {
  const { lawyerProfile } = useAppContext();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<number | null>(null);

  // Meeting link modal state
  const [linkModal, setLinkModal] = useState<{ open: boolean; requestId: number | null; existingUrl?: string }>({ open: false, requestId: null });
  const [meetingUrl, setMeetingUrl] = useState('');
  const [savingLink, setSavingLink] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [linkSaved, setLinkSaved] = useState(false);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/consultations/requests', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRequests(data.received || []);
      }
    } catch (err) {
      console.error('Failed to fetch requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleRequestAction = async (id: number, status: 'accepted' | 'declined') => {
    setActioningId(id);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/consultations/requests/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });

      if (res.ok) {
        fetchRequests();
      }
    } catch (err) {
      console.error('Action failed:', err);
    } finally {
      setActioningId(null);
    }
  };

  const openLinkModal = (req: Request) => {
    setMeetingUrl(req.video_room_url || '');
    setLinkError('');
    setLinkSaved(false);
    setLinkModal({ open: true, requestId: req.id, existingUrl: req.video_room_url });
  };

  const handleSaveMeetingLink = async () => {
    if (!linkModal.requestId) {
      setLinkError('Request ID not found. Please refresh and try again.');
      return;
    }
    setSavingLink(true);
    setLinkError('');

    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/consultations/requests/${linkModal.requestId}/meeting-link`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ meeting_url: meetingUrl })
      });

      if (res.ok) {
        setLinkSaved(true);
        fetchRequests();
        setTimeout(() => setLinkModal({ open: false, requestId: null }), 1500);
      } else {
        const data = await res.json();
        setLinkError(data.error || 'Failed to save link.');
      }
    } catch (err) {
      setLinkError('An unexpected error occurred.');
    } finally {
      setSavingLink(false);
    }
  };

  return (
    <div 
      className="min-h-screen bg-center bg-no-repeat"
      style={{
        backgroundSize: '100% 100%',
        backgroundImage: 'url("/Lawyer dashboard.png")',
      }}
    >
      <Header />

      <div className="max-w-[1000px] mx-auto px-6 py-12">
        <div className="mb-6">
          <Link to="/lawyer-dashboard">
            <Button
              variant="outline"
              className="border-border text-foreground hover:bg-muted/10 h-10 px-4 text-[14px] font-medium rounded-[10px]"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Main Dashboard
            </Button>
          </Link>
        </div>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-[32px] font-bold text-slate-900 mb-2">My Consultation Requests</h1>
            <p className="text-slate-600 text-[16px]">
              Manage incoming requests from peers seeking your advice.
            </p>
          </div>
          <Button onClick={fetchRequests} variant="outline" className="border-slate-200">
            <RefreshCcw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>

        {loading && requests.length === 0 ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-[16px] border border-slate-100 shadow-[0px_4px_16px_rgba(15,23,42,0.04)]">
            <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-800 mb-2">No incoming requests yet</h3>
            <p className="text-slate-500">When peers book a consultation, they will appear here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map(req => (
              <div
                key={req.id}
                className={`bg-white rounded-[16px] border overflow-hidden shadow-[0px_4px_16px_rgba(15,23,42,0.04)] ${
                  req.status === 'pending' ? 'border-amber-200' :
                  req.status === 'accepted' ? 'border-emerald-200' : 'border-slate-200 opacity-70'
                }`}
              >
                <div className="p-6">
                  <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        {req.requester_name}
                        <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold ${
                          req.urgency_level === 'high' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {req.urgency_level === 'high' ? 'High Urgency' : 'Normal'}
                        </span>
                      </h3>
                      <p className="text-[14px] font-medium text-primary mb-1">
                        Case Type: {req.case_type}
                      </p>
                      <div className="flex items-center gap-4 text-[13px] text-slate-500">
                        <span className="flex items-center">
                          <Clock className="w-4 h-4 mr-1.5" />
                          {new Date(req.preferred_slot).toLocaleString('en-PK')}
                        </span>
                        <span className="flex items-center">
                          <DollarSign className="w-4 h-4 mr-1.5" />
                          Rs. {req.amount_due} (Status: {req.payment_status})
                        </span>
                      </div>
                    </div>

                    <span className={`px-3 py-1 text-[13px] font-bold rounded-full border ${
                      req.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      req.status === 'accepted' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      'bg-slate-50 text-slate-600 border-slate-200'
                    }`}>
                      {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                    </span>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 mb-5 relative overflow-hidden">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-300"></div>
                    <h4 className="text-[12px] font-bold text-slate-500 uppercase tracking-wider mb-2">Case Summary (Encrypted)</h4>
                    <p className="text-[14px] text-slate-700 leading-relaxed italic">
                      "{req.case_summary}"
                    </p>
                  </div>

                  {/* Meeting link banner (if set) */}
                  {req.status === 'accepted' && req.video_room_url && (
                    <div className="flex items-center gap-3 mb-4 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                      <Link2 className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span className="text-[13px] text-emerald-800 font-medium truncate flex-1">{req.video_room_url}</span>
                      <a
                        href={req.video_room_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-700 hover:text-emerald-900"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                    {req.status === 'pending' && (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => handleRequestAction(req.id, 'declined')}
                          disabled={actioningId === req.id}
                          className="border-red-200 text-red-600 hover:bg-red-50"
                        >
                          <XCircle className="w-4 h-4 mr-2" /> Decline
                        </Button>
                        <Button
                          onClick={() => handleRequestAction(req.id, 'accepted')}
                          disabled={actioningId === req.id}
                          className="bg-emerald-600 text-white hover:bg-emerald-700"
                        >
                          {actioningId === req.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                          Accept & Schedule
                        </Button>
                      </>
                    )}

                    {req.status === 'accepted' && (
                      <Button
                        onClick={() => openLinkModal(req)}
                        className="bg-slate-900 text-white hover:bg-slate-800 h-11 px-6 rounded-lg font-semibold"
                      >
                        <Video className="w-5 h-5 mr-2" />
                        {req.video_room_url ? 'Update Meeting Link' : 'Set Meeting Link'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Set Meeting Link Modal ─────────────────────────────────────────── */}
      {linkModal.open && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[20px] max-w-[500px] w-full shadow-[0px_24px_60px_rgba(0,0,0,0.2)] overflow-hidden">
            {linkSaved ? (
              <div className="p-10 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-[20px] font-bold text-slate-800 mb-2">Link Sent!</h3>
                <p className="text-slate-500">The meeting link is now visible to the requesting lawyer so they can join your session.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between p-6 border-b border-slate-100">
                  <div>
                    <h3 className="font-bold text-slate-800 text-[18px]">Set Meeting Link</h3>
                    <p className="text-[13px] text-slate-500 mt-1">
                      Paste your Zoom, Google Meet, or any video meeting URL. It will be shared with the requesting lawyer instantly.
                    </p>
                  </div>
                  <button onClick={() => setLinkModal({ open: false, requestId: null })} className="text-slate-400 hover:text-slate-700 p-1 ml-3">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6">
                  <label className="block text-[13px] font-semibold text-slate-700 mb-2">Meeting URL</label>
                  <Input
                    placeholder="Paste your meeting link (Zoom, Google Meet, Teams, etc.)"
                    value={meetingUrl}
                    onChange={(e) => setMeetingUrl(e.target.value)}
                    className="h-12 text-[14px]"
                  />

                  {linkError && (
                    <div className="mt-3 bg-red-50 border border-red-200 text-red-600 text-[13px] p-3 rounded-[8px]">
                      {linkError}
                    </div>
                  )}

                  <p className="text-[12px] text-slate-500 mt-3">
                    Create a meeting on any platform (Zoom, Google Meet, Microsoft Teams, etc.) and paste the link here. The requesting lawyer will be able to join using this link.
                  </p>

                  <div className="flex gap-3 mt-6">
                    <Button
                      variant="outline"
                      onClick={() => setLinkModal({ open: false, requestId: null })}
                      className="flex-1"
                      disabled={savingLink}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveMeetingLink}
                      className="flex-1 bg-primary hover:bg-primary/90 text-white"
                      disabled={!meetingUrl.trim() || savingLink}
                    >
                      {savingLink ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Link2 className="w-4 h-4 mr-2" />}
                      {savingLink ? 'Saving…' : 'Share Link with Requester'}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
