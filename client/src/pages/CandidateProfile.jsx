import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, Linkedin, Download, CheckCircle, Clock, XCircle, MessageSquare, FileText, Edit, Calendar, Video, RefreshCw, LayoutDashboard, List, Send, Zap, Link as LinkIcon, Users, Paperclip } from 'lucide-react';
import DOMPurify from 'dompurify';

function CandidateProfile() {
    const { candidateId } = useParams();
    const navigate = useNavigate();
    const [candidate, setCandidate] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'email', 'notes'
    const [provider, setProvider] = useState(null); // 'google' or 'microsoft'
    const [templates, setTemplates] = useState([]);
    const [userProfile, setUserProfile] = useState(null);

    // Scheduling State
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [isScheduling, setIsScheduling] = useState(false);
    const [scheduleData, setScheduleData] = useState({
        summary: 'Interview for ' + (candidate?.job_title || 'Role'),
        startTime: '',
        endTime: '',
        description: 'We are excited to invite you to an interview.',
        meetingProvider: 'auto', // 'auto', 'teams', 'zoom', 'manual'
        meetingLink: ''
    });

    // Update summary when candidate loads
    useEffect(() => {
        if (candidate) {
            setScheduleData(prev => ({
                ...prev,
                summary: `Interview with ${candidate.name} for ${candidate.job_title || 'Role'}`
            }));
        }
    }, [candidate]);

    // Calendly Integration: Fetch Profile & Load Script
    useEffect(() => {
        const token = localStorage.getItem('token');
        fetch('/api/user/profile', { headers: { 'Authorization': `Bearer ${token}` } })
            .then(res => res.json())
            .then(data => setUserProfile(data))
            .catch(e => console.error(e));

        const existingScript = document.querySelector('script[src="https://assets.calendly.com/assets/external/widget.js"]');
        if (!existingScript) {
            const link = document.createElement('link');
            link.href = "https://assets.calendly.com/assets/external/widget.css";
            link.rel = "stylesheet";
            document.head.appendChild(link);

            const script = document.createElement('script');
            script.src = "https://assets.calendly.com/assets/external/widget.js";
            script.async = true;
            document.head.appendChild(script);
        }
    }, []);

    const handleScheduleAction = () => {
        // Calendly Disabled
        // if (userProfile && userProfile.calendly_link) { ... }
        setShowScheduleModal(true);
    };

    const handleScheduleSubmit = async () => {
        setIsScheduling(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/calendar/events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    summary: scheduleData.summary,
                    description: scheduleData.description,
                    startTime: new Date(scheduleData.startTime).toISOString(),
                    endTime: new Date(scheduleData.endTime).toISOString(),
                    candidateEmail: candidate.email,
                    candidateId: candidate.id,
                    meetingProvider: scheduleData.meetingProvider,
                    meetingLink: scheduleData.meetingLink
                })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Failed to schedule');
            }

            const data = await res.json();

            let platformName = 'Meeting';
            if (scheduleData.meetingProvider === 'zoom') platformName = 'Zoom';
            else if (scheduleData.meetingProvider === 'teams') platformName = 'Teams';
            else if (scheduleData.meetingProvider === 'google') platformName = 'Google Meet';

            let alertMsg = `Interview scheduled! ${platformName} link has been generated.`;
            if (data.emailSent) alertMsg += ' Invitation email sent to candidate.';
            else if (data.emailError) alertMsg += ` (Warning: ${data.emailError})`;
            else alertMsg += ' (Warning: Invitation email could not be sent. Please email the link manually.)';

            alert(alertMsg);
            setShowScheduleModal(false);
            updateStatus('interview');
        } catch (err) {
            console.error(err);
            alert(`Failed: ${err.message}`);
        } finally {
            setIsScheduling(false);
        }
    };

    // Email State (Quick Action)
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [isSendingEmail, setIsSendingEmail] = useState(false);
    const [emailData, setEmailData] = useState({
        subject: '',
        message: `Hi ${candidate?.name || ''},\n\nWe'd like to invite you...`
    });

    useEffect(() => {
        if (candidate) {
            setEmailData(prev => ({ ...prev, message: `Hi ${candidate.name},\n\n` }));
        }
    }, [candidate]);

    const handleSendEmail = async () => {
        setIsSendingEmail(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/gmail/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    to: candidate.email,
                    subject: emailData.subject,
                    message: emailData.message,
                    candidateId: candidate.id
                })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Failed to send email');
            }

            alert(`Email sent successfully via ${provider === 'microsoft' ? 'Outlook' : 'Gmail'}!`);
            setShowEmailModal(false);
            setEmailData({ subject: '', message: '' });
            setActiveTab('email'); // Auto-switch to email tab
        } catch (err) {
            console.error(err);
            alert(`Error: ${err.message}. Please check your ${provider === 'microsoft' ? 'Outlook' : 'Gmail'} connection in Settings.`);
        } finally {
            setIsSendingEmail(false);
        }
    };

    useEffect(() => {
        const fetchCandidate = async () => {
            try {
                const token = localStorage.getItem('token');
                const authHeaders = { 'Authorization': `Bearer ${token}` };

                // Fetch Profile first to know provider
                const profileRes = await fetch('/api/user/profile', { headers: authHeaders });
                if (profileRes.ok) {
                    const profile = await profileRes.json();
                    setUserProfile(profile);
                    const isMs = !!profile.tokens?.microsoft || !!profile.microsoft_refresh_token;
                    const isGoogle = !!profile.tokens?.google || !!profile.google_refresh_token; // Profile here might be flatten if it comes from different source?
                    // Wait. CandidateProfile.jsx fetches `api/user/profile`? 
                    // Let's assume it fetches SAME profile.
                    // Lines 160: fetch('/api/user/profile')

                    setProvider(isMs ? 'microsoft' : (isGoogle ? 'google' : null));

                    let defaultMeeting = 'manual';
                    if (profile.enable_zoom) defaultMeeting = 'zoom';
                    else if (isMs) defaultMeeting = 'teams';
                    else if (isGoogle) defaultMeeting = 'google';
                    else if (profile.enable_teams) defaultMeeting = 'teams';

                    setScheduleData(prev => ({ ...prev, meetingProvider: defaultMeeting }));
                }

                // Fetch Templates
                const templatesRes = await fetch('/api/templates', { headers: authHeaders });
                if (templatesRes.ok) {
                    const data = await templatesRes.json();
                    setTemplates(data.templates.filter(t => t.is_enabled) || []);
                }

                const res = await fetch(`/api/candidates/${candidateId}`, { headers: authHeaders });
                if (!res.ok) {
                    let errMsg = 'Candidate not found';
                    try {
                        const errData = await res.json();
                        if (errData.error) errMsg = errData.error;
                    } catch (e) {
                        // ignore JSON parse error
                    }
                    throw new Error(errMsg);
                }
                const data = await res.json();
                setCandidate(data);
            } catch (err) {
                console.error(err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchCandidate();
    }, [candidateId]);

    useEffect(() => {
        if (candidate && candidate.status === 'new') {
            updateStatus('screening');
        }
    }, [candidate]);

    const updateStatus = async (newStatus) => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/candidates/${candidateId}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status: newStatus })
            });
            if (res.ok) {
                setCandidate(prev => ({ ...prev, status: newStatus }));
            }
        } catch (err) {
            console.error('Failed to update status', err);
        }
    };

    if (loading) return <div className="page-container">Loading profile...</div>;
    if (error) return <div className="page-container" style={{ color: 'red' }}>Error: {error}</div>;
    if (!candidate) return null;

    const pipelineSteps = [
        { id: 'new', label: 'New' },
        { id: 'screening', label: 'Screening' },
        { id: 'interview', label: 'Interview' },
        { id: 'offer', label: 'Offer' },
        { id: 'rejected', label: 'Rejected' }
    ];

    const getScoreClass = (score) => {
        if (score >= 80) return 'match-high';
        if (score >= 50) return 'match-medium';
        return 'match-low';
    };

    return (
        <div className="page-container">
            <Link to="/candidates" className="back-link">
                <ArrowLeft size={16} /> Back to Candidates
            </Link>

            {/* Header Card */}
            <div className="profile-header-card">
                <div className="profile-header-main">
                    <div className="profile-identity">
                        <div className="profile-avatar">
                            {candidate.name.charAt(0)}
                        </div>
                        <div>
                            <h1 className="profile-name">{candidate.name}</h1>
                            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: '500' }}>
                                Applied for: <span style={{ color: 'var(--text-main)' }}>{candidate.job_title || 'Unknown Role'}</span>
                            </div>
                            <div className="profile-contact">
                                <a href={`mailto:${candidate.email}`} className="contact-item">
                                    <Mail size={16} /> {candidate.email}
                                </a>
                                {candidate.phone && (
                                    <a href={`tel:${candidate.phone}`} className="contact-item">
                                        <Phone size={16} /> {candidate.phone}
                                    </a>
                                )}
                                {candidate.linkedin && (
                                    <a href={candidate.linkedin} target="_blank" rel="noopener noreferrer" className="contact-item" style={{ color: '#0077b5', fontWeight: '500' }}>
                                        <Linkedin size={16} /> LinkedIn Profile
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className={`match-badge ${getScoreClass(candidate.match_score)}`}>
                        {candidate.match_score}% Match
                    </div>
                </div>

                {/* Pipeline Status Bar */}
                <div className="status-section">
                    <span className="section-label">Application Status</span>
                    <div className="status-timeline">
                        <div className="timeline-line"></div>
                        {pipelineSteps.map((step, idx) => {
                            const isActive = candidate.status === step.id;
                            const isCompleted = pipelineSteps.findIndex(s => s.id === candidate.status) > idx;

                            let btnClass = 'status-step-btn';
                            if (isActive) btnClass += ' active';
                            if (isCompleted) btnClass += ' completed';

                            return (
                                <button
                                    key={step.id}
                                    onClick={() => updateStatus(step.id)}
                                    className={btnClass}
                                >
                                    <div className="step-circle">
                                        {isActive && <div className="active-dot"></div>}
                                        {isCompleted && <CheckCircle size={16} />}
                                    </div>
                                    <span className="step-label">
                                        {step.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* TABS */}
                <div style={{ display: 'flex', gap: '24px', marginTop: '32px', borderBottom: '1px solid var(--border)' }}>
                    <TabButton
                        label="Overview"
                        active={activeTab === 'overview'}
                        icon={LayoutDashboard}
                        onClick={() => setActiveTab('overview')}
                    />
                    <TabButton
                        label="Emails & Conversation"
                        active={activeTab === 'email'}
                        icon={Mail}
                        onClick={() => setActiveTab('email')}
                    />
                    <TabButton
                        label="Notes & Transcript"
                        active={activeTab === 'notes'}
                        icon={FileText}
                        onClick={() => setActiveTab('notes')}
                    />
                </div>
            </div>

            <div className="profile-grid" style={{ marginTop: '24px' }}>
                {/* Main Content Dynamic Based on Tab */}
                <div className="profile-main">

                    {activeTab === 'overview' && (
                        <>
                            <UpcomingInterviewCard candidateId={candidateId} />

                            {/* AI Summary */}
                            <div className="content-card">
                                <div className="card-header">
                                    <h2 className="card-title">AI Analysis</h2>
                                </div>
                                <div className="card-body" style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                                    {candidate.resume_summary || 'No summary available.'}
                                </div>
                            </div>

                            {/* Interview Notes Preview */}
                            <div className="content-card">
                                <div className="card-header" style={{ justifyContent: 'space-between', display: 'flex' }}>
                                    <h2 className="card-title">Latest Notes</h2>
                                    <button onClick={() => setActiveTab('notes')} style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px' }}>View All</button>
                                </div>
                                {/* We can reuse the component or just link to tab. For simplicity let's link to tab */}
                                <div className="card-body" style={{ color: 'var(--text-secondary)' }}>
                                    <InterviewNotesSection candidateId={candidateId} preview={true} />
                                </div>
                            </div>
                        </>
                    )}

                    {activeTab === 'email' && (
                        <ConversationBox candidate={candidate} email={candidate.email} />
                    )}

                    {activeTab === 'notes' && (
                        <>
                            <InterviewNotesSection candidateId={candidateId} />

                            <div className="content-card">
                                <div className="card-header">
                                    <MessageSquare size={18} className="text-muted" />
                                    <h2 className="card-title">Screening Transcript</h2>
                                </div>
                                <div className="card-body" style={{ maxHeight: '600px', overflowY: 'auto', background: 'var(--bg-body)' }}>
                                    {(() => {
                                        try {
                                            let history = [];
                                            try {
                                                const parsed = JSON.parse(candidate.chat_transcript);
                                                history = Array.isArray(parsed) ? parsed : (parsed?.history || []);
                                            } catch (e) {
                                                console.error('Failed to parse transcript', e);
                                            }

                                            if (!history || history.length === 0) return <div className="text-muted italic">No conversation recorded.</div>;

                                            return history.filter(msg => msg.role !== 'system').map((msg, idx) => (
                                                <div key={idx} className={`transcript-message ${msg.role === 'model' ? 'bot' : 'user'}`}>
                                                    <div className="transcript-bubble">
                                                        <div className="role-label">{msg.role === 'model' ? 'AI Recruiter' : 'Candidate'}</div>
                                                        {msg.parts[0].text}
                                                    </div>
                                                </div>
                                            ));
                                        } catch (e) {
                                            return <div className="text-muted italic">No transcript data found.</div>;
                                        }
                                    })()}
                                </div>
                            </div>
                        </>
                    )}

                </div>

                {/* Sidebar: Actions & Files - Always Visible */}
                <div className="profile-sidebar">
                    <div className="content-card">
                        <div className="card-body">
                            <h3 className="card-title" style={{ marginBottom: '16px' }}>Documents</h3>
                            {candidate.resume_filename ? (
                                <a
                                    href={`/uploads/${candidate.resume_filename}`}
                                    target="_blank"
                                    className="file-item"
                                >
                                    <div className="file-icon">
                                        <Download size={20} />
                                    </div>
                                    <div className="file-info">
                                        <div className="file-name">Original Resume</div>
                                        <div className="file-type">PDF Document</div>
                                    </div>
                                </a>
                            ) : (
                                <div className="text-muted italic" style={{ fontSize: '14px' }}>No resume uploaded</div>
                            )}
                        </div>
                    </div>

                    <div className="content-card">
                        <div className="card-body">
                            <h3 className="card-title" style={{ marginBottom: '16px' }}>Quick Actions</h3>
                            <div className="action-group">
                                <button className="btn btn-primary btn-full" onClick={handleScheduleAction}>
                                    <Clock size={16} /> Schedule Interview
                                </button>
                                {candidate.whatsapp_number ? (
                                    <button
                                        onClick={() => {
                                            const cleanPhone = candidate.whatsapp_number.replace(/\D/g, '');
                                            window.open(`https://wa.me/${cleanPhone}`, '_blank');
                                        }}
                                        className="btn btn-full btn-whatsapp"
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <MessageSquare size={16} /> Message on WhatsApp
                                    </button>
                                ) : (
                                    <button className="btn btn-full btn-secondary" disabled style={{ opacity: 0.6, cursor: 'not-allowed' }}>
                                        <MessageSquare size={16} /> No WhatsApp
                                    </button>
                                )}
                                <button className="btn btn-secondary btn-full" onClick={() => setShowEmailModal(true)}>
                                    <Mail size={16} /> Send Email
                                </button>
                                <button className="btn btn-secondary btn-full">
                                    <Phone size={16} /> Call Candidate
                                </button>
                                {candidate.linkedin && (
                                    <a
                                        href={candidate.linkedin}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn-secondary"
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            width: '100%',
                                            boxSizing: 'border-box',
                                            color: '#0a66c2',
                                            borderColor: '#0a66c2',
                                            background: 'white',
                                            gap: '8px'
                                        }}
                                    >
                                        <Linkedin size={16} /> View LinkedIn
                                    </a>
                                )}
                                <button className="btn btn-reject btn-full" style={{ justifyContent: 'center' }}>
                                    <XCircle size={16} /> Reject Application
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ... Modals (Schedule/Email) would be here (retained from original) ... */}
            {/* Scheduling Modal */}
            {showScheduleModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
                    <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '12px', width: '400px', border: '1px solid var(--border)', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}>
                        <h3 className="text-lg font-bold mb-4" style={{ marginBottom: '16px', fontSize: '18px' }}>Schedule Interview</h3>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', color: 'var(--text-secondary)' }}>Interview Title</label>
                            <input
                                type="text"
                                className="modern-input"
                                value={scheduleData.summary}
                                onChange={(e) => setScheduleData({ ...scheduleData, summary: e.target.value })}
                                style={{ width: '100%', boxSizing: 'border-box' }}
                            />
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', color: 'var(--text-secondary)' }}>Date & Time</label>
                            <input
                                type="datetime-local"
                                className="modern-input"
                                value={scheduleData.startTime}
                                onChange={(e) => {
                                    const start = new Date(e.target.value);
                                    const end = new Date(start.getTime() + 60 * 60 * 1000); // +1 hour
                                    const endStr = new Date(end.getTime() - (end.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
                                    setScheduleData({ ...scheduleData, startTime: e.target.value, endTime: endStr });
                                }}
                                style={{ width: '100%', boxSizing: 'border-box' }}
                            />
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontSize: '12px', marginBottom: '8px', color: 'var(--text-secondary)', fontWeight: '600' }}>Meeting Platform</label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '8px', background: 'var(--bg-body)', padding: '8px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                {/* Google Meet - Only if Google Connected */}
                                {provider === 'google' && (
                                    <button
                                        onClick={() => setScheduleData({ ...scheduleData, meetingProvider: 'google' })}
                                        style={{
                                            padding: '10px 8px', borderRadius: '8px', border: '1px solid', fontSize: '12px', fontWeight: '600',
                                            borderColor: scheduleData.meetingProvider === 'google' ? '#00AC47' : 'transparent',
                                            background: scheduleData.meetingProvider === 'google' ? '#ecfdf5' : 'transparent',
                                            color: scheduleData.meetingProvider === 'google' ? '#00AC47' : 'var(--text-secondary)',
                                            cursor: 'pointer', transition: 'all 0.1s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                                        }}
                                    >
                                        <Video size={16} /> Meet
                                    </button>
                                )}

                                {/* Microsoft Teams - If Enabled */}
                                {!!userProfile?.enable_teams && (
                                    <button
                                        onClick={() => setScheduleData({ ...scheduleData, meetingProvider: 'teams' })}
                                        style={{
                                            padding: '10px 8px', borderRadius: '8px', border: '1px solid', fontSize: '12px', fontWeight: '600',
                                            borderColor: scheduleData.meetingProvider === 'teams' ? '#464EB8' : 'transparent',
                                            background: scheduleData.meetingProvider === 'teams' ? '#e0e7ff' : 'transparent',
                                            color: scheduleData.meetingProvider === 'teams' ? '#464EB8' : 'var(--text-secondary)',
                                            cursor: 'pointer', transition: 'all 0.1s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                                        }}
                                    >
                                        <Users size={16} /> Teams
                                    </button>
                                )}

                                {/* Zoom - If Enabled */}
                                {!!userProfile?.enable_zoom && (
                                    <button
                                        onClick={() => setScheduleData({ ...scheduleData, meetingProvider: 'zoom' })}
                                        style={{
                                            padding: '10px 8px', borderRadius: '8px', border: '1px solid', fontSize: '12px', fontWeight: '600',
                                            borderColor: scheduleData.meetingProvider === 'zoom' ? '#2D8CFF' : 'transparent',
                                            background: scheduleData.meetingProvider === 'zoom' ? '#dbeafe' : 'transparent',
                                            color: scheduleData.meetingProvider === 'zoom' ? '#2D8CFF' : 'var(--text-secondary)',
                                            cursor: 'pointer', transition: 'all 0.1s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                                        }}
                                    >
                                        <Zap size={16} /> Zoom
                                    </button>
                                )}

                                {/* Manual Link - If Enabled */}
                                {!!userProfile?.enable_manual && (
                                    <button
                                        onClick={() => setScheduleData({ ...scheduleData, meetingProvider: 'manual' })}
                                        style={{
                                            padding: '10px 8px', borderRadius: '8px', border: '1px solid', fontSize: '12px', fontWeight: '600',
                                            borderColor: scheduleData.meetingProvider === 'manual' ? 'var(--primary)' : 'transparent',
                                            background: scheduleData.meetingProvider === 'manual' ? '#f3f4f6' : 'transparent',
                                            color: scheduleData.meetingProvider === 'manual' ? 'var(--primary)' : 'var(--text-secondary)',
                                            cursor: 'pointer', transition: 'all 0.1s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                                        }}
                                    >
                                        <LinkIcon size={16} /> Link
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Input for Manual/External Links */}
                        {((scheduleData.meetingProvider === 'zoom' && !userProfile?.zoom_refresh_token) ||
                            scheduleData.meetingProvider === 'manual' ||
                            (scheduleData.meetingProvider === 'teams' && provider !== 'microsoft') ||
                            (scheduleData.meetingProvider === 'google' && provider !== 'google')) && (
                                <div style={{ marginBottom: '16px' }}>
                                    <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                                        {scheduleData.meetingProvider === 'zoom' ? 'Zoom Link (Not Connected)' :
                                            scheduleData.meetingProvider === 'teams' ? 'Teams Link' :
                                                scheduleData.meetingProvider === 'google' ? 'Meet Link' : 'Meeting Link'}
                                    </label>
                                    <input
                                        type="text"
                                        className="modern-input"
                                        placeholder="https://..."
                                        value={scheduleData.meetingLink}
                                        onChange={(e) => setScheduleData({ ...scheduleData, meetingLink: e.target.value })}
                                        style={{ width: '100%', boxSizing: 'border-box' }}
                                        required
                                    />
                                </div>
                            )}

                        {/* Automatic Link Messages */}
                        {scheduleData.meetingProvider === 'zoom' && userProfile?.zoom_refresh_token && (
                            <div style={{ marginBottom: '16px', fontSize: '12px', color: '#2D8CFF', background: '#eff6ff', padding: '8px', borderRadius: '6px' }}>
                                <Zap size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                                Zoom link will be generated automatically.
                            </div>
                        )}

                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', color: 'var(--text-secondary)' }}>Description</label>
                            <textarea
                                className="modern-textarea"
                                value={scheduleData.description}
                                onChange={(e) => setScheduleData({ ...scheduleData, description: e.target.value })}
                                style={{ width: '100%', boxSizing: 'border-box', minHeight: '80px' }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setShowScheduleModal(false)} className="btn btn-secondary">Cancel</button>
                            <button onClick={handleScheduleSubmit} className="btn btn-primary" disabled={isScheduling}>
                                {isScheduling ? 'Scheduling...' : 'Send Invite'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Email Modal */}
            {showEmailModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
                    <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '12px', width: '500px', border: '1px solid var(--border)', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}>
                        <h3 className="text-lg font-bold mb-4" style={{ marginBottom: '16px', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Mail size={20} /> Send Email to {candidate.name}
                        </h3>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', color: 'var(--text-secondary)' }}>Select Template</label>
                            <select
                                className="modern-input"
                                onChange={(e) => {
                                    const selected = templates.find(t => t.id === parseInt(e.target.value));
                                    if (selected) {
                                        let subject = selected.subject;
                                        let content = selected.content;

                                        const replacements = {
                                            '{{candidate_name}}': candidate.name,
                                            '{{job_title}}': candidate.job_title || 'Role',
                                            '{{company_name}}': userProfile?.company_name || 'HireFlow',
                                            '{{user_name}}': userProfile?.name || 'Recruiter'
                                        };

                                        Object.keys(replacements).forEach(key => {
                                            subject = subject.replaceAll(key, replacements[key]);
                                            content = content.replaceAll(key, replacements[key]);
                                        });

                                        setEmailData({ subject, message: content });
                                    }
                                }}
                            >
                                <option value="">-- Choose a template --</option>
                                {templates.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', color: 'var(--text-secondary)' }}>Subject</label>
                            <input
                                type="text"
                                className="modern-input"
                                value={emailData.subject}
                                onChange={(e) => setEmailData({ ...emailData, subject: e.target.value })}
                                style={{ width: '100%', boxSizing: 'border-box' }}
                                placeholder="e.g. Interview Invitation"
                            />
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', color: 'var(--text-secondary)' }}>Message</label>
                            <textarea
                                className="modern-textarea"
                                value={emailData.message}
                                onChange={(e) => setEmailData({ ...emailData, message: e.target.value })}
                                style={{ width: '100%', boxSizing: 'border-box', minHeight: '200px', fontFamily: 'inherit' }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setShowEmailModal(false)} className="btn btn-secondary">Cancel</button>
                            <button onClick={handleSendEmail} className="btn btn-primary" disabled={isSendingEmail}>
                                {isSendingEmail ? 'Sending...' : `Send via ${provider === 'microsoft' ? 'Outlook' : 'Gmail'}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function TabButton({ label, active, icon: Icon, onClick }) {
    return (
        <button
            onClick={onClick}
            style={{
                background: 'transparent',
                border: 'none',
                borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
                padding: '0 0 12px 0',
                margin: 0,
                color: active ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: active ? '600' : '500',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontSize: '14px'
            }}
        >
            <Icon size={18} />
            {label}
        </button>
    );
}

function ConversationBox({ candidate, email }) {
    const [threads, setThreads] = useState([]);
    const [selectedThreadId, setSelectedThreadId] = useState(null);
    const [loading, setLoading] = useState(true); // Added back from original
    const [replyText, setReplyText] = useState('');
    const [sending, setSending] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [adminEmail, setAdminEmail] = useState('');
    const [adminName, setAdminName] = useState('');

    const [showDebug, setShowDebug] = useState(false);
    const [rawCount, setRawCount] = useState(0);

    // Fetch Admin Profile
    useEffect(() => {
        const token = localStorage.getItem('token');
        fetch('/api/user/profile', { headers: { 'Authorization': `Bearer ${token}` } })
            .then(res => res.json())
            .then(data => {
                setAdminEmail(data.email || '');
                setAdminName(data.name || 'Admin');
            })
            .catch(err => console.error('Failed to fetch admin profile', err));
    }, []);

    const fetchEmails = async () => {
        if (!email) {
            console.log('[ConversationBox] No email provided, stopping fetch.');
            setLoading(false);
            return;
        }

        console.log('[ConversationBox] Fetching emails for:', email);
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/gmail/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ email, filterType: 'all' })
            });

            console.log('[ConversationBox] API Response Status:', res.status);

            if (res.ok) {
                const data = await res.json();
                console.log('[ConversationBox] Data Received:', data);

                const raw = data.messages || [];
                setRawCount(raw.length);

                // Group by Thread ID
                const threadMap = {};
                raw.forEach(msg => {
                    if (!threadMap[msg.threadId]) {
                        threadMap[msg.threadId] = [];
                    }
                    threadMap[msg.threadId].push(msg);
                });

                // Process Threads
                const threadList = Object.keys(threadMap).map(threadId => {
                    const threadMsgs = threadMap[threadId];
                    // Sort messages in thread: Oldest to Newest
                    threadMsgs.sort((a, b) => new Date(a.date) - new Date(b.date));
                    const latest = threadMsgs[threadMsgs.length - 1];
                    return {
                        id: threadId, // Thread ID
                        messages: threadMsgs,
                        latestMessage: latest,
                        lastUpdated: new Date(latest.date)
                    };
                });

                // Sort Threads: Newest Updated First
                threadList.sort((a, b) => b.lastUpdated - a.lastUpdated);
                setThreads(threadList);

                // Auto-select first thread
                if (!selectedThreadId && threadList.length > 0) {
                    setSelectedThreadId(threadList[0].id);
                }
            } else {
                console.error('[ConversationBox] API Error:', await res.text());
            }
        } catch (e) {
            console.error('[ConversationBox] Failed to fetch emails', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        console.log('[ConversationBox] Component Mounted/Updated. Email:', email);
        fetchEmails();
        const interval = setInterval(fetchEmails, 15000);
        return () => clearInterval(interval);
    }, [email, refreshTrigger]);

    const selectedThread = threads.find(t => t.id === selectedThreadId);

    const handleSendReply = async () => {
        if (!replyText.trim() || !selectedThread) return;
        setSending(true);
        const lastMsg = selectedThread.latestMessage;

        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/gmail/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    to: email,
                    subject: lastMsg ? (lastMsg.subject.startsWith('Re:') ? lastMsg.subject : `Re: ${lastMsg.subject}`) : 'Conversation',
                    message: replyText,
                    inReplyTo: lastMsg?.id,
                    threadId: lastMsg?.threadId
                })
            });
            if (!res.ok) throw new Error('Failed to send');
            setReplyText('');
            setTimeout(() => setRefreshTrigger(p => p + 1), 2000);
        } catch (err) {
            alert(err.message);
        } finally {
            setSending(false);
        }
    };

    if (!rawCount && !loading && !sending && threads.length === 0) return (
        <div className="card-body" style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '12px', marginTop: '24px' }}>
            <Mail size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px', color: '#334155' }}>No conversation yet</h3>
            <p style={{ marginBottom: '24px' }}>Find any activity for <b>{email}</b>.</p>
            <textarea
                className="modern-textarea"
                placeholder="Type your first email..."
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                style={{ display: 'block', width: '100%', minHeight: '100px', marginBottom: '12px' }}
            />
            <button className="btn btn-primary" onClick={handleSendReply} disabled={sending || !replyText}>
                {sending ? 'Sending...' : `Send Initial Email`}
            </button>
        </div>
    );

    // Auto-resize textarea
    const textareaRef = useRef(null);
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'; // Reset
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [replyText]);

    const [attachment, setAttachment] = useState(null);
    const fileInputRef = useRef(null);

    const handleFileSelect = (e) => {
        if (e.target.files && e.target.files[0]) {
            setAttachment(e.target.files[0]);
        }
    };

    return (
        <div style={{ height: '75vh', display: 'flex', flexDirection: 'column', marginTop: '16px' }}>
            <div className="content-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid #cbd5e1', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #e2e8f0', background: '#ffffff', zIndex: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: '#eff6ff', padding: '8px', borderRadius: '50%', color: '#2563eb' }}>
                            <Mail size={20} />
                        </div>
                        <div>
                            <h2 className="card-title" style={{ margin: 0, fontSize: '16px' }}>Conversation History</h2>
                            <div style={{ fontSize: '12px', color: '#64748b' }}>
                                {email} • {threads.length} threads
                            </div>
                        </div>
                    </div>
                    <button onClick={() => setRefreshTrigger(p => p + 1)} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '13px', height: '36px', gap: '8px' }}>
                        <RefreshCw size={14} /> Sync Emails
                    </button>
                </div>

                {/* CHAT AREA */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '24px' }}>

                    {loading && threads.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                            <div className="spin" style={{ display: 'inline-block', marginBottom: '12px' }}><RefreshCw size={24} /></div>
                            <div>Loading conversation history...</div>
                        </div>
                    )}

                    {!loading && threads.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
                            <Mail size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px', color: '#475569' }}>No valid email conversation found</h3>
                            <p>Emails exchanged with <b>{email}</b> will appear here automatically.</p>
                        </div>
                    )}

                    {(!selectedThread && threads.length > 0) ? (
                        /* If somehow no thread selected but we have threads, show list to pick */
                        <div style={{ textAlign: 'center', padding: '40px' }}>
                            <p>Please select a conversation to view.</p>
                            {/* Auto-select usually handles this, but fallback: */}
                            {threads.map(t => (
                                <button key={t.id} onClick={() => setSelectedThreadId(t.id)} className="btn btn-secondary" style={{ margin: '4px' }}>
                                    View Thread {t.latestMessage.subject}
                                </button>
                            ))}
                        </div>
                    ) : (
                        /* RENDER MESSAGES IN CHAT STYLE */
                        selectedThread && selectedThread.messages.map((msg, idx) => {
                            const isSent = msg.labelIds?.includes('SENT');
                            const isFromMe = adminEmail && msg.from?.toLowerCase().includes(adminEmail.toLowerCase());
                            const isMe = isSent || isFromMe;

                            return (
                                <div key={msg.id} style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: isMe ? 'flex-end' : 'flex-start',
                                    maxWidth: '85%',
                                    alignSelf: isMe ? 'flex-end' : 'flex-start',
                                    animation: 'fadeIn 0.3s ease-out'
                                }}>
                                    <div style={{
                                        display: 'flex',
                                        gap: '8px',
                                        flexDirection: isMe ? 'row-reverse' : 'row',
                                        alignItems: 'flex-end',
                                        marginBottom: '4px'
                                    }}>
                                        <div style={{
                                            width: '32px', height: '32px', borderRadius: '50%',
                                            background: isMe ? '#dbeafe' : '#f1f5f9',
                                            color: isMe ? '#1e40af' : '#64748b',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '14px', fontWeight: '700', flexShrink: 0,
                                            border: '1px solid rgba(0,0,0,0.05)'
                                        }}>
                                            {isMe ? 'Me' : candidate.name?.charAt(0)}
                                        </div>
                                        <div style={{
                                            fontSize: '12px', color: '#64748b', fontWeight: '500',
                                            marginBottom: '6px'
                                        }}>
                                            {isMe ? 'You' : candidate.name} • {new Date(msg.date).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>

                                    <div style={{
                                        background: isMe ? '#eff6ff' : '#ffffff',
                                        padding: '16px 20px',
                                        borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
                                        border: isMe ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                                        width: '100%',
                                        position: 'relative'
                                    }}>
                                        {/* Subject line tiny if needed */}
                                        <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px', borderBottom: isMe ? '1px solid #dbeafe' : '1px solid #f1f5f9', paddingBottom: '6px' }}>
                                            Subject: {msg.subject}
                                        </div>

                                        <div
                                            className="email-body-content"
                                            style={{ fontSize: '14px', lineHeight: '1.6', color: '#1e293b' }}
                                            dangerouslySetInnerHTML={{
                                                __html: DOMPurify.sanitize(msg.body || msg.snippet || '', {
                                                    USE_PROFILES: { html: true },
                                                    FORBID_TAGS: ['script', 'style', 'iframe', 'form', 'object', 'embed', 'link', 'head', 'meta']
                                                })
                                            }}
                                        />
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* COMPOSE AREA */}
                <div style={{ background: '#ffffff', borderTop: '1px solid #e2e8f0', padding: '16px 24px' }}>
                    <div style={{
                        border: '1px solid #cbd5e1',
                        borderRadius: '24px',
                        padding: '10px 16px',
                        background: '#f8fafc',
                        display: 'flex',
                        alignItems: 'flex-end',
                        gap: '12px',
                        transition: 'all 0.2s'
                    }}>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            style={{ display: 'none' }}
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                                padding: '8px',
                                background: attachment ? '#dbeafe' : 'transparent',
                                border: 'none',
                                borderRadius: '50%',
                                cursor: 'pointer',
                                color: attachment ? '#2563eb' : '#64748b'
                            }}
                            title={attachment ? attachment.name : "Attach file"}
                        >
                            <Paperclip size={20} />
                        </button>

                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                            {attachment && (
                                <div style={{ fontSize: '12px', color: '#2563eb', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ fontWeight: '600' }}>Attachment:</span> {attachment.name}
                                    <button onClick={() => setAttachment(null)} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', padding: 0, marginLeft: '4px' }}>
                                        <XCircle size={12} />
                                    </button>
                                </div>
                            )}
                            <textarea
                                ref={textareaRef}
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder={`Message ${candidate.name}...`}
                                style={{
                                    width: '100%',
                                    minHeight: '24px',
                                    maxHeight: '150px',
                                    border: 'none',
                                    resize: 'none',
                                    outline: 'none',
                                    fontSize: '15px',
                                    fontFamily: 'inherit',
                                    color: '#0f172a',
                                    background: 'transparent',
                                    padding: '4px 0',
                                    lineHeight: '1.5'
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendReply();
                                    }
                                }}
                            />
                        </div>

                        <button
                            onClick={handleSendReply}
                            disabled={sending || (!replyText.trim() && !attachment)}
                            style={{
                                padding: '8px',
                                borderRadius: '50%',
                                background: (sending || (!replyText.trim() && !attachment)) ? '#cbd5e1' : 'var(--primary)',
                                color: 'white',
                                border: 'none',
                                cursor: (sending || (!replyText.trim() && !attachment)) ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                        >
                            {sending ? <RefreshCw className="spin" size={18} /> : <Send size={18} />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}


function InterviewNotesSection({ candidateId, preview }) {
    const [interviews, setInterviews] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchInterviews = async () => {
            try {
                const res = await fetch(`/api/candidates/${candidateId}/interviews`);
                if (res.ok) {
                    const data = await res.json();
                    setInterviews(data.interviews || []);
                }
            } catch (e) {
                console.error('Failed to fetch interviews', e);
            } finally {
                setLoading(false);
            }
        };
        fetchInterviews();
    }, [candidateId]);

    if (loading) return null;
    if (interviews.length === 0) return <div className="text-muted italic" style={{ padding: '20px' }}>No interviews yet.</div>;

    const displayInterviews = preview ? interviews.slice(0, 1) : interviews;

    return (
        <div className={preview ? "" : "content-card"}>
            {!preview && (
                <div className="card-header">
                    <FileText size={18} className="text-muted" />
                    <h2 className="card-title">Interview Notes</h2>
                </div>
            )}
            <div className={preview ? "" : "card-body"}>
                {displayInterviews.map(interview => (
                    <div key={interview.id} style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <div style={{ fontWeight: '600' }}>{interview.title}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                {new Date(interview.scheduled_at).toLocaleDateString()}
                            </div>
                        </div>
                        <div style={{ fontSize: '14px', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', background: 'var(--bg-body)', padding: '12px', borderRadius: '8px' }}>
                            {interview.notes || <span style={{ fontStyle: 'italic' }}>No notes taken yet.</span>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function UpcomingInterviewCard({ candidateId }) {
    const [upcoming, setUpcoming] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isRescheduling, setIsRescheduling] = useState(false);
    const [newDate, setNewDate] = useState('');
    const [newTime, setNewTime] = useState('');

    const fetchUpcoming = async () => {
        try {
            const res = await fetch(`/api/candidates/${candidateId}/interviews`);
            if (res.ok) {
                const data = await res.json();
                const now = new Date();
                const next = (data.interviews || [])
                    .filter(i => new Date(i.scheduled_at) > now)
                    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))[0];
                setUpcoming(next);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUpcoming();
    }, [candidateId]);

    const handleReschedule = async () => {
        if (!newDate || !newTime) return alert('Please select date and time');

        const scheduledAt = new Date(`${newDate}T${newTime}`).toISOString();

        try {
            const res = await fetch(`/api/interviews/${upcoming.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scheduled_at: scheduledAt })
            });

            if (res.ok) {
                alert('Interview rescheduled successfully!');
                setIsRescheduling(false);
                fetchUpcoming();
                window.location.reload();
            }
        } catch (err) {
            console.error(err);
            alert('Failed to reschedule');
        }
    };

    if (loading) return null;
    if (!upcoming) return null;

    return (
        <div style={{
            background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
            borderRadius: '16px',
            padding: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '24px',
            border: '1px solid #bfdbfe'
        }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{ background: 'white', padding: '12px', borderRadius: '12px', color: '#2563eb' }}>
                    <Calendar size={24} />
                </div>
                <div>
                    <div style={{ color: '#1e40af', fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px' }}>
                        Upcoming Interview
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e3a8a' }}>
                        {new Date(upcoming.scheduled_at).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px', color: '#1e40af' }}>
                        <Clock size={14} />
                        {new Date(upcoming.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>
            </div>

            <div>
                {!isRescheduling ? (
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {upcoming.meeting_link && (
                            <a
                                href={upcoming.meeting_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn"
                                style={{
                                    padding: '8px 16px',
                                    gap: '8px',
                                    background: upcoming.meeting_link.includes('zoom.us') ? '#2D8CFF' : (upcoming.meeting_link.includes('google.com') ? '#00AC47' : 'var(--primary)'),
                                    color: 'white',
                                    border: 'none'
                                }}
                            >
                                {upcoming.meeting_link.includes('zoom.us') ? <Zap size={16} fill="white" /> : <Video size={16} />}
                                {upcoming.meeting_link.includes('zoom.us') ? 'Join Zoom' : (upcoming.meeting_link.includes('google.com') ? 'Join Meet' : 'Join Meeting')}
                            </a>
                        )}
                        <button
                            onClick={() => setIsRescheduling(true)}
                            className="btn"
                            style={{ background: 'white', color: '#2563eb', border: '1px solid #bfdbfe', fontWeight: '600' }}
                        >
                            <Edit size={16} /> Reschedule
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', gap: '8px', padding: '8px', background: 'rgba(255,255,255,0.5)', borderRadius: '8px' }}>
                        <input type="date" className="form-input" style={{ width: '130px', padding: '6px' }} onChange={e => setNewDate(e.target.value)} />
                        <input type="time" className="form-input" style={{ width: '100px', padding: '6px' }} onChange={e => setNewTime(e.target.value)} />
                        <button onClick={handleReschedule} className="btn btn-primary" style={{ padding: '6px 12px' }}>Save</button>
                        <button onClick={() => setIsRescheduling(false)} className="btn btn-secondary" style={{ padding: '6px' }}><XCircle size={16} /></button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default CandidateProfile;
