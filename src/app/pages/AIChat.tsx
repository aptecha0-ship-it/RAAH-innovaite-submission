import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Header } from '../components/Header';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useAppContext } from '../context/AppContext';
import { MessageCircle, Send, Shield, Loader2, Trash2, Menu, X, UserCheck } from 'lucide-react';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

// Fetch active AI config from the server (model + api keys + generic prompt)
async function fetchAiConfig(): Promise<{ active_model: string; gemini_api_key: string; grok_api_key: string; system_prompt: string }> {
  const token = localStorage.getItem('auth_token');
  const res = await fetch('/api/chat-key', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Could not load AI configuration from server.');
  return res.json();
}

const DEFAULT_SYSTEM_PROMPT = `You are a compassionate, expert Legal Guide for RAAH — a platform that helps women in Pakistan understand their legal rights and options. Your specialty is domestic violence, khula, divorce, harassment, inheritance, and family law.

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
Good response: "I'm so sorry you're going through this — it takes real courage to even say those words. The good news is the law does have protections for both your home and your children. We can figure this out together, one step at a time. To start — is your biggest worry right now about staying safe in the house, or about the kids?"`;

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
  const [activeModel, setActiveModel] = useState<string>('gemini');

  // Fetch and cache active model label for display
  useEffect(() => {
    if (isAuthenticated) {
      fetchAiConfig().then(cfg => setActiveModel(cfg.active_model)).catch(() => {});
    }
  }, [isAuthenticated]);

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

  // Initial greeting prompt when a new blank session is started.
  // createNewSession() sets activeSessionId to null — that's our trigger.
  // addMessage auto-creates the session when the greeting is injected.
  useEffect(() => {
    if (isAuthenticated && activeSessionId === null) {
      addMessage({
        id: 'initial_greeting',
        role: 'assistant',
        content: "Hello. I am RAAH's Legal AI Assistant. I am here to help you understand your legal options safely and securely. How can I assist you today?"
      });
    }
  }, [isAuthenticated, activeSessionId]);

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

    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          userProfile,
          chatMessages: currentChat.slice(-8),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Could not load recommendations.');
      }

      const data = await res.json();
      const recommendations = data.recommendations || [];

      if (recommendations.length === 0) {
        addMessage({
          id: Date.now().toString(),
          role: 'assistant',
          content: "No matched lawyers were found yet. The administrator may need to approve and sync lawyer profiles first. Please try again later or browse the Lawyers page.",
        });
        return;
      }

      // Navigate to the dedicated matched-lawyers page, passing results via state
      navigate('/matched-lawyers', { state: { recommendations } });

    } catch (err: any) {
      console.error('Lawyer recommendation failed:', err);
      addMessage({
        id: Date.now().toString(),
        role: 'assistant',
        content: `I had trouble finding recommendations: ${err.message || 'Please try again in a moment.'}`,
      });
    } finally {
      setIsRecommending(false);
    }
  };


  const reportApiError = async (provider: string, errorMessage: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      await fetch('/api/ai-settings/report-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ provider, error_message: errorMessage })
      });
    } catch {
      // silently fail
    }
  };

  const callGrok = async (apiKey: string, systemPrompt: string, userMessage: string): Promise<string> => {
    const grokMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: systemPrompt },
    ];
    for (const msg of currentChat.filter(m => m.id !== 'initial_greeting')) {
      grokMessages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      });
    }
    grokMessages.push({ role: 'user', content: userMessage });

    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'grok-3', messages: grokMessages, temperature: 0.7 }),
    });
    
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody?.error?.message || `Grok API error ${res.status}`);
    }
    
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || 'I had trouble generating a response.';
  };

  const callGemini = async (apiKey: string, systemPrompt: string, userMessage: string): Promise<string> => {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash', 
      systemInstruction: systemPrompt,
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      ]
    });

    const rawHistory = currentChat.filter(msg => msg.id !== 'initial_greeting');
    const formattedHistory: { role: string; parts: { text: string }[] }[] = [];
    let lastRole = '';
    
    for (const msg of rawHistory) {
      const currentRole = msg.role === 'user' ? 'user' : 'model';
      if (formattedHistory.length === 0 && currentRole === 'model') {
        formattedHistory.push({ role: 'user', parts: [{ text: 'Hello' }] });
        lastRole = 'user';
      }
      if (currentRole === lastRole && formattedHistory.length > 0) {
        formattedHistory[formattedHistory.length - 1].parts[0].text += `\n\n[Message continued]\n${msg.content}`;
      } else {
        formattedHistory.push({ role: currentRole, parts: [{ text: msg.content }] });
      }
      lastRole = currentRole;
    }

    const chat = model.startChat({ history: formattedHistory });
    const result = await chat.sendMessage(userMessage);
    return result.response.text();
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isTyping) return;

    const userMessage = inputMessage;
    addMessage({
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
    });

    setInputMessage('');
    setIsTyping(true);

    try {
      const aiConfig = await fetchAiConfig();
      const primaryModel = aiConfig.active_model;
      const primaryKey = primaryModel === 'grok' ? aiConfig.grok_api_key : aiConfig.gemini_api_key;
      const secondaryModel = primaryModel === 'grok' ? 'gemini' : 'grok';
      const secondaryKey = primaryModel === 'grok' ? aiConfig.gemini_api_key : aiConfig.grok_api_key;

      if (!primaryKey && !secondaryKey) {
          throw new Error('No API key configured. Please ask the admin to set up an AI API key.');
      }

      const basePrompt = aiConfig.system_prompt && aiConfig.system_prompt.trim() !== '' 
        ? aiConfig.system_prompt 
        : DEFAULT_SYSTEM_PROMPT;

      const systemPromptText = `${basePrompt}

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

      let responseText = '';
      
      try {
        if (!primaryKey) throw new Error(`${primaryModel} key is missing.`);
        
        // Attempt Primary Model
        responseText = primaryModel === 'grok' 
            ? await callGrok(primaryKey, systemPromptText, userMessage)
            : await callGemini(primaryKey, systemPromptText, userMessage);
            
      } catch (primaryError: any) {
        console.warn(`Primary model (${primaryModel}) failed:`, primaryError.message);
        reportApiError(primaryModel, primaryError.message || String(primaryError));

        if (secondaryKey) {
            console.log(`Falling back to secondary model (${secondaryModel})...`);
            try {
                responseText = secondaryModel === 'grok'
                    ? await callGrok(secondaryKey, systemPromptText, userMessage)
                    : await callGemini(secondaryKey, systemPromptText, userMessage);
            } catch (secondaryError: any) {
                console.error(`Secondary model (${secondaryModel}) also failed:`, secondaryError.message);
                reportApiError(secondaryModel, secondaryError.message || String(secondaryError));
                throw new Error('Both AI models failed to respond.');
            }
        } else {
            throw primaryError;
        }
      }

      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseText,
      });
    } catch (error: any) {
      console.error('Error calling AI API:', error);
      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: error?.message?.includes('No API key')
          ? 'The AI chatbot is not configured yet. Please contact the administrator to set up an API key.'
          : 'I apologize, but I am currently experiencing technical difficulties connecting to my knowledge base.',
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
              <div className="flex items-center gap-1.5 pt-1">
                <Shield className="w-3 h-3 text-slate-400" />
                <span className="text-[11px] text-slate-400">
                  Powered by {activeModel === 'grok' ? 'xAI Grok' : 'Google Gemini'}
                </span>
              </div>
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