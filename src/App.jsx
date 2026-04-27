import React, { useState, useEffect, useRef } from 'react';
import { Settings, Plus, Send, MessageSquare, Brain, Volume2, VolumeX } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import './App.css';

// Custom hook for local storage
function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      setStoredValue(prevStoredValue => {
        const valueToStore = value instanceof Function ? value(prevStoredValue) : value;
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
        return valueToStore;
      });
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue];
}

const SYSTEM_PROMPT = "You are professional psycholanalyst trying to help the patient.";

function App() {
  const [settings, setSettings] = useLocalStorage('cbt_settings', {
    apiKey: '',
    endpoint: 'https://api.openai.com/v1'
  });

  const [sessions, setSessions] = useLocalStorage('cbt_sessions', []);
  const [activeSessionId, setActiveSessionId] = useLocalStorage('cbt_active_session', null);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);

  const messagesEndRef = useRef(null);
  const audioRef = useRef(null);

  const toggleMusic = () => {
    if (isMusicPlaying) {
      audioRef.current?.pause();
    } else {
      audioRef.current?.play();
    }
    setIsMusicPlaying(!isMusicPlaying);
  };

  const activeSession = sessions.find(s => s.id === activeSessionId);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeSession?.messages, isLoading]);

  const createNewSession = () => {
    const newSession = {
      id: uuidv4(),
      title: `Session ${new Date().toLocaleDateString()}`,
      date: new Date().toISOString(),
      messages: []
    };
    setSessions([newSession, ...sessions]);
    setActiveSessionId(newSession.id);
  };

  const handleSend = async () => {
    if (!input.trim() || !activeSessionId) return;
    if (!settings.apiKey || !settings.endpoint) {
      alert("Please configure your API Key and Endpoint in Settings.");
      setIsSettingsOpen(true);
      return;
    }

    const userMessage = { role: 'user', content: input.trim() };
    const updatedMessages = [...(activeSession.messages || []), userMessage];

    // Optimistic UI update
    const updatedSessions = sessions.map(s => {
      if (s.id === activeSessionId) {
        return { ...s, messages: updatedMessages, title: s.messages.length === 0 ? input.trim().substring(0, 30) + '...' : s.title };
      }
      return s;
    });
    setSessions(updatedSessions);
    setInput('');
    setIsLoading(true);

    try {
      let baseURL = settings.endpoint || 'https://api.openai.com/v1';
      if (baseURL.endsWith('/v1/chat/completions')) {
        baseURL = baseURL.replace('/v1/chat/completions', '/v1');
      }

      const openai = new OpenAI({
        apiKey: settings.apiKey,
        baseURL: baseURL,
        dangerouslyAllowBrowser: true
      });

      const response = await openai.chat.completions.create({
        model: 'dgawlik/buddy-gemma-4-finetune', // Or an equivalent model name if using a compatible endpoint
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...updatedMessages.map(m => ({ role: m.role, content: m.content }))
        ],
        chat_template_kwargs: { "enable_thinking": True }
      });

      const assistantMessage = response.choices[0].message;

      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) {
          return { ...s, messages: [...s.messages, assistantMessage] };
        }
        return s;
      }));
    } catch (error) {
      console.error(error);
      alert(`Failed to get response: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <audio ref={audioRef} src="/forest-ambience-light-birdsong-distant-rooster-vincentmets-1-03-38.mp3" loop />

      <div className="app-container">
        {/* Sidebar */}
        <aside className="sidebar card-panel">
          <div className="sidebar-header">
            <div className="flex items-center" style={{ gap: '0.5rem' }}>
              <img src="/logo.png" alt="BuddyGemma Logo" className="app-logo" />
            </div>
            <div className="flex items-center" style={{ gap: '0.5rem' }}>
              <button className="btn-icon" onClick={toggleMusic} title={isMusicPlaying ? "Mute Music" : "Play Relaxing Music"}>
                {isMusicPlaying ? <Volume2 size={20} /> : <VolumeX size={20} />}
              </button>
              <button className="btn-icon" onClick={() => setIsSettingsOpen(true)} title="Settings">
                <Settings size={20} />
              </button>
            </div>
          </div>

          <div className="flex p-4" style={{ padding: '1rem' }}>
            <button className="btn w-full justify-center" onClick={createNewSession} style={{ width: '100%' }}>
              <Plus size={18} /> New Session
            </button>
          </div>

          <div className="session-list">
            {sessions.map(session => (
              <div
                key={session.id}
                className={`session-item ${session.id === activeSessionId ? 'active' : ''}`}
                onClick={() => setActiveSessionId(session.id)}
              >
                <div className="flex items-center" style={{ gap: '0.5rem' }}>
                  <MessageSquare size={16} color="var(--text-secondary)" />
                  <span className="session-title">{session.title}</span>
                </div>
                <span className="session-date">{new Date(session.date).toLocaleDateString()}</span>
              </div>
            ))}
            {sessions.length === 0 && (
              <div className="empty-state" style={{ fontSize: '0.85rem' }}>
                No sessions yet.
              </div>
            )}
          </div>
        </aside>

        {/* Main Chat Area */}
        <main className="main-chat card-panel">
          {activeSession ? (
            <>
              <div className="chat-header">
                <h2>{activeSession.title}</h2>
              </div>

              <div className="messages-container">
                {activeSession.messages.length === 0 ? (
                  <div className="empty-state">
                    <img src="/logo.png" alt="BuddyGemma Logo" className="app-logo-large" />
                    <h3>Welcome to your safe space.</h3>
                    <p style={{ marginTop: '0.5rem' }}>How are you feeling today?</p>
                  </div>
                ) : (
                  activeSession.messages.map((msg, idx) => {
                    let thinking = msg.reasoning_content || '';
                    let content = msg.content || '';

                    if (!thinking && content.includes('<think>')) {
                      const match = content.match(/<think>([\s\S]*?)<\/think>/);
                      if (match) {
                        thinking = match[1].trim();
                        content = content.replace(/<think>[\s\S]*?<\/think>/, '').trim();
                      }
                    }

                    return (
                      <div key={idx} className={`message ${msg.role}`}>
                        {thinking && (
                          <details className="thinking-process">
                            <summary>View Thinking Process</summary>
                            <div className="thinking-content">
                              {thinking.split('\n').map((line, i) => (
                                <p key={i} style={{ minHeight: '1rem' }}>{line}</p>
                              ))}
                            </div>
                          </details>
                        )}
                        {content.split('\n').map((line, i) => (
                          <p key={i} style={{ minHeight: '1rem' }}>{line}</p>
                        ))}
                      </div>
                    );
                  })
                )}
                {isLoading && (
                  <div className="typing-indicator">
                    <div className="typing-dot"></div>
                    <div className="typing-dot"></div>
                    <div className="typing-dot"></div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="chat-input-area">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message... (Shift+Enter for new line)"
                  rows={1}
                />
                <button className="btn" onClick={handleSend} disabled={isLoading || !input.trim()}>
                  <Send size={20} />
                </button>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <img src="/logo.png" alt="BuddyGemma Logo" className="app-logo-large" style={{ marginBottom: '1.5rem' }} />
              <h2>Start a New Session</h2>
              <p style={{ marginTop: '1rem', maxWidth: '300px' }}>
                Select a session from the sidebar or start a new one to begin chatting with your psychoanalyst.
              </p>
              <button className="btn" onClick={createNewSession} style={{ marginTop: '2rem' }}>
                <Plus size={18} /> New Session
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="modal-overlay">
          <div className="settings-modal card-panel">
            <h2>Settings</h2>

            <div className="form-group">
              <label>API Base URL</label>
              <input
                type="text"
                value={settings.endpoint}
                onChange={(e) => setSettings({ ...settings, endpoint: e.target.value })}
                placeholder="https://api.openai.com/v1"
              />
            </div>

            <div className="form-group">
              <label>API Key</label>
              <input
                type="password"
                value={settings.apiKey}
                onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                placeholder="sk-..."
              />
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setIsSettingsOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
