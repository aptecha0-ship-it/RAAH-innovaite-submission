import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
}

export interface GuidanceSummary {
  identifiedIssue: string;
  relevantLaw: string[];
  legalSteps: string[];
  requiredDocuments: string[];
  urgencyLevel: 'high' | 'medium' | 'low';
  immediateSafeActions?: string[];
  nextStepRecommendation?: string;
}

export interface Lawyer {
  id: string;
  name: string;
  city: string;
  specialization: string;
  experience: string;
  rating: number;
  verified: boolean;
  phone?: string | null;
  email?: string | null;
  chamberAddress?: string | null;
}

export interface UserProfile {
  safetyStatus: string;
  province: string;
  legalConcern: string;
  emergencyStatus: string;
  issueDuration: string;
  legalProceedings: string;
  evidence: string;
  incidentDescription: string;
  preferredOutcome: string;
  consultantPreference: string;
}

export interface LawyerProfile {
  id: string;
  full_name: string;
  bar_council_number: string;
  bar_council_name: string;
  chamber_address: string;
  city: string;
  practice_areas: string;
  years_of_experience: string;
  phone: string;
  cnic: string;
  status?: string;
}

interface AppContextType {
  chatSessions: ChatSession[];
  activeSessionId: string | null;
  addMessage: (message: ChatMessage) => void;
  setRawChatHistory: (data: any) => void; // Used during hydration
  createNewSession: () => void;
  switchSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
  clearAllSessions: () => void;
  guidanceSummary: GuidanceSummary | null;
  setGuidanceSummary: (summary: GuidanceSummary | null) => void;
  selectedLawyer: Lawyer | null;
  setSelectedLawyer: (lawyer: Lawyer | null) => void;
  consentGiven: boolean;
  setConsentGiven: (consent: boolean) => void;
  userProfile: UserProfile | null;
  setUserProfile: (profile: UserProfile | null) => void;
  isAuthenticated: boolean;
  setIsAuthenticated: (auth: boolean) => void;
  interviewCompleted: boolean;
  setInterviewCompleted: (completed: boolean) => void;
  userRole: string;
  setUserRole: (role: string) => void;
  lawyerOnboardingCompleted: boolean;
  setLawyerOnboardingCompleted: (completed: boolean) => void;
  userEmail: string;
  setUserEmail: (email: string) => void;
  lawyerProfile: LawyerProfile | null;
  setLawyerProfile: (profile: LawyerProfile | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, _setActiveSessionId] = useState<string | null>(null);
  const activeSessionIdRef = useRef<string | null>(null);

  const setActiveSessionId = (id: string | null) => {
    activeSessionIdRef.current = id;
    _setActiveSessionId(id);
  };
  const [guidanceSummary, setGuidanceSummary] = useState<GuidanceSummary | null>(null);
  const [selectedLawyer, setSelectedLawyer] = useState<Lawyer | null>(null);
  const [consentGiven, setConsentGiven] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [interviewCompleted, setInterviewCompleted] = useState(false);
  const [userRole, setUserRole] = useState('user');
  const [lawyerOnboardingCompleted, setLawyerOnboardingCompleted] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [lawyerProfile, setLawyerProfile] = useState<LawyerProfile | null>(null);

