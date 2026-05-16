'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ToastProvider';
import { CHAT_MAX_CHARS, CHAT_MAX_QUERIES_PER_DAY } from '@/lib/chat-security';

// ─── Types ───────────────────────────────────────────────────────────────────

type Role = 'STUDENT' | 'FACULTY' | 'INDUSTRY_PARTNER' | 'ADMIN';

interface ChatWidgetProps {
  user: { name: string; email: string; role: string } | null;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  timestamp: Date;
  error?: boolean;
  action?: {
    type: 'REGISTRATION' | 'UPDATE_PROFILE' | 'APPLY' | 'ANALYZE_SKILLS' | 'MOCK_INTERVIEW' | 'BOOK_FACILITY' | 'SHOW_OPTIONS' | 'INTERNSHIP_CARDS' | 'HACKATHON_CARDS';
    payload: any;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ROLE_PLACEHOLDER: Record<string, string> = {
  STUDENT: 'Ask about internships, hackathons, workshops…',
  FACULTY: 'Ask about grants, funding, research opportunities…',
  INDUSTRY_PARTNER: 'Search for students by skill, year, domain…',
  ADMIN: 'Ask anything about opportunities or the system…',
};

const ROLE_COLOR: Record<string, string> = {
  STUDENT: '#d97706', // Orange/Amber
  FACULTY: '#5a0090',
  INDUSTRY_PARTNER: '#8c4f00',
  ADMIN: '#002155',
};

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ChatWidget({ user }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [queriesRemaining, setQueriesRemaining] = useState<number>(100);
  const { pushToast } = useToast();
  const [sessionId] = useState(() => `session-${generateId()}`);
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  const [dashboardStats, setDashboardStats] = useState({ profile: 0, internships: 0, hackathons: 0 });

  // WebSocket for Push Notifications
  useEffect(() => {
    if (!user?.id) return;
    const ws = new WebSocket(`ws://localhost:8001/ws/notifications/${user.id}`);
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'BOOKING_APPROVED') {
          setIsOpen(true);
          const newMsg: Message = {
            id: Date.now().toString(),
            role: 'assistant',
            content: data.message,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, newMsg]);
          
          if (!isMuted) {
            const utterance = new SpeechSynthesisUtterance(data.message);
            window.speechSynthesis.speak(utterance);
          }
          pushToast('Booking Approved!', 'success');
        }
      } catch (e) {
        console.error("Failed to parse WS message", e);
      }
    };

