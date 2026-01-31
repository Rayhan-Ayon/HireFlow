import { useState, useEffect, useRef } from 'react';
import { Send, Bot, User } from 'lucide-react';

function Chatbot({ onComplete, jobId }) {
    const [messages, setMessages] = useState([]);
    const [history, setHistory] = useState([]); // [{ role: 'user'|'model', parts: [{ text: '...' }] }]
    const [isTyping, setIsTyping] = useState(false);
    const [isComplete, setIsComplete] = useState(false);
    const [isStarted, setIsStarted] = useState(false);
    const chatWindowRef = useRef(null);
    const inputRef = useRef(null);

    // Re-focus input when bot stops typing
    useEffect(() => {
        if (isStarted && !isTyping && !isComplete) {
            inputRef.current?.focus();
        }
    }, [isStarted, isTyping, isComplete]);

    const scrollToBottom = () => {
        if (chatWindowRef.current) {
            const { scrollHeight, clientHeight } = chatWindowRef.current;
            chatWindowRef.current.scrollTo({
                top: scrollHeight - clientHeight,
                behavior: 'smooth'
            });
        }
    };

    useEffect(scrollToBottom, [messages, isTyping]);

    const addMessagesSequentially = async (msgs) => {
        setIsTyping(true);
        for (const text of msgs) {
            // Typing delay simulation based on length, but capped to keep it snappy
            await new Promise(r => setTimeout(r, Math.min(1000, 500 + text.length * 10)));
            setMessages(prev => [...prev, { sender: 'bot', text }]);
            // Add a small pause between bubbles
            await new Promise(r => setTimeout(r, 300));
        }
        setIsTyping(false);
    };

    const startInterview = async () => {
        setIsStarted(true);
        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ job_id: jobId, history: [] })
            });
            const data = await res.json();

            // Handle new array format or fallback to string
            const msgs = data.messages || [data.message];

            // Update history with the full block for context
            setHistory([{ role: 'model', parts: [{ text: msgs.join('\n') }] }]);

            await addMessagesSequentially(msgs);
        } catch (err) {
            console.error('Chat start error:', err);
            setIsTyping(false);
        }
    };

    const handleAnswer = async (text) => {
        if (isTyping || isComplete) return;

        // Record User Message
        setMessages(prev => [...prev, { sender: 'user', text }]);

        // Add user msg to history
        const newHistory = [...history, { role: 'user', parts: [{ text }] }];
        setHistory(newHistory);

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ job_id: jobId, history: newHistory })
            });
            const data = await res.json();

            const msgs = data.messages || [data.message];

            // Update history with the full block
            setHistory(prev => [...prev, { role: 'model', parts: [{ text: msgs.join('\n') }] }]);

            await addMessagesSequentially(msgs);

            if (data.is_complete) {
                setIsComplete(true);
                onComplete(newHistory);
            }
        } catch (err) {
            console.error('Chat error:', err);
            setIsTyping(false);
        }
    };

    if (!isStarted) {
        return (
            <div className="chatbot-container" style={{ alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
                <div style={{ padding: '24px', textAlign: 'center' }}>
                    <div style={{
                        width: '64px', height: '64px', background: 'var(--primary-light)',
                        color: 'var(--primary)', borderRadius: '50%', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto'
                    }}>
                        <Bot size={32} />
                    </div>
                    <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>AI Recruiter</h3>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
                        Ready to start your screening? It will only take a few minutes.
                    </p>
                    <button
                        onClick={startInterview}
                        className="btn btn-primary btn-lg"
                        style={{ padding: '12px 32px' }}
                    >
                        Start Screening
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="chatbot-container">
            <div className="chat-header">
                <div className="chat-header-title">
                    <span className="p-1.5 bg-blue-100 rounded-lg text-primary">
                        <Bot size={20} />
                    </span>
                    HireFlow Assistant
                </div>
            </div>
            <div className="chat-window" ref={chatWindowRef}>
                {messages.map((m, i) => (
                    <div key={i} className={`message ${m.sender}`}>
                        <div className="message-bubble">{m.text}</div>
                        {/* Show options only for the LATEST message if it matches the current question and is from the bot */}
                        {m.sender === 'bot' &&
                            m.options &&
                            i === messages.length - 1 &&
                            !isTyping && (
                                <div className="options">
                                    {m.options.map(opt => (
                                        <button key={opt} onClick={() => handleAnswer(opt)} className="btn-option">{opt}</button>
                                    ))}
                                </div>
                            )}
                    </div>
                ))}
                {isTyping && (
                    <div className="message bot">
                        <div className="message-bubble">
                            <span className="typing-dot"></span>
                            <span className="typing-dot"></span>
                            <span className="typing-dot"></span>
                        </div>
                    </div>
                )}
            </div>

            {isComplete && (
                <div className="p-4 m-4 bg-green-50 text-green-700 rounded-lg border border-green-100 flex items-center gap-3">
                    <div className="bg-green-100 p-1 rounded-full">✓</div>
                    <div>
                        <strong>Interview Complete</strong>
                        <p className="text-sm mt-0.5">Please continue with the form below.</p>
                    </div>
                </div>
            )}
            {!isComplete && (
                <form className="chat-input" onSubmit={(e) => {
                    e.preventDefault();
                    const val = e.target.input.value;
                    if (val && !isTyping) {
                        handleAnswer(val);
                        e.target.reset();
                    }
                }}>
                    <textarea
                        ref={inputRef}
                        name="input"
                        placeholder={isTyping ? "Bot is typing..." : "Type your answer..."}
                        autoFocus
                        rows={1}
                        disabled={isTyping}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                e.target.form.requestSubmit();
                            }
                        }}
                        style={{ resize: 'none', height: 'auto', minHeight: '46px', maxHeight: '120px', overflowY: 'auto' }}
                        onInput={(e) => {
                            e.target.style.height = 'auto';
                            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                        }}
                    />
                    <button
                        type="submit"
                        className="btn-chat-send"
                        disabled={isTyping}
                    >
                        <Send size={20} />
                    </button>
                </form>
            )}
        </div>
    );
}

export default Chatbot;