  // Helper to safely parse and migrate incoming history data
  const hydrateHistory = (data: any, userEmail: string) => {
    if (!data) return;
    
    let parsedData = data;
    if (typeof data === 'string') {
      try {
        parsedData = JSON.parse(data);
      } catch (e) {
        return;
      }
    }

    if (Array.isArray(parsedData)) {
      if (parsedData.length === 0) {
        setChatSessions([]);
        setActiveSessionId(null);
        return;
      }

      // Check if it's the legacy format (array of messages)
      if (parsedData[0].role !== undefined && parsedData[0].content !== undefined) {
        const legacySession: ChatSession = {
          id: 'legacy-session-1',
          title: 'Previous Conversation',
          messages: parsedData,
          updatedAt: Date.now()
        };
        setChatSessions([legacySession]);
        setActiveSessionId(legacySession.id);
      } else if (parsedData[0].messages !== undefined) {
        // It's already the new format (array of sessions)
        setChatSessions(parsedData);
        if (parsedData.length > 0) {
          // Sort by newest and set active
          const sorted = [...parsedData].sort((a, b) => b.updatedAt - a.updatedAt);
          setActiveSessionId(sorted[0].id);
        }
      }
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        try {
          const res = await fetch('/api/me', {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            setIsAuthenticated(true);
            setInterviewCompleted(data.user.interview_completed);
            setUserRole(data.user.role || 'user');
            setLawyerOnboardingCompleted(data.user.lawyer_onboarding_completed || false);
            setUserEmail(data.user.email || '');
            setLawyerProfile(data.user.lawyer_profile || null);
            
            if (data.user.profile_summary) {
              setUserProfile(data.user.profile_summary);
            }
            if (data.user.chat_history) {
              hydrateHistory(data.user.chat_history, data.user.email);
            } else if (data.user.email) {
              // Fallback to local
              const stored = localStorage.getItem(`chat_history_${data.user.email}`);
              if (stored) hydrateHistory(stored, data.user.email);
            }
          } else {
            localStorage.removeItem('auth_token');
            setIsAuthenticated(false);
            setUserEmail('');
            setLawyerProfile(null);
            setUserRole('user');
            setLawyerOnboardingCompleted(false);
            setChatSessions([]);
            setActiveSessionId(null);
          }
        } catch (err) {
          console.error('Auth verification failed', err);
          setIsAuthenticated(false);
          setUserEmail('');
          setLawyerProfile(null);
        }
      }
    };
    checkAuth();
  }, []);

  // Local fallback if no backend history exists, handled in checkAuth already
  useEffect(() => {
    if (userEmail && chatSessions.length === 0) {
      const storedChat = localStorage.getItem(`chat_history_${userEmail}`);
      if (storedChat) {
        hydrateHistory(storedChat, userEmail);
      }
    }
  }, [userEmail]);

  const syncChatToBackend = (sessions: ChatSession[]) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      fetch('/api/user/chat-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ history: sessions })
      }).catch(err => console.error("Failed to sync chat sessions out of band", err));
    }
  };

  const addMessage = (message: ChatMessage) => {
    setChatSessions((prevSessions) => {
      let currentSessions = [...prevSessions];
      let targetSessionId = activeSessionIdRef.current; // ALWAYS USE REF HERE TO AVOID STALE CLOSURES

      // If no active session, create one
      if (!targetSessionId) {
        const newSession: ChatSession = {
          id: Date.now().toString(),
          title: message.role === 'user' ? message.content.substring(0, 30) + '...' : 'New Chat',
          messages: [],
          updatedAt: Date.now()
        };
        currentSessions.unshift(newSession);
        targetSessionId = newSession.id;
        
        // Update both the ref synchronously and the state asynchronously
        activeSessionIdRef.current = newSession.id;
        setTimeout(() => _setActiveSessionId(newSession.id), 0);
      }

      // Find and update the target session
      const sessionIndex = currentSessions.findIndex(s => s.id === targetSessionId);
      if (sessionIndex >= 0) {
        currentSessions[sessionIndex] = {
          ...currentSessions[sessionIndex],
          messages: [...currentSessions[sessionIndex].messages, message],
          updatedAt: Date.now(),
          // Update title if it's currently generic and user sends first message
          title: (currentSessions[sessionIndex].title === 'New Chat' && message.role === 'user') 
                 ? message.content.substring(0, 30) + '...' 
                 : currentSessions[sessionIndex].title
        };
      }

      // Sort sessions so most recently updated is first
      currentSessions.sort((a, b) => b.updatedAt - a.updatedAt);

      if (userEmail) {
        localStorage.setItem(`chat_history_${userEmail}`, JSON.stringify(currentSessions));
      }
      syncChatToBackend(currentSessions);
      
      return currentSessions;
    });
  };

  const createNewSession = () => {
    setActiveSessionId(null);
  };

  const switchSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
  };

  const deleteSession = (sessionId: string) => {
    setChatSessions((prev) => {
      const filtered = prev.filter(s => s.id !== sessionId);
      if (userEmail) {
        localStorage.setItem(`chat_history_${userEmail}`, JSON.stringify(filtered));
      }
      syncChatToBackend(filtered);
      
      // If we are deleting the active session, switch to the newest available or null
      if (activeSessionIdRef.current === sessionId) {
        const nextActive = filtered.length > 0 ? filtered[0].id : null;
        activeSessionIdRef.current = nextActive;
        setTimeout(() => _setActiveSessionId(nextActive), 0);
      }
      
      return filtered;
    });
  };

  const clearAllSessions = () => {
    setChatSessions([]);
    activeSessionIdRef.current = null;
    setTimeout(() => _setActiveSessionId(null), 0);
    if (userEmail) {
      localStorage.setItem(`chat_history_${userEmail}`, JSON.stringify([]));
    }
    syncChatToBackend([]);
  };

  const setRawChatHistoryWithStorage = (data: any) => {
    hydrateHistory(data, userEmail);
    // Note: Local storage and backend sync will trigger on next message addition
  };

  const setUserProfileWithStorage = (profile: UserProfile | null) => {
    setUserProfile(profile);
    const token = localStorage.getItem('auth_token');
    if (token && profile) {
      fetch('/api/user/profile-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ summary: profile })
      }).catch(err => console.error("Failed to sync profile summary out of band", err));
    }
  };

  return (
    <AppContext.Provider
      value={{
        chatSessions,
        activeSessionId,
        addMessage,
        setRawChatHistory: setRawChatHistoryWithStorage,
        createNewSession,
        switchSession,
        deleteSession,
        clearAllSessions,
        guidanceSummary,
        setGuidanceSummary,
        selectedLawyer,
        setSelectedLawyer,
        consentGiven,
        setConsentGiven,
        userProfile,
        setUserProfile: setUserProfileWithStorage,
        isAuthenticated,
        setIsAuthenticated,
        interviewCompleted,
        setInterviewCompleted,
        userRole,
        setUserRole,
        lawyerOnboardingCompleted,
        setLawyerOnboardingCompleted,
        userEmail,
        setUserEmail,
        lawyerProfile,
        setLawyerProfile,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};