    return () => {
      ws.close();
    };
  }, [user?.id, pushToast, isMuted]);

  useEffect(() => {
    if (isOpen) {
      const fetchStats = async () => {
        try {
          const [profileRes, statsRes] = await Promise.all([
            fetch('/api/profile/check-completion'),
            fetch('/api/chat/stats')
          ]);
          
          const profileData = profileRes.ok ? await profileRes.json() : { completionPercentage: 0 };
          const statsData = statsRes.ok ? await statsRes.json() : { data: { internshipsCount: 0, hackathonsCount: 0 } };
          
          setDashboardStats({
            profile: profileData.completionPercentage || 0,
            internships: statsData.data?.internshipsCount || 0,
            hackathons: statsData.data?.hackathonsCount || 0,
          });
        } catch (error) {
          console.error("Failed to fetch dashboard stats", error);
        }
      };
      fetchStats();
    }
  }, [isOpen]);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => {
        setIsListening(false);
      };
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        
        // Auto-send the voice note after a brief delay
        setTimeout(() => {
          const sendBtn = document.getElementById('chat-widget-send');
          if (sendBtn && !sendBtn.hasAttribute('disabled')) {
            sendBtn.click();
          }
        }, 500);
      };
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };
      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      recognitionRef.current?.start();
    }
  };

  const cleanTextForSpeech = (text: string) => {
    return text
      .replace(/[\*\#\_]/g, '') // Remove markdown artifacts
      .replace(/\n+/g, '. ')    // Replace newlines with pause-inducing dots
      .trim();
  };

  const speak = (text: string) => {
    if (isMuted) return;
    const utterance = new SpeechSynthesisUtterance(cleanTextForSpeech(text));
    
    // Better logic to find a high-quality female voice
    const voices = window.speechSynthesis.getVoices();
    
    // Known female voice patterns
    const isFemale = (v: SpeechSynthesisVoice) => 
      /female|samantha|zira|victoria|moira|susan|google\s+uk\s+english\s+female|google\s+us\s+english/i.test(v.name) ||
      (v.lang.startsWith('en') && !/male|david|mark|alex/i.test(v.name));

    const premiumFemaleVoice = voices.find(v => 
      isFemale(v) && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Premium'))
    ) || voices.find(isFemale) || voices.find(v => v.lang.startsWith('en')) || voices[0];

    if (premiumFemaleVoice) {
      utterance.voice = premiumFemaleVoice;
      utterance.lang = premiumFemaleVoice.lang;
    }
    
    utterance.rate = 1.0;
    utterance.pitch = 1.1; 
    
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  // Ensure voices are loaded and handle async loading
  useEffect(() => {
    const loadVoices = () => {
      window.speechSynthesis.getVoices();
    };
    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  const formatMessage = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, i) => {
      let formattedLine: React.ReactNode = line;
      
      // Basic markdown link parser [text](url)
      const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
      if (linkRegex.test(line)) {
        const parts = [];
        let lastIndex = 0;
        let match;
        // Reset regex state just in case
        linkRegex.lastIndex = 0;
        
        while ((match = linkRegex.exec(line)) !== null) {
          if (match.index > lastIndex) {
            parts.push(line.substring(lastIndex, match.index));
          }
          parts.push(
            <a key={match.index} href={match[2]} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline font-semibold">
              {match[1]}
            </a>
          );
          lastIndex = linkRegex.lastIndex;
        }
        if (lastIndex < line.length) {
          parts.push(line.substring(lastIndex));
        }
        formattedLine = parts;
      }

      if (line.trim().startsWith('*') || line.trim().startsWith('-')) {
        return (
          <div key={i} className="flex gap-2 ml-1 mt-1">
            <span className="text-blue-500">•</span>
            <span>{formattedLine}</span>
          </div>
        );
      }
      return <p key={i} className={line.trim() === '' ? 'h-2' : 'mb-1'}>{formattedLine}</p>;
    });
  };

  // Only render if logged in
  if (!user) return null;

  const role = user.role as Role;
  const accentColor = ROLE_COLOR[role] ?? '#002155';
  const placeholder = ROLE_PLACEHOLDER[role] ?? 'Ask anything…';

  // Fetch remaining queries on open
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/chat', { method: 'GET' });
      if (res.ok) {
        const data = await res.json();
        setQueriesRemaining(data.data?.queries_remaining ?? CHAT_MAX_QUERIES_PER_DAY);
      }
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, fetchStatus]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleBookFacility = async (payload: any) => {
    setLoading(true);
    try {
      const res = await fetch('/api/chat/book-lab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        pushToast("Booking request sent for approval!", "success");
        setMessages(prev => prev.map(m => {
          if (m.action?.type === 'BOOK_FACILITY' && m.action.payload === payload) {
            return {
              ...m,
              action: {
                type: 'BOOK_FACILITY',
                payload: { ...payload, confirmed: true, bookingId: data.data?.booking?.id || 'COE-2026-X-B' }
              }
            };
          }
          return m;
        }));
        window.dispatchEvent(new Event('booking-updated'));
      } else {
        throw new Error(data.message);
      }
    } catch (err: any) {
      pushToast(`Booking failed: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  // Keyboard: Ctrl+Enter to send, Esc to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    // Client-side length guard
    if (text.length > CHAT_MAX_CHARS) return;

    const isInternshipIntent = text.toLowerCase().includes('find internships') || text.toLowerCase().includes('internship') || text.toLowerCase().includes('internships');
    const isHackathonIntent = text.toLowerCase().includes('show me hackathons') || text.toLowerCase().includes('hackathon') || text.toLowerCase().includes('hackathons');
    if (isInternshipIntent || isHackathonIntent) {
      const newUserMsg: Message = {
        id: generateId(),
        role: 'user',
        content: text,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, newUserMsg]);
      setInput('');
      setLoading(true);

      if (isInternshipIntent) {
        try {
          const res = await fetch('/api/chat/internships');
          const data = await res.json();
          const botMsg: Message = {
            id: generateId(),
            role: 'assistant',
            content: "Here are some of the latest tech internships tailored for you:",
            timestamp: new Date(),
            action: {
              type: 'INTERNSHIP_CARDS',
              payload: { internships: data.data || [] }
            }
          };
          setMessages(prev => [...prev, botMsg]);
        } catch(e) {
          console.error(e);
        }
      } else if (isHackathonIntent) {
        try {
          const res = await fetch('/api/chat/hackathons');
          const data = await res.json();
          const botMsg: Message = {
            id: generateId(),
            role: 'assistant',
            content: "I've found some exciting hackathons for you. Check them out!",
            timestamp: new Date(),
            action: {
              type: 'HACKATHON_CARDS',
              payload: { hackathons: data.data || [] }
            }
          };
          setMessages(prev => [...prev, botMsg]);
        } catch(e) {
          console.error(e);
        }
      }

      setLoading(false);
      return;
    }

    const userMsg: Message = {
      id: generateId(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, session_id: sessionId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            role: 'assistant',
            content: data.message ?? 'Something went wrong. Please try again.',
            timestamp: new Date(),
            error: true,
          },
        ]);
      } else {
          const ans = data.data.answer.toLowerCase();
          const isRegistration = /\bregister\b/.test(ans) || /\bform\b/.test(ans);
          
          // Profile Update Intent Detection
          if (text.toLowerCase().includes('add skill') || text.toLowerCase().includes('my skills are')) {
            const skill = text.split(/add skill|my skills are/i)[1]?.trim();
            if (skill) {
              await fetch('/api/profile', {
                method: 'PATCH',
                body: JSON.stringify({ skills: skill }),
                headers: { 'Content-Type': 'application/json' }
              });
              pushToast(`Skill "${skill}" added to your profile!`, "success");
            }
          }

          if (data.data.action?.type === 'UPDATE_PROFILE') {
             const { field, value } = data.data.action.payload;
             await fetch('/api/profile', {
                method: 'PATCH',
                body: JSON.stringify({ [field]: value }),
                headers: { 'Content-Type': 'application/json' }
              });
              pushToast(`${field.charAt(0).toUpperCase() + field.slice(1)} updated!`, "success");
          }

          setMessages((prev) => [
            ...prev,
            {
              id: generateId(),
              role: 'assistant',
              content: data.data.answer,
              sources: data.data.sources,
              timestamp: new Date(),
              action: data.data.action || (isRegistration ? {
                type: 'REGISTRATION',
                payload: {
                  title: 'AI Innovation Hackathon 2026',
                  date: 'Oct 15, 2026',
                  location: 'Main Auditorium, TCET'
                }
              } : undefined)
            },
          ]);
          setQueriesRemaining(data.data.queries_remaining ?? 0);
          speak(data.data.answer);
        }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: 'assistant',
          content: 'Unable to reach the AI assistant. Please check your connection and try again.',
          timestamp: new Date(),
          error: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== 'application/pdf') return;

    setLoading(true);
    setMessages((prev) => [...prev, {
      id: generateId(),
      role: 'user',
      content: `Uploaded resume: ${file.name}`,
      timestamp: new Date(),
    }]);

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Call the Python backend directly or via proxy
      const res = await fetch('http://localhost:8001/extract-resume', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        const skills = data.skills;
        setMessages((prev) => [...prev, {
          id: generateId(),
          role: 'assistant',
          content: `I've extracted the following skills from your resume: **${skills}**. I've added them to your profile!`,
          timestamp: new Date(),
        }]);

        // Auto-update profile
        await fetch('/api/profile', {
          method: 'PATCH',
          body: JSON.stringify({ skills }),
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        throw new Error(data.message);
      }
    } catch (err: any) {
      console.error('Resume processing error:', err);
      setMessages((prev) => [...prev, {
        id: generateId(),
        role: 'assistant',
        content: `Sorry, I couldn't process your resume: ${err.message || 'Unknown error'}. Please ensure the PDF is not password protected and try again.`,
        timestamp: new Date(),
        error: true,
      }]);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const charsLeft = CHAT_MAX_CHARS - input.length;
  const isOverLimit = charsLeft < 0;
  const isExhausted = queriesRemaining <= 0;

  return (
    <>
      {/* ── Floating Button ─────────────────────────────────────────────── */}
      <button
        id="chat-widget-toggle"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={isOpen ? 'Close AI assistant' : 'Open AI assistant'}
        style={{ backgroundColor: isOpen ? '#434651' : accentColor }}
        className="fixed bottom-6 right-6 z-50 w-20 h-20 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 group overflow-hidden border-2 border-white/20"
      >
        <div className="relative w-full h-full flex items-center justify-center">
          {isOpen ? (
            <span
              className="material-symbols-outlined text-white text-3xl z-10 transition-all duration-500"
              style={{ transform: 'rotate(180deg)' }}
            >
              close
            </span>
          ) : (
            <img
              src="/bot-avatar.png"
              alt="AI Assistant"
              className="w-full h-full object-cover z-10 transition-all duration-500 scale-125"
            />
          )}
        </div>
      </button>

      {/* ── Chat Panel ──────────────────────────────────────────────────── */}
      <div
        id="chat-widget-panel"
        className={`fixed bottom-24 right-6 z-50 w-[550px] max-w-[calc(100vw-1.5rem)] flex flex-col bg-white border border-[#c4c6d3] shadow-2xl transition-all duration-300 origin-bottom-right rounded-t-3xl overflow-hidden ${
          isOpen
            ? 'opacity-100 scale-100 pointer-events-auto'
            : 'opacity-0 scale-90 pointer-events-none'
        }`}
        style={{ maxHeight: '750px', height: isOpen ? '750px' : 'auto' }}
        role="dialog"
        aria-label="AI Assistant"
        aria-modal="false"
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-4"
          style={{ backgroundColor: '#002155' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full overflow-hidden border-[3px] border-[#d97706] bg-[#002155] flex items-center justify-center p-1">
              <img src="/bot-avatar.png" alt="Veda Avatar" className="w-full h-full object-contain" style={{ filter: 'brightness(1.5) sepia(1) hue-rotate(180deg) saturate(3)' }} />
            </div>
            <div>
              <p className="text-white text-[18px] font-bold leading-tight tracking-wide">
                Veda
              </p>
              <p className="text-[#d97706] text-[10px] font-bold leading-tight mt-0.5 uppercase tracking-wide">
                AI Assistant for {role.replace('_', ' ')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsMuted(!isMuted)}
              className="text-white hover:text-[#d97706] transition-colors"
              title={isMuted ? 'Unmute Veda' : 'Mute Veda'}
            >
              <span className="material-symbols-outlined text-[20px]">
                {isMuted ? 'volume_off' : 'volume_up'}
              </span>
            </button>
            <button className="text-white hover:text-[#d97706] transition-colors">
              <span className="material-symbols-outlined text-[20px]">translate</span>
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white hover:text-[#d97706] transition-colors"
              aria-label="Close"
            >
              <span className="material-symbols-outlined text-[24px]">close</span>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3 custom-scrollbar bg-[#f9fafb]">
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-4 py-2 w-full">
              
              {/* Welcome Card */}
              <div className="w-full bg-white rounded-xl p-4 shadow-sm border border-[#e5e7eb] border-l-4 border-l-[#fcd34d]">
                <h2 className="text-[15px] font-extrabold text-[#002155] mb-1">
                  Good afternoon, {user?.name.split(' ')[0]}! 👋
                </h2>
                <p className="text-[#6b7280] text-[12px]">How can I help you today?</p>
              </div>

              {/* Dashboard Stats */}
              <div className="w-full flex justify-between gap-2">
                <div className="flex-1 bg-white rounded-xl p-3 shadow-sm border border-[#e5e7eb] flex flex-col justify-between">
                  <p className="text-[10px] font-bold text-[#6b7280]">Profile Completion</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[18px] font-bold text-[#002155]">{dashboardStats.profile}%</span>
                    <div className="w-6 h-6 rounded-full border-[3px] border-[#e5e7eb] border-t-[#d97706] border-r-[#d97706]"></div>
                  </div>
                </div>
                <div className="flex-1 bg-white rounded-xl p-3 shadow-sm border border-[#e5e7eb] flex flex-col justify-between">
                  <p className="text-[10px] font-bold text-[#3b82f6]">New Internships</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[18px] font-bold text-[#002155]">{dashboardStats.internships}</span>
                    <span className="material-symbols-outlined text-[#3b82f6] text-[20px]">work</span>
                  </div>
                </div>
                <div className="flex-1 bg-white rounded-xl p-3 shadow-sm border border-[#e5e7eb] flex flex-col justify-between">
                  <p className="text-[10px] font-bold text-[#10b981]">Hackathons</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[18px] font-bold text-[#002155]">{dashboardStats.hackathons}</span>
                    <span className="material-symbols-outlined text-[#10b981] text-[20px]">emoji_events</span>
                  </div>
                </div>
              </div>

              {/* Initial Bot Bubble */}
              <div className="flex gap-2 items-start w-full mt-2">
                <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-[#002155] border-2 border-[#d97706] p-0.5 shadow-sm">
                  <img src="/bot-avatar.png" alt="Avatar" className="w-full h-full object-contain" style={{ filter: 'brightness(1.5) sepia(1) hue-rotate(180deg) saturate(3)' }} />
                </div>
                <div className="bg-[#eff6ff] p-3 rounded-2xl rounded-tl-none text-[12px] text-[#002155] font-medium leading-relaxed shadow-sm border border-[#dbeafe]">
                  Hi! I'm Veda, your virtual assistant. You can select an option below or ask me anything about internships, hackathons, workshops and more.
                  <p className="text-[9px] text-[#9ca3af] mt-1 font-normal">01:04 PM</p>
                </div>
              </div>
              
              {/* Vertical Action Menu */}
              <div className="w-full bg-white rounded-xl p-3 shadow-sm border border-[#e5e7eb] mt-1">
                <p className="text-[12px] font-extrabold text-[#002155] mb-3 flex items-center gap-1">
                  What would you like to do? <span className="text-[#d97706]">-</span>
                </p>
                
                <div className="flex flex-col gap-2">
                  <button onClick={() => { setInput('I want to set up my profile'); setTimeout(() => document.getElementById('chat-widget-send')?.click(), 100); }} className="w-full flex items-center gap-3 p-2 border border-[#f3f4f6] rounded-lg hover:bg-[#f9fafb] transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-[#fff7ed] flex items-center justify-center text-[#d97706]">
                      <span className="material-symbols-outlined text-[18px]">person</span>
                    </div>
                    <div className="text-left flex-1">
                      <p className="text-[12px] font-bold text-[#002155]">Profile Setup</p>
                      <p className="text-[10px] text-[#6b7280]">Complete your profile</p>
                    </div>
                  </button>

                  <button onClick={() => { setInput('Find internships'); setTimeout(() => document.getElementById('chat-widget-send')?.click(), 100); }} className="w-full flex items-center gap-3 p-2 border border-[#f3f4f6] rounded-lg hover:bg-[#f9fafb] transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-[#eff6ff] flex items-center justify-center text-[#3b82f6]">
                      <span className="material-symbols-outlined text-[18px]">work</span>
                    </div>
                    <div className="text-left flex-1">
                      <p className="text-[12px] font-bold text-[#002155]">Find Internships</p>
                      <p className="text-[10px] text-[#6b7280]">Explore latest opportunities</p>
                    </div>
                  </button>

                  <button onClick={() => { setInput('Show me hackathons'); setTimeout(() => document.getElementById('chat-widget-send')?.click(), 100); }} className="w-full flex items-center gap-3 p-2 border border-[#f3f4f6] rounded-lg hover:bg-[#f9fafb] transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-[#ecfdf5] flex items-center justify-center text-[#10b981]">
                      <span className="material-symbols-outlined text-[18px]">code</span>
                    </div>
                    <div className="text-left flex-1">
                      <p className="text-[12px] font-bold text-[#002155]">Hackathons</p>
                      <p className="text-[10px] text-[#6b7280]">Browse upcoming hackathons</p>
                    </div>
                  </button>

                  <button onClick={() => { setInput('Book a lab'); setTimeout(() => document.getElementById('chat-widget-send')?.click(), 100); }} className="w-full flex items-center gap-3 p-2 border border-[#f3f4f6] rounded-lg hover:bg-[#f9fafb] transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-[#f5f3ff] flex items-center justify-center text-[#8b5cf6]">
                      <span className="material-symbols-outlined text-[18px]">meeting_room</span>
                    </div>
                    <div className="text-left flex-1">
                      <p className="text-[12px] font-bold text-[#002155]">Book a Lab</p>
                      <p className="text-[10px] text-[#6b7280]">Reserve a facility</p>
                    </div>
                  </button>
                </div>
                
                <button className="text-[11px] font-bold text-[#d97706] mt-3 flex items-center gap-1 hover:underline">
                  View all options <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </button>
              </div>

            </div>
          )}

          {messages.map((msg) => {
            let displayContent = msg.content;
            if (!displayContent && msg.action?.type === 'SHOW_OPTIONS') {
               const opts = msg.action.payload.options || [];
               if (opts.includes('AI Lab') || opts.includes('Mac Lab')) {
                 displayContent = "Which facility would you like to book?";
               } else if (opts.includes('09:00 - 11:00')) {
                 displayContent = "What time slot works best for you?";
               } else {
                 displayContent = "Please select an option:";
               }
            }

            const hasInlineAction = msg.action && msg.action.type !== 'SHOW_OPTIONS';
            const hasSources = msg.sources && msg.sources.length > 0 && !['SHOW_OPTIONS', 'BOOK_FACILITY'].includes(msg.action?.type || '');
            const showSpeechBubble = displayContent || hasInlineAction || hasSources;

            return (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} mb-3`}
            >
              {showSpeechBubble && (
              <div
                className={`max-w-[85%] px-3 py-2 text-[12px] leading-relaxed shadow-sm ${
                  msg.role === 'user'
                    ? 'text-white rounded-2xl rounded-tr-none'
                    : msg.error
                    ? 'bg-[#fff0f0] border border-[#ffcccc] text-[#8b0000] rounded-2xl rounded-tl-none'
                    : 'bg-[#f0f1f5] border border-[#e0e1e6] text-[#434651] rounded-2xl rounded-tl-none'
                }`}
                style={
                  msg.role === 'user'
                    ? { backgroundColor: accentColor }
                    : {}
                }
              >
                {displayContent && (
                  <div className="whitespace-pre-wrap">
                    {msg.role === 'assistant' ? formatMessage(displayContent) : displayContent}
                  </div>
                )}
                {msg.action?.type === 'REGISTRATION' && (
                  <div className="mt-3 bg-white border border-[#3b82f6]/20 rounded-xl p-3 shadow-sm">
                    <p className="text-[10px] font-bold text-[#d97706] uppercase tracking-wider mb-1">
                      Registration Form
                    </p>
                    <p className="text-[13px] font-bold text-[#002155]">
                      {msg.action.payload.title}
                    </p>
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center gap-1.5 text-[10px] text-[#747782]">
                        <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                        {msg.action.payload.date}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-[#747782]">
                        <span className="material-symbols-outlined text-[14px]">location_on</span>
                        {msg.action.payload.location}
                      </div>
                    </div>
                    <button className="w-full mt-3 bg-[#3b82f6] text-white py-1.5 rounded-lg text-[11px] font-bold hover:bg-[#2563eb] transition-colors">
                      Confirm & Submit
                    </button>
                  </div>
                )}
                
                {msg.action?.type === 'APPLY' && (
                  <div className="mt-3 bg-white border border-[#3b82f6]/20 rounded-xl p-3 shadow-sm">
                    <p className="text-[10px] font-bold text-green-600 uppercase tracking-wider mb-1">
                      One-Click Application
                    </p>
                    <p className="text-[13px] font-bold text-[#002155]">
                      {msg.action.payload.title || 'Opportunity Application'}
                    </p>
                    <p className="text-[10px] text-[#747782] mt-1">
                      Veda will use your complete profile to auto-fill the application.
                    </p>
                    <button 
                      onClick={() => pushToast('Application submitted successfully by Veda!', 'success')}
                      className="w-full mt-3 bg-green-600 text-white py-1.5 rounded-lg text-[11px] font-bold hover:bg-green-700 transition-colors flex items-center justify-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[14px]">send</span> Let Veda Apply
                    </button>
                  </div>
                )}

                {msg.action?.type === 'ANALYZE_SKILLS' && (
                  <div className="mt-3 bg-[#f8fafc] border border-blue-200 rounded-xl p-3 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="material-symbols-outlined text-blue-600 text-[18px]">analytics</span>
                      <p className="text-[12px] font-bold text-[#002155]">Skill Gap Analysis Complete</p>
                    </div>
                    <p className="text-[11px] text-[#434651]">
                      Your profile has been analyzed against the top trending opportunities.
                    </p>
                    <button 
                      onClick={() => pushToast('Opening full skill gap report...', 'info')}
                      className="w-full mt-3 bg-white border border-blue-600 text-blue-600 py-1.5 rounded-lg text-[11px] font-bold hover:bg-blue-50 transition-colors"
                    >
                      View Detailed Report
                    </button>
                  </div>
                )}

                {msg.action?.type === 'RESUME_ANALYSIS' && (
                  <div className="mt-3 bg-[#f8fafc] border border-blue-200 rounded-xl p-4 shadow-sm relative overflow-hidden">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="relative w-12 h-12 flex items-center justify-center bg-white rounded-full border-[3px] border-[#3b82f6] shadow-inner">
                        <span className="text-[14px] font-bold text-[#002155]">{msg.action.payload.score || 0}%</span>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-[#3b82f6] uppercase tracking-wider">ATS Match Score</p>
                        <p className="text-[13px] font-bold text-[#002155]">{msg.action.payload.role || 'Job Fit'}</p>
                      </div>
                    </div>
                    
                    {msg.action.payload.missing_skills && msg.action.payload.missing_skills.length > 0 && (
                      <div className="mt-3 border-t border-blue-100 pt-3">
                        <p className="text-[10px] font-bold text-[#434651] uppercase mb-1.5">Missing Skills to Acquire</p>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.action.payload.missing_skills.map((skill: string, i: number) => (
                            <span key={i} className="px-2 py-0.5 bg-[#fee2e2] text-[#b91c1c] text-[9px] font-bold rounded-full border border-[#fca5a5]">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {msg.action.payload.feedback && (
                      <p className="mt-3 text-[11px] text-[#434651] leading-relaxed bg-white p-2 rounded-lg border border-blue-50 italic">
                        "{msg.action.payload.feedback}"
                      </p>
                    )}
                  </div>
                )}

                {msg.action?.type === 'MOCK_INTERVIEW' && (
                  <div className="mt-3 bg-purple-50 border border-purple-200 rounded-xl p-3 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="material-symbols-outlined text-purple-600 text-[18px]">mic_external_on</span>
                      <p className="text-[12px] font-bold text-[#002155]">AI Mock Interview Started</p>
                    </div>
                    <p className="text-[11px] text-[#434651]">
                      Target Role: <strong>{msg.action.payload.role || 'General Technical'}</strong>
                    </p>
                    <button 
                      onClick={() => {
                        setInput('Let\'s begin!');
                        setTimeout(() => document.getElementById('chat-widget-send')?.click(), 100);
                      }}
                      className="w-full mt-3 bg-purple-600 text-white py-1.5 rounded-lg text-[11px] font-bold hover:bg-purple-700 transition-colors"
                    >
                      I'm Ready
                    </button>
                  </div>
                )}

                {msg.action?.type === 'BOOK_FACILITY' && (
                  <div className={`mt-3 bg-white border ${msg.action.payload.confirmed ? 'border-amber-200' : 'border-blue-200'} rounded-xl p-4 shadow-sm relative overflow-hidden`}>
                    {!msg.action.payload.confirmed ? (
                      <>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                            <span className="material-symbols-outlined text-[20px]">calendar_add_on</span>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Booking Request</p>
                            <p className="text-[13px] font-bold text-[#002155]">{msg.action.payload.facility}</p>
                          </div>
                        </div>
                        
                        <div className="space-y-2 mb-4">
                          <div className="flex items-center gap-2 text-[11px] text-[#4b5563]">
                            <span className="material-symbols-outlined text-[16px] text-gray-400">event</span>
                            <span className="font-medium text-[#002155]">{msg.action.payload.date}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-[#4b5563]">
                            <span className="material-symbols-outlined text-[16px] text-gray-400">schedule</span>
                            <span className="font-medium text-[#002155]">{msg.action.payload.time_slot}</span>
                          </div>
                          <div className="flex items-start gap-2 text-[11px] text-[#4b5563]">
                            <span className="material-symbols-outlined text-[16px] text-gray-400">info</span>
                            <span className="leading-tight">Purpose: <span className="font-medium text-[#002155]">{msg.action.payload.purpose}</span></span>
                          </div>
                        </div>

                        <button 
                          onClick={() => handleBookFacility(msg.action?.payload)}
                          disabled={loading}
                          className="w-full bg-[#002155] text-white py-2 rounded-lg text-[12px] font-bold hover:bg-[#1a365d] transition-all active:scale-[0.98] shadow-md flex items-center justify-center gap-2"
                        >
                          {loading ? (
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                          ) : (
                            <>
                              <span className="material-symbols-outlined text-[18px]">send</span>
                              Request Approval
                            </>
                          )}
                        </button>
                      </>
                    ) : (
                      <div className="text-center py-2">
                        <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-3">
                          <span className="material-symbols-outlined text-amber-600 text-[28px]">pending_actions</span>
                        </div>
                        <h4 className="text-[15px] font-bold text-[#002155]">Sent for Approval</h4>
                        <p className="text-[10px] text-amber-600 font-bold mt-1 tracking-wider uppercase">REFERENCE ID: COE-2026-{msg.action.payload.bookingId}-B</p>
                        
                        <div className="mt-4 p-3 bg-gray-50 rounded-lg text-left border border-gray-100">
                           <div className="flex justify-between text-[10px] border-b border-gray-200 pb-1 mb-1">
                             <span className="text-gray-500 font-bold uppercase">Facility</span>
                             <span className="text-[#002155] font-bold">{msg.action.payload.facility}</span>
                           </div>
                           <div className="flex justify-between text-[10px]">
                             <span className="text-gray-500 font-bold uppercase">Schedule</span>
                             <span className="text-[#002155] font-bold">{msg.action.payload.date} | {msg.action.payload.time_slot}</span>
                           </div>
                        </div>
                        
                        <p className="text-[10px] text-gray-500 mt-4 leading-relaxed">
                          Your request has been forwarded to the Laboratory Superintendent. You will receive a notification upon clearance.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {msg.action?.type === 'INTERNSHIP_CARDS' && (
                  <div className="mt-3 flex flex-col gap-2">
                    {msg.action.payload.internships?.map((internship: any) => (
                      <div key={internship.id} className="bg-white border border-[#e5e7eb] rounded-xl p-3 shadow-sm">
                        <h4 className="text-[13px] font-bold text-[#002155] leading-tight">{internship.title}</h4>
                        <p className="text-[11px] text-[#4b5563] mt-1">{internship.company || 'Unknown Company'}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full text-[9px] font-bold">{internship.source}</span>
                          <span className="text-[10px] text-gray-500 flex items-center gap-0.5"><span className="material-symbols-outlined text-[12px]">location_on</span> {internship.location || 'Remote'}</span>
                        </div>
                        <a 
                          href={internship.registrationLink || '#'} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="mt-3 w-full block text-center bg-[#002155] text-white py-1.5 rounded-lg text-[11px] font-bold hover:bg-[#1a365d] transition-colors"
                        >
                          Apply Now
                        </a>
                      </div>
                    ))}
                  </div>
                )}

                {msg.action?.type === 'HACKATHON_CARDS' && (
                  <div className="mt-3 flex flex-col gap-2">
                    {msg.action.payload.hackathons?.map((hackathon: any) => (
                      <div key={hackathon.id} className="bg-white border border-emerald-100 rounded-xl p-3 shadow-sm">
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="text-[13px] font-bold text-[#002155] leading-tight flex-1">{hackathon.title}</h4>
                          <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase whitespace-nowrap">Hackathon</span>
                        </div>
                        <p className="text-[11px] text-[#4b5563] mt-1">{hackathon.company || 'Unstop'}</p>
                        
                        <div className="flex items-center gap-3 mt-2">
                          <div className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-emerald-600 text-[14px]">event</span>
                            <span className="text-[10px] text-gray-600 font-medium">
                              {hackathon.deadline ? new Date(hackathon.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Flexible'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-blue-500 text-[14px]">location_on</span>
                            <span className="text-[10px] text-gray-500">{hackathon.location || 'Online'}</span>
                          </div>
                        </div>

                        <a 
                          href={hackathon.registrationLink || '#'} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="mt-3 w-full block text-center bg-emerald-600 text-white py-1.5 rounded-lg text-[11px] font-bold hover:bg-emerald-700 transition-colors"
                        >
                          Register Now
                        </a>
                      </div>
                    ))}
                  </div>
                )}
                {msg.sources && msg.sources.length > 0 && !['SHOW_OPTIONS', 'BOOK_FACILITY'].includes(msg.action?.type || '') && (
                  <div className="mt-2 pt-2 border-t border-[#e0dfd9] flex flex-wrap gap-1">
                    {msg.sources.map((src, i) => (
                      <span
                        key={i}
                        className="text-[9px] bg-white border border-[#c4c6d3] px-1.5 py-0.5 text-[#747782]"
                      >
                        {src}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              )}
              {/* External UI Elements (rendered outside the speech bubble) */}
              {msg.action?.type === 'SHOW_OPTIONS' && (
                <div className="mt-2 flex flex-wrap gap-2 w-full max-w-[85%] justify-start">
                  {msg.action.payload.options?.map((opt: string, idx: number) => (
                    <button 
                      key={idx}
                      onClick={() => {
                        setInput(opt);
                        setTimeout(() => document.getElementById('chat-widget-send')?.click(), 100);
                      }}
                      className="bg-[#3b82f6] text-white px-3 py-1.5 rounded-full text-[12px] font-bold shadow-sm hover:bg-[#2563eb] transition-all"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>
            );
          })}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-[#f5f4f0] border border-[#e8e7e2] px-4 py-3 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#747782] animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#747782] animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#747782] animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Horizontal Action Chips */}
        <div className="flex gap-2 overflow-x-auto px-4 py-2 bg-white border-t border-[#e5e7eb] hide-scrollbar flex-shrink-0">
          {[
            { icon: 'edit_document', label: 'Improve my resume' },
            { icon: 'calendar_month', label: 'Upcoming events' },
            { icon: 'help_outline', label: 'Help' }
          ].map((chip) => (
            <button 
              key={chip.label} 
              onClick={() => { setInput(chip.label); setTimeout(() => document.getElementById('chat-widget-send')?.click(), 100); }}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-[#e5e7eb] rounded-full text-[11px] text-[#4b5563] font-medium hover:bg-[#f9fafb] whitespace-nowrap shadow-sm"
            >
              <span className="material-symbols-outlined text-[14px] text-[#6b7280]">{chip.icon}</span>
              {chip.label}
            </button>
          ))}
        </div>

        {/* Input Area */}
        <div className="p-3 bg-white border-t border-[#e5e7eb]">
          {isExhausted ? (
            <div className="text-center py-2">
              <span className="material-symbols-outlined text-[#d97706] text-2xl block">
                hourglass_empty
              </span>
              <p className="text-[10px] text-[#d97706] font-bold mt-1">
                Daily limit reached ({CHAT_MAX_QUERIES_PER_DAY}/{CHAT_MAX_QUERIES_PER_DAY})
              </p>
              <p className="text-[9px] text-[#747782] mt-0.5">
                Your quota resets at midnight IST.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <div className={`flex items-center gap-2 bg-white rounded-full px-2 py-1.5 border-2 transition-all shadow-sm ${isListening ? 'border-red-500 ring-1 ring-red-500/20' : 'border-[#e5e7eb] focus-within:border-[#d97706]'}`}>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[#9ca3af] hover:text-[#002155] p-1 flex items-center justify-center"
                  title="Upload Resume"
                >
                  <span className="material-symbols-outlined text-[20px] transform -rotate-45">attach_file</span>
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".pdf"
                  className="hidden"
                />
                <input
                  id="chat-widget-input"
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder={isListening ? "Listening..." : "Ask Veda anything..."}
                  disabled={loading}
                  className="flex-1 bg-transparent border-none text-[13px] text-[#002155] placeholder:text-[#9ca3af] font-medium focus:outline-none disabled:cursor-not-allowed min-w-0"
                />
                <button 
                  onClick={toggleListening}
                  className={`${isListening ? 'text-red-500 animate-pulse' : 'text-[#9ca3af]'} hover:text-[#002155] p-1 transition-colors`}
                  title="Speak to Veda"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {isListening ? 'graphic_eq' : 'mic'}
                  </span>
                </button>
                <button
                  id="chat-widget-send"
                  onClick={sendMessage}
                  disabled={loading || !input.trim() || isOverLimit}
                  className="w-8 h-8 rounded-full bg-[#d97706] text-white flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#b45309] transition-colors flex-shrink-0 shadow-md"
                  aria-label="Send message"
                >
                  <span className="material-symbols-outlined text-[16px]">send</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Disclaimer */}
        <div className="bg-white pb-2">
          <p className="text-[9px] text-[#9ca3af] text-center font-medium">
            Veda can make mistakes. Please verify important information.
          </p>
        </div>
      </div>
    </>
  );
}
