
import { useState, useEffect, useRef } from 'react';
import * as LucideIcons from 'lucide-react';

// Fallback icons in case of import issues
const Save = LucideIcons.Save || (() => <span>💾</span>);
const Upload = LucideIcons.Upload || (() => <span>⬆️</span>);
const Moon = LucideIcons.Moon || (() => <span>🌙</span>);
const Globe = LucideIcons.Globe || (() => <span>🌐</span>);
const Calendar = LucideIcons.Calendar || (() => <span>🗓️</span>);
const Mail = LucideIcons.Mail || (() => <span>✉️</span>);
const LinkIcon = LucideIcons.Link || (() => <span>🔗</span>);
const Video = LucideIcons.Video || (() => <span>📹</span>);
const Users = LucideIcons.Users || (() => <span>👥</span>);
const Zap = LucideIcons.Zap || (() => <span>⚡</span>);
const CheckCircle = LucideIcons.CheckCircle || (() => <span>✅</span>);


function Settings({ theme, toggleTheme }) {
    const [profile, setProfile] = useState({
        company_name: '',
        company_description: '',
        company_website: '',
        company_logo: '',
        enable_teams: false,
        enable_zoom: false,
        enable_manual: true

    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    // Integrations State
    const [isCalendarConnected, setIsCalendarConnected] = useState(false);
    const [isMicrosoftConnected, setIsMicrosoftConnected] = useState(false);
    const [isZoomConnected, setIsZoomConnected] = useState(false);
    const [calendarLoading, setCalendarLoading] = useState(false);



    useEffect(() => {
        fetchProfile();
        checkForOAuthCallback();


    }, []);



    const fetchProfile = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/user/profile', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                if (data.profile) {
                    setProfile(prev => ({ ...prev, ...data.profile }));
                }
                // Handle flat structure as well just in case
                if (data.company_name) {
                    setProfile(prev => ({ ...prev, ...data }));
                }
                setIsCalendarConnected(!!data.tokens?.google || !!data.profile?.google_refresh_token);
                setIsMicrosoftConnected(!!data.tokens?.microsoft || !!data.profile?.microsoft_refresh_token);
                setIsZoomConnected(!!data.tokens?.zoom || !!data.profile?.zoom_refresh_token);
            }
        } catch (err) {
            console.error('Failed to fetch profile', err);
        } finally {
            setLoading(false);
        }
    };

    const processingRef = useRef(false);

    const checkForOAuthCallback = async () => {
        const params = new URLSearchParams(window.location.search);

        // Handle Microsoft Success Redirect
        if (params.get('auth') === 'microsoft_success') {
            setIsMicrosoftConnected(true);
            setIsCalendarConnected(false); // Exclusive
            setMessage({ type: 'success', text: 'Microsoft account connected successfully!' });
            window.history.replaceState({}, document.title, window.location.pathname);
            return;
        }

        // Handle Zoom Success
        if (params.get('auth') === 'zoom_success') {
            setIsZoomConnected(true);
            setProfile(prev => ({ ...prev, enable_zoom: 1 }));
            setMessage({ type: 'success', text: 'Zoom connected successfully!' });
            window.history.replaceState({}, document.title, window.location.pathname);
            return;
        }

        const code = params.get('code');
        if (code && !processingRef.current) {
            processingRef.current = true;
            setCalendarLoading(true);
            try {
                // Try Google callback (still POST for now)
                const googleRes = await fetch('/api/auth/google/callback', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify({ code })
                });

                if (googleRes.ok) {
                    setIsCalendarConnected(true);
                    setIsMicrosoftConnected(false); // Exclusive
                    setMessage({ type: 'success', text: 'Google Calendar connected successfully!' });
                    window.history.replaceState({}, document.title, window.location.pathname);
                }
            } catch (err) {
                console.error('OAuth callback error', err);
            } finally {
                setCalendarLoading(false);
                processingRef.current = false;
            }
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setProfile(prev => ({ ...prev, [name]: value }));
    };

    const handleLogoUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setProfile(prev => ({ ...prev, company_logo: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleToggleMicrosoft = async () => {
        if (isMicrosoftConnected) {
            if (confirm('Are you sure you want to disconnect Microsoft?')) {
                setCalendarLoading(true);
                try {
                    const res = await fetch('/api/auth/microsoft/disconnect', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                    });
                    if (res.ok) {
                        setIsMicrosoftConnected(false);
                        setMessage({ type: 'success', text: 'Microsoft account disconnected.' });
                    }
                } catch (err) {
                    console.error('Failed to disconnect MS', err);
                } finally {
                    setCalendarLoading(false);
                }
            }
        } else {
            setCalendarLoading(true);
            try {
                const res = await fetch('/api/auth/microsoft', {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                const data = await res.json();
                if (data.url) {
                    window.location.href = data.url;
                }
            } catch (err) {
                console.error('Failed to get MS auth url', err);
                setCalendarLoading(false);
                setMessage({ type: 'error', text: 'Could not initiate Microsoft connection.' });
            }
        }
    };

    const handleToggleCalendar = async () => {
        if (isCalendarConnected) {
            if (confirm('Are you sure you want to disconnect Google?')) {
                setCalendarLoading(true);
                try {
                    const res = await fetch('/api/auth/google/disconnect', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                    });
                    if (res.ok) {
                        setIsCalendarConnected(false);
                        setMessage({ type: 'success', text: 'Google account disconnected.' });
                    }
                } catch (err) {
                    console.error('Failed to disconnect Google', err);
                } finally {
                    setCalendarLoading(false);
                }
            }
        } else {
            // Connect - Redirect to Google
            setCalendarLoading(true);
            try {
                const res = await fetch('/api/auth/google?state=settings');
                const data = await res.json();
                if (data.url) {
                    window.location.href = data.url;
                }
            } catch (err) {
                console.error('Failed to get auth url', err);
                setCalendarLoading(false);
                setMessage({ type: 'error', text: 'Could not initiate connection.' });
            }
        }
    };

    const handleToggleZoom = async () => {
        if (isZoomConnected) {
            if (confirm('Are you sure you want to disconnect Zoom?')) {
                setCalendarLoading(true);
                try {
                    const res = await fetch('/api/auth/zoom/disconnect', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                    });
                    if (res.ok) {
                        setIsZoomConnected(false);
                        setMessage({ type: 'success', text: 'Zoom disconnected.' });
                    }
                } catch (err) {
                    console.error('Failed to disconnect Zoom', err);
                } finally {
                    setCalendarLoading(false);
                }
            }
        } else {
            setCalendarLoading(true);
            try {
                const res = await fetch('/api/auth/zoom');
                const data = await res.json();
                if (data.url) {
                    window.location.href = data.url;
                }
            } catch (err) {
                console.error('Failed to get Zoom auth url', err);
                setCalendarLoading(false);
                setMessage({ type: 'error', text: 'Could not initiate Zoom connection.' });
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/user/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(profile)
            });

            if (res.ok) {
                setMessage({ type: 'success', text: 'Settings saved successfully' });
            } else {
                setMessage({ type: 'error', text: 'Failed to save settings' });
            }
        } catch (err) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8">Loading settings...</div>;

    return (
        <div className="page-container" style={{ maxWidth: '800px' }}>
            <h1 style={{ marginBottom: '8px' }}>Settings</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>Manage your company profile and application preferences.</p>

            <form onSubmit={handleSubmit}>
                {/* Personal Details Section */}
                <div className="content-card" style={{ marginBottom: '24px' }}>
                    <div className="card-header">
                        <h3 className="card-title">Personal Details</h3>
                    </div>
                    <div className="card-body">
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                            <div className="form-section">
                                <label className="form-label">Your Name</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={profile.name || ''}
                                    onChange={handleChange}
                                    placeholder="e.g. Jane Doe"
                                    className="modern-input"
                                />
                            </div>
                            <div className="form-section">
                                <label className="form-label">Your Role</label>
                                <input
                                    type="text"
                                    name="role"
                                    value={profile.role || ''}
                                    onChange={handleChange}
                                    placeholder="e.g. HR Manager"
                                    className="modern-input"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Company Profile Section */}
                <div className="content-card" style={{ marginBottom: '24px' }}>
                    <div className="card-header">
                        <h3 className="card-title">Company Profile</h3>
                    </div>
                    <div className="card-body">
                        <div className="form-section">
                            <label className="form-label">Company Name</label>
                            <input
                                type="text"
                                name="company_name"
                                value={profile.company_name}
                                onChange={handleChange}
                                placeholder="e.g. Acme Corp"
                                className="modern-input"
                            />
                        </div>

                        <div className="form-section">
                            <label className="form-label">Company Website</label>
                            <div style={{ position: 'relative' }}>
                                <div style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-secondary)' }}>
                                    <Globe size={18} />
                                </div>
                                <input
                                    type="text"
                                    name="company_website"
                                    value={profile.company_website}
                                    onChange={handleChange}
                                    placeholder="https://"
                                    className="modern-input"
                                    style={{ paddingLeft: '40px' }}
                                />
                            </div>
                        </div>

                        <div className="form-section">
                            <label className="form-label">About the Company</label>
                            <p className="form-hint">This description will be used by the AI Recruiter to answer candidate questions.</p>
                            <textarea
                                className="modern-textarea"
                                name="company_description"
                                value={profile.company_description}
                                onChange={handleChange}
                                placeholder="Describe your company culture, mission, and what makes it a great place to work..."
                                style={{ minHeight: '120px' }}
                            />
                        </div>
                    </div>
                </div>
                {/* Meeting Providers Section */}
                <div className="content-card" style={{ marginBottom: '24px' }}>
                    <div className="card-header">
                        <h3 className="card-title">Meeting Providers</h3>
                    </div>
                    <div className="card-body">
                        <p className="form-hint" style={{ marginBottom: '16px' }}>Select which platforms you want to be available when scheduling interviews.</p>

                        {/* Google Meet (Status Only) */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <Video size={20} color={(isCalendarConnected || !!profile.google_refresh_token) ? '#00AC47' : 'var(--text-secondary)'} />
                                <div>
                                    <div style={{ fontWeight: '600' }}>Google Meet</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                        {(isCalendarConnected || !!profile.google_refresh_token) ? 'Available (via Google Workspace)' : 'Connect Google Workspace to enable'}
                                    </div>
                                </div>
                            </div>
                            <div style={{ opacity: 0.7 }}>
                                {(isCalendarConnected || !!profile.google_refresh_token) ? <CheckCircle size={20} color="#00AC47" /> : <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Not Connected</span>}
                            </div>
                        </div>

                        {/* Microsoft Teams */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <Users size={20} color="#464EB8" />
                                <div>
                                    <div style={{ fontWeight: '600' }}>Microsoft Teams</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                        {profile.enable_teams ? (isMicrosoftConnected ? 'Enabled & Connected' : 'Enabled - Requires Microsoft Connection') : 'Disabled'}
                                    </div>
                                </div>
                            </div>
                            <label className="toggle-switch">
                                <input
                                    type="checkbox"
                                    checked={!!profile.enable_teams}
                                    onChange={(e) => setProfile(prev => ({ ...prev, enable_teams: e.target.checked ? 1 : 0 }))}
                                />
                                <span className="slider round"></span>
                            </label>
                        </div>

                        {/* Zoom */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <Zap size={20} color="#2D8CFF" />
                                <div>
                                    <div style={{ fontWeight: '600' }}>Zoom</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                        {profile.enable_zoom ? (isZoomConnected ? 'Enabled & Connected' : 'Enabled - Requires Zoom Connection') : 'Disabled'}
                                    </div>
                                    {!!profile.enable_zoom && (
                                        <button
                                            onClick={handleToggleZoom}
                                            style={{
                                                marginTop: '4px',
                                                fontSize: '11px',
                                                padding: '4px 8px',
                                                background: isZoomConnected ? '#fee2e2' : '#dbeafe',
                                                color: isZoomConnected ? '#991b1b' : '#1e40af',
                                                border: 'none',
                                                borderRadius: '4px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {isZoomConnected ? 'Disconnect Zoom' : 'Connect Zoom'}
                                        </button>
                                    )}
                                </div>
                            </div>
                            <label className="toggle-switch">
                                <input
                                    type="checkbox"
                                    checked={!!profile.enable_zoom}
                                    onChange={(e) => setProfile(prev => ({ ...prev, enable_zoom: e.target.checked ? 1 : 0 }))}
                                />
                                <span className="slider round"></span>
                            </label>
                        </div>

                        {/* Manual Link */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <LinkIcon size={20} color="var(--text-secondary)" />
                                <div>
                                    <div style={{ fontWeight: '600' }}>Custom Meetings</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Allow manual entry for other platforms</div>
                                </div>
                            </div>
                            <label className="toggle-switch">
                                <input
                                    type="checkbox"
                                    checked={!!profile.enable_manual}
                                    onChange={(e) => setProfile(prev => ({ ...prev, enable_manual: e.target.checked ? 1 : 0 }))}
                                />
                                <span className="slider round"></span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Branding Section */}
                <div className="content-card" style={{ marginBottom: '24px' }}>
                    <div className="card-header">
                        <h3 className="card-title">Branding</h3>
                    </div>
                    <div className="card-body">
                        <div className="form-section">
                            <label className="form-label">Company Logo</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                                <div style={{
                                    width: '80px',
                                    height: '80px',
                                    borderRadius: '12px',
                                    border: '1px dashed var(--border)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: 'var(--bg-body)',
                                    fontWeight: '600',
                                    color: 'var(--text-secondary)',
                                    overflow: 'hidden'
                                }}>
                                    {profile.company_logo ? (
                                        <img
                                            src={profile.company_logo}
                                            alt="Company Logo"
                                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                        />
                                    ) : (
                                        'LOGO'
                                    )}
                                </div>
                                <div>
                                    <input
                                        type="file"
                                        id="logo-upload"
                                        accept="image/*"
                                        style={{ display: 'none' }}
                                        onChange={handleLogoUpload}
                                    />
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={() => document.getElementById('logo-upload').click()}
                                    >
                                        <Upload size={16} /> Upload New Logo
                                    </button>
                                    <p className="form-hint" style={{ marginTop: '8px' }}>Recommended size: 400x400px</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Integrations Section */}
                <div className="content-card" style={{ marginBottom: '24px' }}>
                    <div className="card-header">
                        <h3 className="card-title">Integrations</h3>
                    </div>
                    <div className="card-body">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                            {/* Calendly Integration (HIDDEN) */}
                            {false && (
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                        <div style={{ width: '40px', height: '40px', background: '#006BFF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
                                            C
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: '600', fontSize: '15px' }}>Calendly</div>
                                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Automate interview scheduling status</div>
                                        </div>
                                    </div>

                                    <div style={{ background: 'var(--bg-body)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                        <div className="form-section" style={{ marginBottom: '16px' }}>
                                            <label className="form-label">Personal Scheduling Link</label>
                                            <input
                                                type="text"
                                                name="calendly_link"
                                                value={profile.calendly_link || ''}
                                                onChange={handleChange}
                                                placeholder="https://calendly.com/your-name"
                                                className="modern-input"
                                            />
                                            <p className="form-hint">Used in automated emails to candidates.</p>
                                        </div>

                                        <div className="form-section" style={{ marginBottom: '16px' }}>
                                            <label className="form-label">Calendly API Token (Optional - For Auto-Sync)</label>
                                            <div style={{ position: 'relative' }}>
                                                <input
                                                    type={profile.calendly_auth_token ? "password" : "text"}
                                                    name="calendly_auth_token"
                                                    value={profile.calendly_auth_token || ''}
                                                    onChange={handleChange}
                                                    placeholder="Paste Personal Access Token"
                                                    className="modern-input"
                                                    style={{ paddingRight: '80px' }}
                                                />
                                                {profile.calendly_auth_token && (
                                                    <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#16a34a', fontSize: '12px', fontWeight: 'bold' }}>
                                                        Connected
                                                    </span>
                                                )}
                                            </div>
                                            <p className="form-hint">
                                                Generating a token allows the system to auto-detect booked interviews.
                                                <a href="https://calendly.com/integrations/api_webhooks" target="_blank" rel="noreferrer" style={{ marginLeft: '4px', color: 'var(--primary)' }}>Get Token</a>
                                            </p>
                                        </div>

                                        <div className="form-section" style={{ marginBottom: '0' }}>
                                            <label className="form-label">Webhook URL (For Calendly Settings)</label>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <input
                                                    type="text"
                                                    readOnly
                                                    value={`${window.location.origin}/api/webhooks/calendly`}
                                                    className="modern-input"
                                                    style={{ background: '#e2e8f0', color: '#64748b' }}
                                                />
                                                <button
                                                    type="button"
                                                    className="btn btn-secondary"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(`${window.location.origin}/api/webhooks/calendly`);
                                                        setMessage({ type: 'success', text: 'Webhook URL copied!' });
                                                    }}
                                                >
                                                    Copy
                                                </button>
                                            </div>
                                            <p className="form-hint">Paste this into Calendly Integrations 'Webhooks' section to auto-update candidate status.</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div style={{ height: '1px', background: 'var(--border)' }}></div>

                            {/* Google Calendar */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <div style={{ width: '40px', height: '40px', background: '#e8f0fe', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1967d2' }}>
                                        <Calendar size={20} />
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: '600', fontSize: '15px' }}>Google Workspace (Verified)</div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Sync Calendar & Send Emails via Gmail</div>
                                    </div>
                                </div>
                                <button
                                    className={(isCalendarConnected || !!profile.google_refresh_token) ? 'btn btn-secondary' : 'btn btn-primary'}
                                    onClick={handleToggleCalendar}
                                    disabled={calendarLoading}
                                    style={{ minWidth: '100px', fontSize: '13px', padding: '6px 12px' }}
                                >
                                    {calendarLoading ? 'Processing...' : ((isCalendarConnected || !!profile.google_refresh_token) ? 'Disconnect' : 'Connect')}
                                </button>
                            </div>

                            <div style={{ height: '1px', background: 'var(--border)' }}></div>

                            {/* Microsoft Outlook */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <div style={{ width: '40px', height: '40px', background: '#f0f4f8', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0078d4' }}>
                                        <Mail size={20} />
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: '600', fontSize: '15px' }}>Microsoft Outlook</div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Sync Calendar & Send Emails</div>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className={isMicrosoftConnected ? 'btn btn-secondary' : 'btn btn-primary'}
                                    onClick={handleToggleMicrosoft}
                                    disabled={calendarLoading}
                                    style={{ minWidth: '100px', fontSize: '13px', padding: '6px 12px' }}
                                >
                                    {calendarLoading ? 'Processing...' : (isMicrosoftConnected ? 'Disconnect' : 'Connect')}
                                </button>
                            </div>

                        </div>
                    </div>
                </div>

                {/* Email Configuration (SMTP fallback) - HIDDEN as per request */}
                {false && (
                    <div className="content-card" style={{ marginBottom: '24px' }}>
                        <div className="card-header">
                            <h3 className="card-title">Email Configuration (Advanced)</h3>
                        </div>
                        <div className="card-body">
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                                Configure a custom SMTP server to ensure invitations are sent reliably if Google/Outlook fails.
                            </p>
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div className="form-section">
                                    <label className="form-label">SMTP Host</label>
                                    <input type="text" name="smtp_host" value={profile.smtp_host || ''} onChange={handleChange} placeholder="smtp.gmail.com" className="modern-input" />
                                </div>
                                <div className="form-section">
                                    <label className="form-label">Port</label>
                                    <input type="number" name="smtp_port" value={profile.smtp_port || ''} onChange={handleChange} placeholder="587" className="modern-input" />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div className="form-section">
                                    <label className="form-label">Username / Email</label>
                                    <input type="text" name="smtp_user" value={profile.smtp_user || ''} onChange={handleChange} placeholder="user@example.com" className="modern-input" />
                                </div>
                                <div className="form-section">
                                    <label className="form-label">
                                        Password / App Password
                                        <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--primary)', fontWeight: 'normal' }}>
                                            (Generate Here)
                                        </a>
                                    </label>
                                    <input type="password" name="smtp_pass" value={profile.smtp_pass || ''} onChange={handleChange} placeholder="••••••••" className="modern-input" />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Preferences Section */}
                <div className="content-card" style={{ marginBottom: '24px' }}>
                    <div className="card-header">
                        <h3 className="card-title">Preferences</h3>
                    </div>
                    <div className="card-body">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '8px',
                                    background: 'var(--bg-body)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--text-secondary)',
                                    border: '1px solid var(--border)'
                                }}>
                                    <Moon size={20} />
                                </div>
                                <div>
                                    <div style={{ fontWeight: '600' }}>Dark Mode</div>
                                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Switch to a darker theme for low-light environments</div>
                                </div>
                            </div>
                            <div style={{
                                width: '48px',
                                height: '24px',
                                background: theme === 'dark' ? 'var(--primary)' : '#e2e8f0',
                                borderRadius: '12px',
                                position: 'relative',
                                cursor: 'pointer',
                                transition: 'background 0.3s'
                            }} onClick={toggleTheme} title="Toggle Dark Mode">
                                <div style={{
                                    width: '20px',
                                    height: '20px',
                                    background: 'white',
                                    borderRadius: '50%',
                                    position: 'absolute',
                                    top: '2px',
                                    left: theme === 'dark' ? '26px' : '2px',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                                    transition: 'left 0.3s'
                                }}></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', marginBottom: '40px' }}>
                    <button type="submit" className="btn btn-primary" disabled={saving} style={{ padding: '12px 32px' }}>
                        {saving ? 'Saving...' : <><Save size={18} /> Save Settings</>}
                    </button>
                </div>

                {
                    message && (
                        <div style={{
                            position: 'fixed',
                            bottom: '32px',
                            right: '32px',
                            padding: '16px 24px',
                            background: message.type === 'success' ? '#10b981' : '#ef4444',
                            color: 'white',
                            borderRadius: '8px',
                            boxShadow: 'var(--shadow-lg)',
                            animation: 'slideIn 0.3s ease',
                            zIndex: 100
                        }}>
                            {message.text}
                        </div>
                    )
                }
            </form >
        </div >
    );
}

export default Settings;
