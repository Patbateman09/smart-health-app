import React, { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Send, Bot, User as UserIcon, X } from "lucide-react";
import { symptomCheck, getRecommendations, sendReminder } from "@/services/aiService";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Message {
  sender: "user" | "ai";
  text: string;
  doctors?: any[];
}

const AIChatAssistant = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: "ai",
      text: "👋 Hi! What brings you to this website? Describe your symptoms or what you're looking for.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  // Draggable state
  const [position, setPosition] = useState({ x: 40, y: window.innerHeight - 400 }); // Default bottom-left
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const chatWindowRef = useRef<HTMLDivElement>(null);
  // Add state for Q&A
  const [symptomAnswers, setSymptomAnswers] = useState<string[]>([]);
  const { toast } = useToast();
  // Remove userId check for anonymous chat
  const [lastRecommendation, setLastRecommendation] = useState<string | null>(null);
  // 1. Add state for minimized
  const [minimized, setMinimized] = useState(false);
  // 2. Add state for resizing
  const [size, setSize] = useState({ width: 384, height: 500 }); // 96*4 px width, 500px height
  const resizeRef = useRef<HTMLDivElement>(null);
  // 3. Mobile detection
  const isMobile = window.innerWidth <= 640;
  // 4. Dark mode detection
  const [darkMode, setDarkMode] = useState(false);
  useEffect(() => {
    const match = window.matchMedia('(prefers-color-scheme: dark)');
    setDarkMode(match.matches);
    const handler = (e: MediaQueryListEvent) => setDarkMode(e.matches);
    match.addEventListener('change', handler);
    return () => match.removeEventListener('change', handler);
  }, []);
  // 5. Accessibility: focus input on open
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open && !minimized) inputRef.current?.focus();
  }, [open, minimized]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  // Update position on window resize to keep it in view
  useEffect(() => {
    const handleResize = () => {
      setPosition(pos => ({
        x: Math.min(pos.x, window.innerWidth - 350),
        y: Math.min(pos.y, window.innerHeight - 100),
      }));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Drag handlers
  const onMouseDown = (e: React.MouseEvent) => {
    if (chatWindowRef.current) {
      setDragging(true);
      setOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  };
  useEffect(() => {
    if (!dragging) return;
    const onMouseMove = (e: MouseEvent) => {
      setPosition({
        x: Math.max(0, Math.min(e.clientX - offset.x, window.innerWidth - 384)),
        y: Math.max(0, Math.min(e.clientY - offset.y, window.innerHeight - 100)),
      });
    };
    const onMouseUp = () => setDragging(false);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [dragging, offset]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMessage: Message = { sender: "user", text: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      // Pass null for userId to allow anonymous chat
      const result = await symptomCheck(null, messages.length === 1 ? input : messages[1]?.text || "", [...symptomAnswers, input]);
      if (result.nextQuestion) {
        setMessages((prev) => [
          ...prev,
          { sender: "ai", text: result.nextQuestion },
        ]);
        setSymptomAnswers((prev) => [...prev, input]);
      } else if (result.prediction) {
        setMessages((prev) => [
          ...prev,
          { sender: "ai", text: result.prediction },
        ]);
        setSymptomAnswers([]); // Reset for next session
      } else {
        setMessages((prev) => [
          ...prev,
          { sender: "ai", text: "Sorry, I couldn't understand. Please try again." },
        ]);
      }
    } catch (e) {
      toast({ title: "Error", description: "There was an error. Please try again." });
    }
    setLoading(false);
  };

  // 6. Resizing logic
  const onResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = size.width;
    const startHeight = size.height;
    const onMouseMove = (moveEvent: MouseEvent) => {
      setSize({
        width: Math.max(320, startWidth + moveEvent.clientX - startX),
        height: Math.max(350, startHeight + moveEvent.clientY - startY),
      });
    };
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return (
    <>
      {/* Floating Chat Bubble or Minimized Icon */}
      {!open && !minimized && (
        <button
          className="fixed bottom-8 left-8 bg-green-600 hover:bg-green-700 text-white rounded-full p-4 shadow-lg z-50 flex items-center animate-fade-in"
          onClick={() => setOpen(true)}
          aria-label="Open AI Assistant"
        >
          <Bot className="h-6 w-6" />
        </button>
      )}
      {minimized && (
        <button
          className="fixed bottom-8 left-8 bg-green-600 hover:bg-green-700 text-white rounded-full p-3 shadow-lg z-50 flex items-center animate-fade-in"
          onClick={() => { setOpen(true); setMinimized(false); }}
          aria-label="Restore AI Assistant"
        >
          <Bot className="h-5 w-5" />
          <span className="ml-2 text-xs font-semibold">Chat</span>
        </button>
      )}
      {/* Chat Window */}
      {open && !minimized && (
        <div
          ref={chatWindowRef}
          className={`fixed z-50 border border-gray-200 rounded-xl shadow-2xl flex flex-col animate-fade-in ${darkMode ? 'bg-gray-900 text-white border-gray-700' : 'bg-white'} ${isMobile ? 'w-full left-0 right-0 bottom-0 top-auto' : ''}`}
          style={{
            left: isMobile ? 0 : position.x,
            top: isMobile ? 'auto' : position.y,
            bottom: isMobile ? 0 : 'auto',
            right: isMobile ? 0 : 'auto',
            width: isMobile ? '100%' : size.width,
            height: isMobile ? '60vh' : size.height,
            minHeight: 350,
            maxHeight: isMobile ? '80vh' : '90vh',
            cursor: dragging ? 'grabbing' : 'default',
            transition: 'all 0.2s cubic-bezier(.4,0,.2,1)',
          }}
          role="dialog"
          aria-modal="true"
          aria-label="AI Health Assistant Chat"
        >
          {/* Header (Draggable + Minimize/Close) */}
          <div className={`flex items-center justify-between p-4 border-b select-none ${darkMode ? 'border-gray-700' : ''}`}
            tabIndex={0}
            aria-label="Chat header"
          >
            <div
              className="flex items-center space-x-2 cursor-move"
              onMouseDown={onMouseDown}
            >
              <Bot className="h-5 w-5 text-green-600" />
              <span className="font-bold text-lg">AI Health Assistant</span>
            </div>
            <div className="flex gap-2">
              <button
                className="text-gray-400 hover:text-gray-700 dark:hover:text-white"
                onClick={() => setMinimized(true)}
                aria-label="Minimize"
              >
                <svg width="18" height="18" viewBox="0 0 20 20"><rect x="4" y="10" width="12" height="2" rx="1" fill="currentColor" /></svg>
              </button>
              <button
                className="text-gray-400 hover:text-gray-700 dark:hover:text-white"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          {/* Messages */}
          <div
            className={`flex-1 overflow-y-auto p-4 space-y-3 ${darkMode ? 'bg-gray-800' : 'bg-gray-50'}`}
            style={{ maxHeight: isMobile ? '50vh' : size.height - 120, minHeight: 100 }}
            ref={chatEndRef}
            tabIndex={0}
            aria-label="Chat messages"
          >
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                tabIndex={0}
                aria-label={msg.sender === "user" ? 'Your message' : 'AI message'}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 shadow ${
                    msg.sender === "user"
                      ? "bg-green-600 text-white self-end"
                      : darkMode ? "bg-gray-900 text-white border border-gray-700" : "bg-white text-gray-800 border"
                  }`}
                >
                  <div className="flex items-center mb-1">
                    {msg.sender === "ai" ? (
                      <Bot className="h-4 w-4 mr-1 text-green-600" />
                    ) : (
                      <UserIcon className="h-4 w-4 mr-1 text-gray-400" />
                    )}
                    <span className="font-semibold text-xs">
                      {msg.sender === "ai" ? "AI" : "You"}
                    </span>
                  </div>
                  <div className="whitespace-pre-line text-sm">{msg.text}</div>
                  {/* 5. Timestamp */}
                  <div className="text-xs text-gray-400 mt-1 text-right">
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {/* Doctor Recommendations */}
                  {msg.doctors && (
                    <div className="mt-3 space-y-2">
                      {msg.doctors.map((doc: any) => (
                        <div
                          key={doc.id}
                          className="flex items-center bg-gray-100 rounded p-2 shadow-sm"
                        >
                          <img
                            src={doc.profiles?.profile_picture_url || "/placeholder.svg"}
                            alt="Doctor"
                            className="h-10 w-10 rounded-full object-cover mr-3"
                          />
                          <div>
                            <div className="font-bold">
                              Dr. {doc.profiles?.first_name} {doc.profiles?.last_name}
                            </div>
                            <div className="text-xs text-gray-500">{doc.specialization}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-lg px-4 py-2 shadow bg-white text-gray-800 border animate-pulse">
                  <Bot className="h-4 w-4 mr-1 text-green-600 inline" />
                  <span className="font-semibold text-xs">AI</span>
                  <span className="ml-2">Typing...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          {/* Input */}
          <div className={`p-4 border-t flex items-center space-x-2 sticky bottom-0 z-10 ${darkMode ? 'bg-gray-900 border-gray-700' : 'bg-white'}`}
            tabIndex={0}
          >
            <input
              ref={inputRef}
              type="text"
              className={`flex-1 rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 ${darkMode ? 'bg-gray-800 text-white border-gray-700' : ''}`}
              placeholder="Type your message..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") handleSend();
              }}
              disabled={loading}
              aria-label="Type your message"
              autoFocus
            />
            <button
              className="bg-green-600 hover:bg-green-700 text-white rounded-full p-2 disabled:opacity-50"
              onClick={handleSend}
              disabled={loading || !input.trim()}
              aria-label="Send"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
          {/* 2. Resizer handle (bottom-right) */}
          {!isMobile && (
            <div
              ref={resizeRef}
              className="absolute bottom-2 right-2 w-4 h-4 cursor-nwse-resize z-20"
              onMouseDown={onResizeMouseDown}
              aria-label="Resize chat window"
              tabIndex={0}
            >
              <svg width="16" height="16" viewBox="0 0 16 16"><path d="M0 16L16 0V16H0Z" fill="#d1d5db"/></svg>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default AIChatAssistant; 