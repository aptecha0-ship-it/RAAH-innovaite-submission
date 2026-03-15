import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Header } from '../components/Header';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useAppContext } from '../context/AppContext';
import { MessageCircle, Send, Shield, Loader2, Trash2, Menu, X, UserCheck } from 'lucide-react';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface LawyerSuggestion {
  name: string;
  specialization: string;
  city: string;
  experience: string;
  reason: string;
  phone?: string;
  email?: string;
}

export function AIChat() {
  const navigate = useNavigate();
  const { 
    chatSessions, activeSessionId, addMessage, createNewSession, switchSession, deleteSession, clearAllSessions,
    guidanceSummary, setGuidanceSummary, isAuthenticated, userProfile 
  } = useAppContext();
  
  const currentChat = chatSessions.find(s => s.id === activeSessionId)?.messages || [];
  
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isRecommending, setIsRecommending] = useState(false);

  // Redirect to signup if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/signup');
    }
  }, [isAuthenticated, navigate]);

  // Generate summary on load if not present
  useEffect(() => {
    if (isAuthenticated && !guidanceSummary && userProfile) {
      generateSummary(userProfile);
    }
  }, [isAuthenticated, guidanceSummary, userProfile]);

  // Initial greeting prompt if chat history is totally blank for the current active session
  useEffect(() => {
    if (isAuthenticated && activeSessionId && currentChat.length === 0 && !isTyping) {
      addMessage({
        id: 'initial_greeting',
        role: 'assistant',
        content: "Hello. I am RAAH's Legal AI Assistant. I am here to help you understand your legal options safely and securely. How can I assist you today?"
      });
    }
  }, [isAuthenticated, activeSessionId, currentChat.length]);

  const generateSummary = (profile: any) => {
    setIsGeneratingSummary(true);

    // Fallback delays for UI UX (optional, can be very short or removed)
    setTimeout(() => {
      let identifiedIssue = 'General Legal Query';
      let urgencyLevel: 'high' | 'medium' | 'low' = 'medium';
      let immediateSafeActions = ['Keep all relevant documents safe', 'Do not confront the opposing party directly'];
      let relevantLaw = ['General Civil Procedure Code'];
      let legalSteps = ['Consult a lawyer to review documents', 'Draft a legal notice if required'];
      let requiredDocuments = ['CNIC copy', 'Any contracts or evidence'];

      // Parse Issue
      if (profile.legalConcern === 'marriage') identifiedIssue = 'Marriage, Divorce, or Khula';
      else if (profile.legalConcern === 'domestic') identifiedIssue = 'Domestic Violence or Safety';
      else if (profile.legalConcern === 'inheritance') identifiedIssue = 'Inheritance or Property Rights';
      else if (profile.legalConcern === 'harassment') identifiedIssue = 'Workplace or Public Harassment';

      // Parse Urgency
      if (profile.emergencyStatus === 'immediate') urgencyLevel = 'high';
      else if (profile.emergencyStatus === 'urgent') urgencyLevel = 'medium';
      else urgencyLevel = 'low';

      // Parse Safe Actions specifically based on concern
      if (profile.legalConcern === 'domestic' && urgencyLevel === 'high') {
        immediateSafeActions = [
          'Contact a trusted family member or friend',
          'Keep your phone and ID documents ready',
          'Move to a safe space immediately if possible'
        ];
      } else if (profile.legalConcern === 'harassment') {
        immediateSafeActions = [
          'Document times, dates, and locations of incidents',
          'Avoid being alone with the perpetrator',
          'Inform HR or a trusted authority figure'
        ];
      }

      // Relevant laws based on concern
      if (profile.legalConcern === 'domestic') {
        relevantLaw = ['Domestic Violence (Prevention and Protection) Act', 'PPC Section 337 (Hurt), 506 (Criminal Intimidation)'];
      } else if (profile.legalConcern === 'marriage') {
        relevantLaw = ['Muslim Family Laws Ordinance 1961', 'Family Courts Act 1964'];
      } else if (profile.legalConcern === 'harassment') {
        relevantLaw = ['Protection Against Harassment of Women at Workplace Act 2010', 'PPC Section 509'];
      } else if (profile.legalConcern === 'inheritance') {
        relevantLaw = ['Muslim Personal Law (Shariat) Application Act, 1962', 'Succession Act, 1925'];
      }

      setGuidanceSummary({
        identifiedIssue,
        urgencyLevel,
        immediateSafeActions,
        relevantLaw,
        legalSteps,
        requiredDocuments,
        nextStepRecommendation: 'Speak to a verified lawyer'
      });
      setIsGeneratingSummary(false);
    }, 800); // 800ms delay to still show the nice transition loading state
  };

  const handleRecommendLawyer = async () => {
    setIsRecommending(true);
    setIsSidebarOpen(false);

    // Add a 'thinking' message from the assistant
    addMessage({
      id: Date.now().toString(),
      role: 'assistant',
      content: '🔍 Analyzing your case… I am reviewing your profile and our conversation to find the best-matched verified lawyers for you. This will just take a moment.',
    });

    try {
      const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error('Gemini API key missing');

      // Fetch verified lawyers
      const lawyersRes = await fetch('/api/lawyers');
      const lawyers = lawyersRes.ok ? await lawyersRes.json() : [];

      if (!lawyers || lawyers.length === 0) {
        addMessage({
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: "I'm sorry, I couldn't find any verified lawyers available at the moment. Please try again soon or browse the Verified Lawyers page.",
        });
        setIsRecommending(false);
        return;
      }

      // Build a summarized chat context (last 10 messages in active session)
      const chatContext = currentChat
        .slice(-10)
        .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n');

      // Build matching prompt
      const matchPrompt = `You are a legal case matching assistant for RAAH, a platform helping women in Pakistan.

You must select the TOP 3 most suitable verified lawyers from the list below for this user.

USER PROFILE (from initial interview):
${userProfile ? JSON.stringify(userProfile, null, 2) : 'Not available'}

RECENT CHAT CONTEXT:
${chatContext || 'No chat history yet.'}

AVAILABLE VERIFIED LAWYERS (JSON array):
${JSON.stringify(lawyers.slice(0, 20), null, 2)}

INSTRUCTIONS:
- Carefully consider the user's legal concern, urgency, location (province/city), and case details.
- Prioritize lawyers whose practice areas align with the user's legal concern.
- Briefly explain WHY each lawyer is a good fit (1-2 sentences).
- Respond ONLY with a valid JSON array of top 3 recommended lawyers in this exact format:
[
  {
    "name": "Full Name",
    "specialization": "Specialization",
    "city": "City",
    "experience": "X years",
    "reason": "Why this lawyer is a good match.",
    "phone": "phone or null",
    "email": "email or null"
  }
]
Return ONLY the JSON array, no extra text.`;

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const result = await model.generateContent(matchPrompt);
      const raw = result.response.text().trim();

      // Clean possible markdown fences
      const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
      const recommendations: LawyerSuggestion[] = JSON.parse(cleaned);

      // Inject recommendation into chat as a special assistant message
      const recContent = `__LAWYER_RECS__:${JSON.stringify(recommendations)}`;
      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: recContent,
      });

    } catch (err) {
      console.error('Lawyer recommendation failed:', err);
      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I had trouble generating lawyer recommendations right now. Please try again in a moment.",
      });
    } finally {
      setIsRecommending(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isTyping) return;

    const userMessage = inputMessage;
    // Add user message
    addMessage({
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
    });

    setInputMessage('');
    setIsTyping(true);

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('Gemini API key is not configured');
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const systemPrompt = `You are a compassionate, expert Legal Guide for RAAH — a platform that helps women in Pakistan understand their legal rights and options. Your specialty is domestic violence, khula, divorce, harassment, inheritance, and family law.

TONE & STYLE:
- Warm, human, and professional. Use contractions (don't, it's, you're). Vary sentence lengths.
- Never sound robotic or clinical. Sound like a trusted friend who also happens to be a lawyer.

STRICT CONVERSATION RULES — follow these without exception:
1. The "One-Inquiry" Rule: Never provide more than ONE piece of legal information OR ask more than ONE question per response. If you find yourself writing more, stop and cut it down.
2. Micro-Dose Information: Keep responses to a maximum of 3 SHORT paragraphs. No walls of text. No bullet-point dumps.
3. Empathetic Validation First: Always acknowledge the user's emotional state BEFORE giving any legal information. Use phrases like "I hear you," "That sounds incredibly difficult," "It's brave of you to reach out."
4. End With a Next Step: Every single response must end with either a simple guiding question OR a clear "next step" — never leave the user without direction.
5. No Legalese: If you must use a legal term, immediately define it in plain everyday language in the same sentence.
6. Never ask for info you already have: Check the intake profile below first.

EXAMPLE OF HOW TO RESPOND:
User: "I want to leave my husband but I'm scared about my kids and home."
Good response: "I'm so sorry you're going through this — it takes real courage to even say those words. The good news is the law does have protections for both your home and your children. We can figure this out together, one step at a time. To start — is your biggest worry right now about staying safe in the house, or about the kids?"

${userProfile ? `INTAKE PROFILE (already collected — do NOT ask for this information again):
- Primary Concern: ${userProfile.legalConcern || 'Not specified'}
- Incident Description: ${userProfile.incidentDescription || 'Not specified'}
- Emergency Level: ${userProfile.emergencyStatus || 'Not specified'}
- Safety Status: ${userProfile.safetyStatus || 'Not specified'}
- Issue Duration: ${userProfile.issueDuration || 'Not specified'}
- Legal Action Taken: ${userProfile.legalProceedings || 'Not specified'}
- Evidence Available: ${userProfile.evidence || 'Not specified'}
- Preferred Outcome: ${userProfile.preferredOutcome || 'Not specified'}
- Province: ${userProfile.province || 'Not specified'}
- Consultant Preference: ${userProfile.consultantPreference || 'Not specified'}
Use this profile to tailor every response. Never ask the user to repeat anything already captured above.` : 'No intake profile available. Gently gather context through conversation, one question at a time.'}`;

      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: systemPrompt
      });

      // Convert chat history for Gemini, ensuring we omit the local greeting
      // Gemini requires the history array to start with a 'user' message and STRICTLY ALTERNATE
      const rawHistory = currentChat.filter(msg => msg.id !== 'initial_greeting');
      const formattedHistory: { role: string, parts: { text: string }[] }[] = [];

      let lastRole = '';
      for (const msg of rawHistory) {
        const currentRole = msg.role === 'user' ? 'user' : 'model';
        
        // Skip leading model messages if we don't have a user message yet
        if (formattedHistory.length === 0 && currentRole === 'model') {
           // We'll inject a dummy user request if the history somehow starts with a model message
           formattedHistory.push({ role: 'user', parts: [{ text: 'Hello' }] });
           lastRole = 'user';
        }

        if (currentRole === lastRole && formattedHistory.length > 0) {
          // If the role is the same as the last one, concatenate the text to avoid throwing an error
          const lastIndex = formattedHistory.length - 1;
          formattedHistory[lastIndex].parts[0].text += `\n\n[Message continued]\n${msg.content}`;
        } else {
          // Normal alternating role
          formattedHistory.push({
            role: currentRole,
            parts: [{ text: msg.content }]
          });
        }
        lastRole = currentRole;
      }


      const chat = model.startChat({
        history: formattedHistory,
      });

      const result = await chat.sendMessage(userMessage);
      const responseText = result.response.text();

      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseText,
      });
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I apologize, but I am currently experiencing technical difficulties connecting to my knowledge base.',
      });
    } finally {
      setIsTyping(false);
    }
  };

  const handleSeeLegalSteps = () => {
    navigate('/guidance-summary');
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <div className="max-w-[1200px] mx-auto px-4 lg:px-6 py-4 lg:py-8">
        <div className="flex relative lg:grid lg:grid-cols-[280px_1fr] gap-0 lg:gap-6 h-[calc(100vh-140px)] lg:h-[calc(100vh-180px)]">
          
          {/* Mobile Sidebar Overlay */}
          {isSidebarOpen && (
            <div 
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={() => setIsSidebarOpen(false)}
            />
          )}

          {/* Sidebar */}
          <div className={`fixed inset-y-0 left-0 w-[280px] bg-[#F8FAFC] z-50 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 lg:w-full lg:h-full lg:rounded-[10px] p-6 flex flex-col shadow-2xl lg:shadow-none ${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}>
            <div className="flex justify-between items-center mb-6 lg:hidden">
              <h2 className="font-semibold text-foreground">Menu</h2>
              <button 
                onClick={() => setIsSidebarOpen(false)} 
                className="text-muted-foreground p-1 hover:bg-slate-200 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <Button 
              onClick={() => {
                createNewSession();
                setIsSidebarOpen(false);
              }}
              className="bg-primary text-white hover:bg-primary/90 w-full mb-3 rounded-[10px]"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              New Chat
            </Button>

            <button
              onClick={handleRecommendLawyer}
              disabled={isRecommending}
              className="w-full mb-6 flex items-center justify-center gap-2 border border-secondary text-secondary hover:bg-secondary/10 transition-colors rounded-[10px] py-2 text-[14px] font-medium disabled:opacity-50"
            >
              {isRecommending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Finding Lawyers...</>
              ) : (
                <><UserCheck className="w-4 h-4" /> Recommend Me a Lawyer</>
              )}
            </button>

            <div className="flex-1 overflow-y-auto pr-2">
              <h3 className="text-[13px] font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
                Chat History
              </h3>
              
              {chatSessions.length === 0 ? (
                <div className="bg-white/50 border border-border rounded-lg p-3">
                  <p className="text-[12px] text-slate-600 leading-relaxed">
                    Your previous conversations will automatically appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {chatSessions.map((session) => (
                    <div 
                      key={session.id} 
                      className={`group flex items-center w-full rounded-md transition-colors ${
                        session.id === activeSessionId
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <button
                        onClick={() => {
                          switchSession(session.id);
                          setIsSidebarOpen(false);
                        }}
                        className={`flex-1 text-left px-3 py-2 text-[13px] truncate`}
                      >
                        {session.title}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSession(session.id);
                        }}
                        className={`p-2 text-slate-400 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all ${
                          session.id === activeSessionId ? 'opacity-100' : ''
                        }`}
                        title="Delete Chat"
                      >
                        <Trash2 className="w-[14px] h-[14px]" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-border mt-4 space-y-3">
              {chatSessions.length > 0 && (
                <button 
                  onClick={() => {
                    if (window.confirm("Are you sure you want to clear all chat history? This cannot be undone.")) {
                      clearAllSessions();
                    }
                  }}
                  className="w-full text-left text-[13px] text-red-500 hover:text-red-600 hover:underline flex items-center"
                >
                  <Trash2 className="w-[13px] h-[13px] mr-2" />
                  Clear All Chats
                </button>
              )}
              <button className="text-[13px] text-secondary hover:underline block w-full text-left">
                Help & Safety
              </button>
            </div>
          </div>

          {/* Main Chat Area */}
          <div className="flex-1 flex flex-col bg-white rounded-[10px] border border-border lg:border-none shadow-sm lg:shadow-none relative w-full overflow-hidden">
            
            {/* Mobile Header Toggle */}
            <div className="lg:hidden flex items-center px-4 py-3 border-b border-border bg-white sticky top-0 z-10 w-full">
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="mr-3 text-slate-500 hover:text-slate-800 p-1 -ml-1"
              >
                <Menu className="w-6 h-6" />
              </button>
              <h2 className="font-semibold text-[15px] truncate flex-1 text-foreground">
                {currentChat.length > 0 
                  ? (chatSessions.find(s => s.id === activeSessionId)?.title || 'AI Legal Assistant') 
                  : 'New Chat'}
              </h2>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-4 lg:py-6 space-y-4 lg:space-y-6">
              {/* Display chat history */}
              {currentChat.length === 0 && !isTyping ? (
                 <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                    Send a message to start the legal consultation.
                 </div>
              ) : (
                currentChat.map((message) => {
                  // Special rendering for lawyer recommendation messages
                  if (message.role === 'assistant' && message.content.startsWith('__LAWYER_RECS__:')) {
                    const raw = message.content.replace('__LAWYER_RECS__:', '');
                    let recs: LawyerSuggestion[] = [];
                    try { recs = JSON.parse(raw); } catch {}
                    return (
                      <div key={message.id} className="flex justify-start w-full">
                        <div className="w-full max-w-[90%] space-y-3">
                          <p className="text-[14px] font-semibold text-foreground flex items-center gap-2">
                            <UserCheck className="w-4 h-4 text-secondary" />
                            Based on your case, here are the best-matched verified lawyers for you:
                          </p>
                          {recs.map((lawyer, i) => (
                            <div key={i} className="bg-white border border-border rounded-[12px] p-4 shadow-sm">
                              <div className="flex items-start justify-between gap-3 flex-wrap">
                                <div className="flex-1">
                                  <h4 className="text-[15px] font-semibold text-foreground">{lawyer.name}</h4>
                                  <p className="text-[13px] text-secondary font-medium">{lawyer.specialization}</p>
                                  <p className="text-[12px] text-muted-foreground">{lawyer.city} · {lawyer.experience}</p>
                                  <p className="text-[13px] text-slate-600 mt-2 italic">"{lawyer.reason}"</p>
                                </div>
                                <div className="flex flex-col gap-2 shrink-0">
                                  {lawyer.phone && (
                                    <a href={`tel:${lawyer.phone}`} className="text-[12px] bg-primary text-white px-3 py-1.5 rounded-full hover:bg-primary/90 transition-colors text-center">
                                      Call
                                    </a>
                                  )}
                                  {lawyer.email && (
                                    <a href={`mailto:${lawyer.email}`} className="text-[12px] border border-primary text-primary px-3 py-1.5 rounded-full hover:bg-primary/5 transition-colors text-center">
                                      Email
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={message.id}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`rounded-[10px] px-4 py-3 max-w-[70%] ${message.role === 'user'
                          ? 'bg-[#F1F5F9] text-foreground'
                          : 'bg-accent text-foreground'
                          }`}
                      >
                        <p className="text-[15px]">{message.content}</p>
                      </div>
                    </div>
                  );
                })
              )}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-accent text-foreground rounded-[10px] px-4 py-3 max-w-[70%] flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-secondary" />
                    <p className="text-[15px] text-muted-foreground">AI is thinking...</p>
                  </div>
                </div>
              )}
            </div>
            {/* Input Area */}
            <div className="p-4 lg:p-6 border-t border-border bg-white z-10 sticky bottom-0">
              <div className="relative flex items-center">
                <Input
                  type="text"
                  placeholder="Type your message..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSendMessage();
                    }
                  }}
                  className="w-full h-12 lg:h-14 pr-12 rounded-full border-border focus:border-primary text-[14px] lg:text-[15px] shadow-sm"
                  disabled={isTyping || isGeneratingSummary}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim() || isTyping || isGeneratingSummary}
                  className="absolute right-1 lg:right-2 w-10 h-10 lg:w-10 lg:h-10 rounded-full p-0 flex items-center justify-center bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
                  size="icon"
                >
                  <Send className="w-4 h-4 lg:w-5 lg:h-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}