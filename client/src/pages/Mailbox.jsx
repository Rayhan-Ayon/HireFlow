import { useState, useEffect, useRef } from 'react';
import { Mail, RefreshCw, AlertCircle, Send, Plus, Search, Filter, Inbox, Send as SendIcon } from 'lucide-react';
import DOMPurify from 'dompurify';
import './Mailbox.css';

export default function Mailbox() {
    const [threads, setThreads] = useState([]);
    const [threadMessages, setThreadMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingThread, setLoadingThread] = useState(false);
    const [selectedThread, setSelectedThread] = useState(null);
    const [error, setError] = useState(null);
    const [replyText, setReplyText] = useState('');
    const [sending, setSending] = useState(false);

    const [adminEmail, setAdminEmail] = useState('');
    const [adminName, setAdminName] = useState('');

    // Filters & Search
    const [filterType, setFilterType] = useState('inbox'); // 'inbox', 'unread', 'sent'
    const [searchQuery, setSearchQuery] = useState('');
    const [activeSearch, setActiveSearch] = useState('');

    const [isSyncing, setIsSyncing] = useState(false);
    const [provider, setProvider] = useState(null); // 'google' or 'microsoft'
    const [showReplyBox, setShowReplyBox] = useState(false);

    // Import CSS
    // Note: Assuming vite/webpack handles CSS imports. If not, this line might need adjustment based on project setup.
    // Since there was no CSS import before, I'll add it at the top of the file in a separate edit or assume standard behavior.
    // ideally I should have added the import at the top, but I'm inside the function body here for the replace tool? 
    // No, I'm finding the component definition. I should probably replace the whole file content or at least from the imports.
    // The previous view_file showed imports at lines 1-3. 
    // I am replacing lines 5-503. So I won't touch the imports.
    // Wait, I need to import the CSS file!
    // I'll add the import via a separate tool call or include it if I can replace the whole file.
    // I'll stick to replacing lines 5-503 (the function) and handle the import separately or rely on step 2.

    // Actually, to do it cleanly, I should replace lines 1-503 to include the import.

    // Let's stick to the plan: modify the component first.

    // Fetch Admin Profile
    useEffect(() => {
        const token = localStorage.getItem('token');
        fetch('/api/user/profile', {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(data => {
                setAdminEmail(data.email || '');
                setAdminName(data.name || 'Admin');
                const isMs = !!data.tokens?.microsoft || !!data.profile?.microsoft_refresh_token;
                const isGoogle = !!data.tokens?.google || !!data.profile?.google_refresh_token;
                setProvider(isMs ? 'microsoft' : (isGoogle ? 'google' : null));
            })
            .catch(err => console.error('Failed to fetch admin profile', err));
    }, []);

    // Fetch inbox threads
    const fetchThreads = async (silent = false) => {
        if (!silent) setLoading(true);
        else setIsSyncing(true);
        setError(null);
        try {
            console.log('[Mailbox] Fetching threads...', { filterType, activeSearch });
            const token = localStorage.getItem('token');
            const res = await fetch('/api/gmail/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    filterByCandidates: true,
                    filterType,
                    q: activeSearch
                })
            });
            const data = await res.json();
            console.log('[Mailbox] Response:', data);

            if (!res.ok) {
                if (data.error && (data.error.includes('SERVICE_DISABLED') || data.error.includes('not enabled'))) {
                    throw new Error(`${provider === 'microsoft' ? 'Outlook' : 'Gmail'} API is disabled. Please enable it.`);
                }
                throw new Error(data.error || 'Failed to fetch emails');
            }

            setThreads(data.messages || []);
        } catch (err) {
            console.error('[Mailbox] Error:', err);
            if (!silent) setError(err.message);
        } finally {
            if (!silent) setLoading(false);
            setIsSyncing(false);
        }
    };

    useEffect(() => {
        fetchThreads();

        // Polling every 15 seconds
        const interval = setInterval(() => fetchThreads(true), 15000);
        return () => clearInterval(interval);
    }, [filterType, activeSearch]);

    const fetchThreadMessages = async (threadId) => {
        if (!threadId) return;
        setLoadingThread(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/gmail/thread', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ threadId })
            });
            if (res.ok) {
                const data = await res.json();
                setThreadMessages(data.messages || []);
            }
        } catch (err) {
            console.error('Failed to fetch thread', err);
        } finally {
            setLoadingThread(false);
        }
    };

    useEffect(() => {
        if (selectedThread?.threadId) {
            fetchThreadMessages(selectedThread.threadId);
        } else {
            setThreadMessages([]);
        }
    }, [selectedThread?.threadId]);

    // Removed expansion state - showing all messages fully by default

    const handleSearch = (e) => {
        e.preventDefault();
        setActiveSearch(searchQuery);
    };

    const handleSendReply = async () => {
        if (!replyText.trim() || !selectedThread) return;
        setSending(true);
        try {
            const lastMsg = threadMessages[threadMessages.length - 1] || selectedThread;
            const token = localStorage.getItem('token');
            const res = await fetch('/api/gmail/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    to: lastMsg.from.includes('<') ? lastMsg.from.match(/<([^>]+)>/)[1] : lastMsg.from,
                    subject: lastMsg.subject.startsWith('Re:') ? lastMsg.subject : `Re: ${lastMsg.subject}`,
                    message: replyText,
                    inReplyTo: lastMsg.id,
                    threadId: lastMsg.threadId
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to send reply');
            }

            setReplyText('');
            // Trigger refresh
            if (selectedThread?.threadId) {
                fetchThreadMessages(selectedThread.threadId);
            }
            fetchThreads(true);
        } catch (err) {
            console.error(err);
            alert(err.message);
        } finally {
            setSending(false);
        }
    };

    const getInitials = (name) => {
        if (!name) return '?';
        const cleanName = name.replace(/<[^>]+>/, '').replace(/"/g, '').trim();
        return cleanName.charAt(0).toUpperCase();
    };

    const extractZoomLink = (content, subject = '') => {
        // Combine content and subject for searching
        const searchText = `${content || ''} ${subject || ''}`;
        if (!searchText.trim()) return null;

        // Match Zoom URLs: zoom.us/j/ or zoom.us/s/ or zoommtg:// or us04web.zoom.us
        const zoomRegex = /(https?:\/\/[^\s]*zoom\.us\/[^\s<>"]*|https?:\/\/us\d+web\.zoom\.us\/[^\s<>"]*|zoommtg:\/\/[^\s<>"]*)/gi;
        const matches = searchText.match(zoomRegex);

        if (matches && matches.length > 0) {
            console.log('[Mailbox] Found Zoom link:', matches[0]);
            // Clean up the URL (remove trailing punctuation)
            return matches[0].replace(/[.,;!?]+$/, '');
        }

        console.log('[Mailbox] No Zoom link found in:', searchText.substring(0, 100));
        return null;
    };

    return (
        <div className="mailbox-container">
            {/* Header Toolbar */}
            <div className="mailbox-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <h1 className="mailbox-title">Mailbox</h1>
                    <div className="mailbox-filters">
                        {['inbox', 'unread', 'sent'].map(type => (
                            <button
                                key={type}
                                onClick={() => setFilterType(type)}
                                className={`filter-btn ${filterType === type ? 'active' : ''}`}
                            >
                                {type}
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {isSyncing && <span style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <RefreshCw size={14} className="spin" /> Syncing...
                    </span>}
                    <form onSubmit={handleSearch} className="search-form">
                        <Search size={16} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Search emails..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="search-input"
                        />
                    </form>
                    <button onClick={() => fetchThreads()} className="btn btn-secondary btn-sm" title="Refresh">
                        <RefreshCw size={18} />
                    </button>
                </div>
            </div>

            {error ? (
                <div className="alert alert-error" style={{ margin: '24px' }}>
                    <AlertCircle size={20} />
                    <span>{error}</span>
                    {error.includes('enabled') && error.includes('Google') && (
                        <a href="https://console.developers.google.com/apis/api/gmail.googleapis.com/overview?project=296387760393" target="_blank" rel="noreferrer" style={{ textDecoration: 'underline', marginLeft: '8px', color: 'inherit' }}>
                            Enable Gmail API
                        </a>
                    )}
                </div>
            ) : (
                <div className="mailbox-grid">
                    {/* Thread List - Left Panel */}
                    <div className="thread-list">
                        {loading && threads.length === 0 && (
                            <div className="loading-container">
                                <RefreshCw size={24} className="spin" style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                                <span>Loading threads...</span>
                            </div>
                        )}

                        {!loading && threads.length === 0 && (
                            <div className="loading-container">
                                <Inbox size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                                <p>No emails found</p>
                            </div>
                        )}

                        {threads.map(thread => {
                            const isSelected = selectedThread?.id === thread.id;
                            const isSent = filterType === 'sent';

                            // For sent, we want to see WHO we sent it TO
                            const rawTarget = isSent ? thread.to : thread.from;
                            let displayName = rawTarget?.replace(/<.*>/, '').replace(/"/g, '').trim();

                            // If name is empty, try to extract email from brackets or just use rawTarget
                            if (!displayName && rawTarget) {
                                const emailMatch = rawTarget.match(/<([^>]+)>/);
                                displayName = emailMatch ? emailMatch[1] : rawTarget;
                            }

                            if (!displayName) displayName = isSent ? 'Recipient' : 'Unknown';
                            const initials = getInitials(displayName);

                            return (
                                <div
                                    key={thread.id}
                                    onClick={() => setSelectedThread(thread)}
                                    className={`mailbox-item ${isSelected ? 'selected' : ''}`}
                                >
                                    <div className="item-content">
                                        <div className="avatar">
                                            {initials}
                                        </div>
                                        <div className="thread-info">
                                            <div className="thread-header">
                                                <span className="sender-name">
                                                    {isSent && <span style={{ fontSize: '11px', color: 'var(--primary)', marginRight: '4px' }}>TO:</span>}
                                                    {displayName}
                                                </span>
                                                <span className="thread-date">
                                                    {new Date(thread.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                                </span>
                                            </div>
                                            <div className="thread-subject">
                                                {thread.subject || '(No Subject)'}
                                            </div>
                                            <div className="thread-snippet">
                                                {thread.snippet}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Thread View - Right Panel */}
                    <div className="thread-view">
                        {selectedThread ? (
                            <>
                                {/* Header */}
                                <div className="thread-view-header">
                                    <h2 className="message-subject">
                                        {selectedThread.subject || '(No Subject)'}
                                    </h2>
                                </div>

                                {/* SCROLLABLE CONVERSATION AREA */}
                                <div className="conversation-container">
                                    {loadingThread ? (
                                        <div className="loading-container">
                                            <RefreshCw size={24} className="spin" style={{ margin: '0 auto 12px', color: 'var(--primary)' }} />
                                            <p>Loading conversation...</p>
                                        </div>
                                    ) : (
                                        threadMessages.map((msg, idx) => {
                                            const isMe = msg.from?.toLowerCase().includes(adminEmail?.toLowerCase()) ||
                                                msg.labelIds?.includes('SENT');
                                            const fromName = msg.from?.replace(/<.*>/, '').replace(/"/g, '').trim() || 'Unknown';

                                            // AGGRESSIVE LOGGING AND FALLBACK
                                            console.log(`[Mailbox] Raw Message Data for ${msg.id}:`, {
                                                from: msg.from,
                                                to: msg.to,
                                                subject: msg.subject,
                                                date: msg.date,
                                                body: msg.body?.substring(0, 100),
                                                bodyLength: msg.body?.length,
                                                snippet: msg.snippet?.substring(0, 100),
                                                snippetLength: msg.snippet?.length,
                                                allKeys: Object.keys(msg)
                                            });

                                            // Helper to ensure visibility
                                            const formatBody = (content) => {
                                                if (!content || content.trim() === '') {
                                                    return '<div style="padding: 20px; background: #f1f5f9; border-radius: 8px; color: #64748b; font-style: italic; text-align: center;">No email content available</div>';
                                                }
                                                // if it looks like plain text (no tags), convert newlines to breaks
                                                if (!/<[a-z][\s\S]*>/i.test(content)) {
                                                    return `<div style="white-space: pre-wrap;">${content}</div>`;
                                                }
                                                return content;
                                            };

                                            // Try body first, then snippet, then show placeholder
                                            let processedBody = '';
                                            if (msg.body && msg.body.trim()) {
                                                processedBody = formatBody(msg.body);
                                                console.log(`[Mailbox] Using BODY for ${msg.id}`);
                                            } else if (msg.snippet && msg.snippet.trim()) {
                                                processedBody = formatBody(msg.snippet);
                                                console.log(`[Mailbox] Using SNIPPET for ${msg.id}`);
                                            } else {
                                                processedBody = formatBody('');
                                                console.log(`[Mailbox] NO CONTENT for ${msg.id}`);
                                            }

                                            // Extract Zoom link from message (check body, snippet, and subject)
                                            const zoomLink = extractZoomLink(
                                                msg.body || msg.snippet || '',
                                                msg.subject || selectedThread?.subject || ''
                                            );

                                            console.log(`[Mailbox] Zoom detection for ${msg.id}:`, {
                                                hasZoomLink: !!zoomLink,
                                                zoomLink: zoomLink,
                                                bodyLength: (msg.body || '').length,
                                                snippetLength: (msg.snippet || '').length,
                                                subject: msg.subject
                                            });

                                            return (
                                                <div key={msg.id} className="message-item">
                                                    {/* Message Header */}
                                                    <div className={`message-header-inline ${isMe ? 'is-me' : ''}`}>
                                                        <div className="sender-info">
                                                            <div className={`sender-avatar ${isMe ? 'is-me' : ''}`}>
                                                                {getInitials(fromName)}
                                                            </div>
                                                            <div className="sender-meta">
                                                                <div className="sender-name-text">
                                                                    {isMe ? `${adminName} (Me)` : fromName}
                                                                </div>
                                                                <div className="message-time-inline">
                                                                    {new Date(msg.date).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Zoom Join Button - Inline with Header */}
                                                        {zoomLink && (
                                                            <a
                                                                href={zoomLink}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="btn-zoom-join"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    console.log('[Mailbox] Opening Zoom:', zoomLink);
                                                                }}
                                                            >
                                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                                                    <path d="M7.5 5.5C7.5 4.67157 8.17157 4 9 4H15C15.8284 4 16.5 4.67157 16.5 5.5V11.5L20.5 8.5V15.5L16.5 12.5V18.5C16.5 19.3284 15.8284 20 15 20H9C8.17157 20 7.5 19.3284 7.5 18.5V5.5Z" />
                                                                </svg>
                                                                Join Zoom Meeting
                                                            </a>
                                                        )}
                                                    </div>

                                                    {/* Message Body */}
                                                    <div className="message-content">
                                                        <div
                                                            className="email-body-content"
                                                            dangerouslySetInnerHTML={{
                                                                __html: DOMPurify.sanitize(processedBody)
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                {/* Floating Reply Button */}
                                {!showReplyBox && (
                                    <button
                                        onClick={() => setShowReplyBox(true)}
                                        className="btn-floating-reply"
                                        title="Reply to conversation"
                                    >
                                        <SendIcon size={20} />
                                    </button>
                                )}

                                {/* Reply Modal/Overlay */}
                                {showReplyBox && (
                                    <div className="reply-overlay">
                                        <div className="reply-modal">
                                            <div className="reply-modal-header">
                                                <h3>Reply to: {selectedThread.subject || '(No Subject)'}</h3>
                                                <button
                                                    onClick={() => {
                                                        setShowReplyBox(false);
                                                        setReplyText('');
                                                    }}
                                                    className="btn-close"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                            <textarea
                                                value={replyText}
                                                onChange={(e) => setReplyText(e.target.value)}
                                                placeholder="Write your reply..."
                                                className="reply-textarea-modal"
                                                autoFocus
                                            />
                                            <div className="reply-modal-footer">
                                                <button
                                                    className="btn btn-secondary"
                                                    onClick={() => {
                                                        setShowReplyBox(false);
                                                        setReplyText('');
                                                    }}
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    className="btn btn-primary"
                                                    onClick={async () => {
                                                        await handleSendReply();
                                                        setShowReplyBox(false);
                                                    }}
                                                    disabled={sending || !replyText.trim()}
                                                >
                                                    {sending ? <RefreshCw size={16} className="spin" /> : <SendIcon size={16} />}
                                                    {sending ? 'Sending...' : 'Send Reply'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="empty-state">
                                <div className="empty-icon-circle">
                                    <Mail size={48} color="#2563eb" />
                                </div>
                                <h3 className="empty-title">Select a conversation</h3>
                                <p className="empty-subtitle">Choose an email from the list to view details and reply.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
