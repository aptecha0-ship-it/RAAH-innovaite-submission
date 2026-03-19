import { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { CheckCircle, Star, TrendingUp, ArrowLeft, Bot, FileText, Send, Languages, Book, Bell, Clock, CheckCircle2, XCircle, Loader2, MessageCircle } from 'lucide-react';
import { Link } from 'react-router';
import { useAppContext } from '../context/AppContext';
import { InstantChat } from '../components/InstantChat';

interface Consultation {
  id: number;
  user_id: number;
  user_email: string;
  user_summary: string | null;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
}

export function LawyerDashboard() {
  const { lawyerProfile } = useAppContext();
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [aiQuery, setAIQuery] = useState('');
  const [aiMessages, setAIMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [showCaseUpdate, setShowCaseUpdate] = useState(false);
  const [caseUpdate, setCaseUpdate] = useState('');
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [consultLoading, setConsultLoading] = useState(true);
  const [actioningId, setActioningId] = useState<number | null>(null);
  const [activeChatId, setActiveChatId] = useState<number | null>(null);

  const isPending = lawyerProfile?.status === 'pending';

  useEffect(() => {
    if (!isPending) {
      fetchConsultations();
    }
  }, [isPending]);

  const fetchConsultations = async () => {
    setConsultLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/lawyer/consultations', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setConsultations(data);
      }
    } catch (err) {
      console.error('Failed to fetch consultations:', err);
    } finally {
      setConsultLoading(false);
    }
  };

  const handleConsultAction = async (id: number, status: 'accepted' | 'declined') => {
    setActioningId(id);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/lawyer/consultations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setConsultations(prev => prev.map(c => c.id === id ? { ...c, status } : c));
      }
    } catch (err) {
      console.error('Consultation action failed:', err);
    } finally {
      setActioningId(null);
    }
  };

  const handleAIQuery = () => {
    if (!aiQuery.trim()) return;

    // Add user message
    setAIMessages(prev => [...prev, { role: 'user', content: aiQuery }]);

    // Simulate AI response
    setTimeout(() => {
      const mockResponse = `Based on Pakistani law, regarding "${aiQuery.substring(0, 50)}...": Under Section 498-A PPC and the Domestic Violence (Prevention and Protection) Act 2013, victims have the right to immediate protection orders. Key legal provisions include:\n\n1. Protection from domestic violence\n2. Right to file FIR under Section 154 CrPC\n3. Interim custody and maintenance provisions\n\nWould you like me to draft a legal notice template or explain specific procedural steps?`;
      
      setAIMessages(prev => [...prev, { role: 'assistant', content: mockResponse }]);
    }, 1000);

    setAIQuery('');
  };

  const handleCaseUpdate = () => {
    if (!caseUpdate.trim()) return;
    // In production, this would update the case status
    alert('Case update submitted successfully! Client will be notified.');
    setCaseUpdate('');
    setShowCaseUpdate(false);
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />
      
      <div className="max-w-[1200px] mx-auto px-6 py-12">
        {/* Back Button */}
        <div className="mb-6">
          <Link to="/">
            <Button 
              variant="outline" 
              className="border-border text-foreground hover:bg-muted/10 h-10 px-4 text-[14px] font-medium rounded-[10px]"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Main App
            </Button>
          </Link>
        </div>

        {isPending ? (
          <div className="bg-white border border-border rounded-[10px] p-12 text-center shadow-[0px_8px_24px_rgba(15,23,42,0.08)]">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-yellow-600" />
            </div>
            <h1 className="text-[28px] font-semibold text-foreground mb-4">
              Verification Pending
            </h1>
            <p className="text-[16px] text-muted-foreground max-w-lg mx-auto mb-8">
              Thank you for onboarding with RAAH. Our administrative team is currently verifying your Bar Council credentials. This process typically takes 24-48 hours.
            </p>
            <div className="bg-accent rounded-[10px] p-6 text-left max-w-md mx-auto">
               <h3 className="font-semibold text-[15px] mb-3">While you wait:</h3>
               <ul className="space-y-2 text-[14px] text-muted-foreground list-disc pl-5">
                  <li>Keep an eye on your email for the approval notification.</li>
                  <li>Ensure your email matches your bar council registration.</li>
                  <li>Incomplete or mismatched information may delay approval.</li>
               </ul>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-[32px] font-semibold text-foreground">
                Lawyer Dashboard
              </h1>
          
          {/* Quick Actions */}
          <div className="flex items-center gap-3">
            <Button
              onClick={() => setShowAIAssistant(!showAIAssistant)}
              variant="outline"
              className="border-secondary text-secondary hover:bg-secondary/5 h-10 px-4 text-[14px] font-medium rounded-[10px]"
            >
              <Bot className="w-4 h-4 mr-2" />
              AI Legal Assistant
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Main Content - 2 columns */}
          <div className="lg:col-span-2 space-y-6">
            {/* Top Status Row */}
            <div className="grid grid-cols-3 gap-4">
              {/* Subscription Status */}
              <div className="bg-white border border-border rounded-[10px] p-4 shadow-[0px_8px_24px_rgba(15,23,42,0.08)]">
                <h3 className="text-[13px] font-medium text-muted-foreground mb-2">
                  Subscription Status
                </h3>
                <div className="inline-flex items-center gap-2 bg-accent px-3 py-1.5 rounded-full">
                  <CheckCircle className="w-4 h-4 text-secondary" />
                  <span className="text-[13px] font-semibold text-secondary">
                    Professional Plan
                  </span>
                </div>
              </div>
              
          {/* Leads / Consultation Requests */}
            <div className="bg-white border border-border rounded-[10px] p-4 shadow-[0px_8px_24px_rgba(15,23,42,0.08)]">
              <h3 className="text-[13px] font-medium text-muted-foreground mb-2">
                Leads This Week
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-[28px] font-bold text-foreground">
                  {consultations.filter(c => {
                    const d = new Date(c.created_at);
                    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
                    return d > weekAgo;
                  }).length}
                </span>
                <TrendingUp className="w-5 h-5 text-muted-foreground" />
              </div>
            </div>
              
              {/* Rating */}
              <div className="bg-white border border-border rounded-[10px] p-4 shadow-[0px_8px_24px_rgba(15,23,42,0.08)]">
                <h3 className="text-[13px] font-medium text-muted-foreground mb-2">
                  Rating
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-[28px] font-bold text-foreground">N/A</span>
                  <Star className="w-5 h-5 text-muted-foreground" />
                </div>
              </div>
            </div>
            
            {/* Consultation Requests Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[20px] font-semibold text-foreground flex items-center gap-2">
                  <Bell className="w-5 h-5 text-secondary" />
                  Consultation Requests
                </h2>
                <button
                  onClick={fetchConsultations}
                  className="text-[12px] text-secondary hover:underline"
                >
                  Refresh
                </button>
              </div>

              {consultLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : consultations.length === 0 ? (
                <div className="bg-white border border-dashed border-border rounded-[10px] p-10 text-center">
                  <div className="w-14 h-14 bg-accent rounded-full flex items-center justify-center mx-auto mb-3">
                    <FileText className="w-7 h-7 text-muted-foreground" />
                  </div>
                  <h3 className="text-[16px] font-semibold text-foreground mb-1">No Requests Yet</h3>
                  <p className="text-[13px] text-muted-foreground max-w-sm mx-auto">
                    Your profile is active. You'll be notified when a user sends a consultation request.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {consultations.map(c => (
                    <div
                      key={c.id}
                      className={`bg-white border rounded-[12px] p-5 shadow-[0px_4px_16px_rgba(15,23,42,0.06)] ${
                        c.status === 'pending' ? 'border-amber-200' :
                        c.status === 'accepted' ? 'border-emerald-200' : 'border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                        <div>
                          <p className="text-[14px] font-semibold text-foreground">{c.user_email}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span className="text-[12px] text-slate-400">
                              {new Date(c.created_at).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                          c.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                          c.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                        </span>
                      </div>

                      {c.user_summary && (
                        <div className="bg-slate-50 rounded-[8px] px-3 py-2 mb-4">
                          <p className="text-[13px] text-slate-600 italic">"{c.user_summary}"</p>
                        </div>
                      )}

                      {c.status === 'pending' && (
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleConsultAction(c.id, 'accepted')}
                            disabled={actioningId === c.id}
                            className="bg-emerald-600 text-white hover:bg-emerald-700 h-9 px-4 rounded-[8px] text-[13px] flex items-center gap-1.5"
                          >
                            {actioningId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                            Accept
                          </Button>
                          <Button
                            onClick={() => handleConsultAction(c.id, 'declined')}
                            disabled={actioningId === c.id}
                            variant="outline"
                            className="border-red-200 text-red-600 hover:bg-red-50 h-9 px-4 rounded-[8px] text-[13px] flex items-center gap-1.5"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Decline
                          </Button>
                        </div>
                      )}

                      {c.status === 'accepted' && (
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-[12px] text-emerald-600 font-medium flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Accepted
                          </p>
                          <Button
                            onClick={() => setActiveChatId(c.id)}
                            className="bg-secondary text-white hover:bg-secondary/90 h-8 px-3 rounded-[8px] text-[12px] flex items-center gap-1.5"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            Open Chat
                          </Button>
                        </div>
                      )}
                      {c.status === 'declined' && (
                        <p className="text-[12px] text-slate-400 font-medium">You declined this request.</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar - AI Assistant */}
          <div className="lg:col-span-1">
            <div className="bg-white border border-border rounded-[10px] p-5 shadow-[0px_8px_24px_rgba(15,23,42,0.08)] sticky top-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-secondary" />
                </div>
                <h3 className="text-[16px] font-semibold text-foreground">
                  Professional AI Assistant
                </h3>
              </div>

              <p className="text-[12px] text-muted-foreground mb-4">
                Get instant legal references, draft documents, and translate to Urdu
              </p>

              {/* Quick Actions */}
              <div className="space-y-2 mb-4">
                <button 
                  className="w-full text-left p-3 border border-border rounded-[8px] hover:border-secondary hover:bg-secondary/5 transition-colors group"
                  onClick={() => {
                    setShowAIAssistant(true);
                    setAIQuery('Explain Section 498-A PPC in simple terms');
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Book className="w-4 h-4 text-muted-foreground group-hover:text-secondary" />
                    <span className="text-[13px] font-medium text-foreground">Legal Reference Lookup</span>
                  </div>
                </button>

                <button 
                  className="w-full text-left p-3 border border-border rounded-[8px] hover:border-secondary hover:bg-secondary/5 transition-colors group"
                  onClick={() => {
                    setShowAIAssistant(true);
                    setAIQuery('Draft a legal notice for domestic violence case');
                  }}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground group-hover:text-secondary" />
                    <span className="text-[13px] font-medium text-foreground">Draft Legal Document</span>
                  </div>
                </button>

                <button 
                  className="w-full text-left p-3 border border-border rounded-[8px] hover:border-secondary hover:bg-secondary/5 transition-colors group"
                  onClick={() => {
                    setShowAIAssistant(true);
                    setAIQuery('Translate this legal explanation to Urdu');
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Languages className="w-4 h-4 text-muted-foreground group-hover:text-secondary" />
                    <span className="text-[13px] font-medium text-foreground">Urdu Translation</span>
                  </div>
                </button>
              </div>

              {/* AI Chat Interface - Compact */}
              {showAIAssistant && (
                <div className="border-t border-border pt-4 mt-4">
                  <div className="space-y-3 max-h-[400px] overflow-y-auto mb-3">
                    {aiMessages.map((msg, idx) => (
                      <div 
                        key={idx} 
                        className={`p-3 rounded-[8px] text-[12px] ${
                          msg.role === 'user' 
                            ? 'bg-primary/10 text-foreground ml-4' 
                            : 'bg-accent text-foreground mr-4'
                        }`}
                      >
                        {msg.content}
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <Input
                      placeholder="Ask about Pakistani law..."
                      value={aiQuery}
                      onChange={(e) => setAIQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAIQuery()}
                      className="h-10 rounded-[8px] text-[13px]"
                    />
                    <Button 
                      onClick={handleAIQuery}
                      className="bg-secondary text-white hover:bg-secondary/90 h-10 px-4 rounded-[8px]"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-[11px] text-muted-foreground">
                  <strong>Usage:</strong> Unlimited queries on Professional plan
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Case Update Modal */}
        {showCaseUpdate && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
            <div className="bg-white rounded-[10px] p-6 max-w-[500px] w-full shadow-[0px_16px_48px_rgba(15,23,42,0.24)]">
              <h3 className="text-[20px] font-semibold text-foreground mb-4">
                Submit Case Update
              </h3>
              <p className="text-[13px] text-muted-foreground mb-4">
                This update will be sent to the client and tracked in the system
              </p>
              <Textarea
                placeholder="Enter case update details (e.g., 'Consultation completed. Legal notice drafted and ready for review.')"
                value={caseUpdate}
                onChange={(e) => setCaseUpdate(e.target.value)}
                className="min-h-[120px] rounded-[10px] mb-4"
              />
              <div className="flex gap-3">
                <Button
                  onClick={handleCaseUpdate}
                  className="bg-primary text-white hover:bg-primary/90 h-11 px-6 rounded-[10px] flex-1"
                >
                  Submit Update
                </Button>
                <Button
                  onClick={() => setShowCaseUpdate(false)}
                  variant="outline"
                  className="border-border text-foreground hover:bg-muted/10 h-11 px-6 rounded-[10px]"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
        
        {/* Instant Chat Overlay */}
        {activeChatId && (
          <InstantChat 
            consultationId={activeChatId} 
            onClose={() => setActiveChatId(null)}
            currentUserRole="lawyer"
            otherPartyName={consultations.find(c => c.id === activeChatId)?.user_email.split('@')[0] || 'User'}
          />
        )}
        </>
        )}
      </div>
    </div>
  );
}
