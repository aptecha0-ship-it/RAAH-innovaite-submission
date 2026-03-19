import { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { Button } from '../components/ui/button';
import { Clock, CheckCircle2, XCircle, ArrowLeft, Send, MessageCircle, FileText, Bot } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { InstantChat } from '../components/InstantChat';

interface Consultation {
  id: number;
  lawyer_name: string;
  lawyer_specialty: string;
  user_summary: string | null;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
}

export function UserConsultations() {
  const navigate = useNavigate();
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeChatId, setActiveChatId] = useState<number | null>(null);

  useEffect(() => {
    fetchConsultations();
  }, []);

  const fetchConsultations = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return navigate('/signup');
      
      const res = await fetch('/api/user/consultations', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setConsultations(data);
      }
    } catch (err) {
      console.error('Failed to fetch consultations:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      <Header />

      <div className="max-w-[800px] mx-auto px-4 sm:px-6 py-8 lg:py-12">
        {/* Back button */}
        <button
          onClick={() => navigate('/chat')}
          className="flex items-center gap-2 text-[14px] text-slate-500 hover:text-slate-800 mb-8 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Back to Dashboard
        </button>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-secondary" />
            </div>
            <h1 className="text-[28px] font-bold text-slate-800">My Consultations</h1>
          </div>
          <p className="text-[15px] text-slate-500 ml-[52px]">
            Track the status of your legal consultation requests and chat with accepted lawyers.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 rounded-full border-2 border-secondary border-t-transparent animate-spin"></div>
          </div>
        ) : consultations.length === 0 ? (
          <div className="bg-white border flex flex-col items-center border-dashed border-border rounded-[16px] p-12 text-center">
            <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4">
              <Bot className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-[18px] font-semibold text-foreground mb-2">No Requests Yet</h3>
            <p className="text-[14px] text-muted-foreground max-w-sm mx-auto mb-6">
              You haven't sent any consultation requests to lawyers yet. Use our AI to find matches.
            </p>
            <Link to="/chat">
              <Button className="bg-primary text-white hover:bg-primary/90 h-10 px-6 rounded-[8px]">
                Find a Lawyer
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {consultations.map(c => (
              <div 
                key={c.id}
                className={`bg-white rounded-[16px] p-5 sm:p-6 border-2 transition-all shadow-sm ${
                  c.status === 'pending' ? 'border-amber-100 hover:border-amber-200' :
                  c.status === 'accepted' ? 'border-emerald-100 hover:border-emerald-200' : 'border-slate-100 hover:border-slate-200'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div>
                    <h3 className="text-[18px] font-bold text-slate-800">{c.lawyer_name}</h3>
                    <p className="text-[13px] text-slate-500 font-medium mb-1">{c.lawyer_specialty}</p>
                    <div className="flex items-center gap-1.5 mt-2">
                       <Clock className="w-3.5 h-3.5 text-slate-400" />
                       <span className="text-[12px] text-slate-400">
                         Requested on: {new Date(c.created_at).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
                       </span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-start sm:items-end gap-3">
                    <span className={`text-[12px] font-bold px-3 py-1 rounded-full flex items-center gap-1.5 ${
                        c.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                        c.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {c.status === 'pending' && <Clock className="w-3.5 h-3.5" />}
                      {c.status === 'accepted' && <CheckCircle2 className="w-3.5 h-3.5" />}
                      {c.status === 'declined' && <XCircle className="w-3.5 h-3.5" />}
                      {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                    </span>
                    
                    {c.status === 'accepted' && (
                      <Button
                        onClick={() => setActiveChatId(c.id)}
                        className="bg-secondary text-white hover:bg-secondary/90 h-9 px-4 rounded-[8px] text-[13px] flex items-center gap-1.5 mt-1 sm:mt-0"
                      >
                        <MessageCircle className="w-4 h-4" />
                        Open Chat
                      </Button>
                    )}
                  </div>
                </div>

                {c.user_summary && (
                  <div className="mt-4 bg-slate-50 rounded-[8px] px-4 py-3 border border-slate-100">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Your Note</p>
                    <p className="text-[13px] text-slate-600 italic">"{c.user_summary}"</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

      </div>
      
      {/* Instant Chat Overlay */}
        {activeChatId && (
          <InstantChat 
            consultationId={activeChatId} 
            onClose={() => setActiveChatId(null)}
            currentUserRole="user"
            otherPartyName={`Adv. ${consultations.find(c => c.id === activeChatId)?.lawyer_name || 'Lawyer'}`}
          />
        )}
    </div>
  );
}
