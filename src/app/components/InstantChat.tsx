import { useState, useEffect, useRef } from 'react';
import { Send, Loader2, X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface Message {
  id: number;
  consultation_id: number;
  sender_id: number;
  sender_role: string;
  sender_email: string;
  message: string;
  created_at: string;
}

interface InstantChatProps {
  consultationId: number | null;
  onClose: () => void;
  currentUserRole?: string;
  otherPartyName?: string;
}

export function InstantChat({ consultationId, onClose, currentUserRole = 'user', otherPartyName = 'User' }: InstantChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!consultationId) return;

    const fetchMessages = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const res = await fetch(`/api/consultations/${consultationId}/messages`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (res.ok) {
          const data = await res.json();
          setMessages(data);
        }
      } catch (err) {
        console.error('Failed to fetch messages:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();

    // Poll for new messages every 3 seconds
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [consultationId]);

  useEffect(() => {
    // Auto-scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || !consultationId) return;

    setSending(true);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/consultations/${consultationId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ message: newMessage })
      });

      if (res.ok) {
        const newMsg = await res.json();
        // Optimistically add to UI with minimal required info
        setMessages(prev => [...prev, { 
          ...newMsg, 
          sender_role: currentUserRole,
          sender_email: 'You' 
        }]);
        setNewMessage('');
      } else {
        const errData = await res.json();
        alert(`Failed to send: ${errData.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  if (!consultationId) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 sm:p-6 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-[0_24px_48px_-12px_rgba(0,0,0,0.18)] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200 aspect-[3/4] max-h-[800px]">
        {/* Header */}
        <div className="bg-secondary p-4 flex items-center justify-between shadow-sm z-10">
          <div className="text-white">
            <h3 className="font-semibold text-[16px]">Secure Chat with {otherPartyName}</h3>
            <p className="text-[12px] opacity-80 flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Real-time messaging active
            </p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
            aria-label="Close chat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message View */}
        <div className="flex-1 bg-slate-50 p-4 overflow-y-auto flex flex-col gap-3 relative">
          {loading && messages.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-secondary/50" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground my-8">
              <p className="text-[14px]">No messages yet.</p>
              <p className="text-[12px] opacity-70 mt-1">Send a message to start the conversation.</p>
            </div>
          ) : (
            // Message List
            messages.map((msg, index) => {
              const isMine = msg.sender_role === currentUserRole || msg.sender_email === 'You';
              return (
                <div 
                  key={msg.id || index} 
                  className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-2 duration-300 fill-mode-both`}
                  style={{ animationDelay: `${Math.min(index * 50, 500)}ms` }}
                >
                  <div 
                    className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-[14px] leading-relaxed shadow-sm ${
                      isMine 
                        ? 'bg-secondary text-white rounded-tr-sm' 
                        : 'bg-white border border-slate-100 text-slate-700 rounded-tl-sm'
                    }`}
                  >
                    {msg.message}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 px-1 font-medium">
                    {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                  </span>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} className="h-4 w-full flex-shrink-0" />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-slate-100">
          <form 
            onSubmit={handleSendMessage}
            className="flex items-end gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200 focus-within:border-secondary/50 focus-within:ring-2 focus-within:ring-secondary/20 transition-all"
          >
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              disabled={sending}
              className="bg-transparent border-0 focus-visible:ring-0 shadow-none px-3 min-h-[44px]"
            />
            <Button 
              type="submit" 
              disabled={sending || !newMessage.trim()}
              className="h-10 w-10 p-0 rounded-xl bg-secondary hover:bg-secondary/90 text-white shadow-sm flex-shrink-0"
              aria-label="Send message"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </form>
          <div className="text-center mt-2">
            <p className="text-[10px] text-slate-400 font-medium tracking-wide">END-TO-END SECURE CHAT</p>
          </div>
        </div>
      </div>
    </div>
  );
}
