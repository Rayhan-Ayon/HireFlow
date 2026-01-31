import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ErrorBoundary from '../components/ErrorBoundary';

import { Briefcase, Users, Clock, Calendar, Plus, TrendingUp, MoreVertical, FileText, Video } from 'lucide-react';

function Dashboard() {
    const navigate = useNavigate();
    console.log('[DEBUG] Dashboard component called');
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeFilter, setActiveFilter] = useState('all');

    // Calendar State
    const [isCalendarConnected, setIsCalendarConnected] = useState(false);
    const [provider, setProvider] = useState(null); // 'google' or 'microsoft'
    const [calendarEvents, setCalendarEvents] = useState([]);

    const [stats, setStats] = useState({
        activeJobs: 0,
        totalCandidates: 0,
        newApplications: 0,
        interviews: 0
    });
    const [pipelineData, setPipelineData] = useState({
        new: { count: 0, color: '#3b82f6', label: 'New' },
        screening: { count: 0, color: '#eab308', label: 'Screening' },
        interview: { count: 0, color: '#a855f7', label: 'Interview' },
        offer: { count: 0, color: '#22c55e', label: 'Offer' },
        rejected: { count: 0, color: '#ef4444', label: 'Rejected' }
    });

    // Fetch Connection Status & Events
    useEffect(() => {
        // Check for OAuth callback functionality that might have landed here
        const params = new URLSearchParams(window.location.search);
        if (params.get('code')) {
            const state = params.get('state') || '';
            console.log('[DEBUG] Callback State:', state);
            if (state.includes('login') || state.includes('signup')) {
                navigate('/login' + window.location.search);
            } else {
                navigate('/settings' + window.location.search);
            }
            return;
        }

        const checkConnection = async (silent = false) => {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch('/api/user/profile', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    const connected = !!data.tokens?.google || !!data.profile?.google_refresh_token || !!data.tokens?.microsoft || !!data.profile?.microsoft_refresh_token;
                    setIsCalendarConnected(connected);
                    const isMs = !!data.tokens?.microsoft || !!data.profile?.microsoft_refresh_token;
                    setProvider(isMs ? 'microsoft' : (connected ? 'google' : null));

                    if (connected) {
                        fetchEvents(silent);
                    }
                }
            } catch (err) {
                if (!silent) console.error('Failed to check calendar connection', err);
            }
        };
        checkConnection();

        // Polling every 30 seconds
        const interval = setInterval(() => checkConnection(true), 30000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch('/api/dashboard/stats', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.stats) setStats(data.stats);

                    if (data.pipeline) {
                        setPipelineData(prev => {
                            const next = { ...prev };
                            Object.keys(data.pipeline).forEach(key => {
                                if (next[key]) {
                                    // Create new object to avoid mutation
                                    next[key] = { ...next[key], count: data.pipeline[key] };
                                }
                            });
                            return next;
                        });
                    }
                }
            } catch (err) {
                console.error('Failed to fetch stats', err);
            }
        };
        fetchStats();
        const interval = setInterval(fetchStats, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchEvents = async (silent = false) => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/calendar/events', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const events = await res.json();
                setCalendarEvents(events);
            }
        } catch (err) {
            if (!silent) console.error('Failed to fetch events', err);
        }
    };



    // Removed handleConnectCalendar - redirect to settings instead

    useEffect(() => {
        const fetchJobs = async (silent = false) => {
            try {
                const token = localStorage.getItem('token');
                if (!token) {
                    navigate('/login');
                    return;
                }
                const res = await fetch('/api/jobs', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!res.ok) {
                    console.error(`Jobs fetch failed with status: ${res.status}`);
                    throw new Error(`Failed to fetch jobs (Status ${res.status})`);
                }
                const data = await res.json();
                setJobs(data.jobs || []);
            } catch (err) {
                if (!silent) {
                    console.error('Error fetching jobs:', err);
                    setError(err.message === 'Failed to fetch'
                        ? 'Cannot connect to backend server. Please ensure the server is running on port 3001.'
                        : err.message);
                }
            } finally {
                if (!silent) setLoading(false);
            }
        };
        fetchJobs();

        // Polling every 30 seconds
        const interval = setInterval(() => fetchJobs(true), 30000);
        return () => clearInterval(interval);
    }, []);

    if (loading) return <div className="p-8">Loading dashboard...</div>;
    if (error) return (
        <div className="p-8">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <h3 className="text-red-800 font-semibold mb-2">Dashboard Error</h3>
                <p className="text-red-600">{error}</p>
                <div className="mt-4 p-3 bg-white rounded border border-red-100 text-xs text-red-500 font-mono">
                    Check if the backend is running: npm start
                </div>
            </div>
        </div>
    );

    // Safety check
    const safeJobs = Array.isArray(jobs) ? jobs : [];
    const activeJobsCount = safeJobs.filter(j => j.status === 'published' || j.status === 'active').length;




    const handlePipelineClick = (stage) => {
        setActiveFilter(stage);
        // In a real app, this would filter candidates or jobs list
        console.log(`Filtering by stage: ${stage}`);
    };

    return (
        <div className="dashboard">
            <div className="dashboard-header">
                <h1 className="dashboard-title">Dashboard</h1>
                <p className="dashboard-subtitle">Welcome back. Here's an overview of your recruitment activity.</p>
            </div>

            {/* Stats Grid */}
            <div className="stats-grid">
                <Link to="/jobs" className="stat-card" style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer', display: 'block' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div className="stat-label">Active Jobs</div>
                        <Briefcase size={20} color="var(--text-secondary)" />
                    </div>
                    <div className="stat-value">{stats.activeJobs}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Currently accepting applications</div>
                </Link>

                <Link to="/candidates" className="stat-card" style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer', display: 'block' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div className="stat-label">Total Candidates</div>
                        <Users size={20} color="var(--text-secondary)" />
                    </div>
                    <div className="stat-value">{stats.totalCandidates}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>In your talent pool</div>
                </Link>

                <Link to="/candidates" className="stat-card" style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer', display: 'block' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div className="stat-label">New Applications</div>
                        <Clock size={20} color="var(--text-secondary)" />
                    </div>
                    <div className="stat-value">{stats.newApplications}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Awaiting review</div>
                </Link>

                <Link to="/interviews" className="stat-card" style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer', display: 'block' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div className="stat-label">Interviews</div>
                        <TrendingUp size={20} color="var(--text-secondary)" />
                    </div>
                    <div className="stat-value">{stats.interviews}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Scheduled this week</div>
                </Link>
            </div>

            {/* Dashboard Grid */}
            <div className="dashboard-grid">
                {/* Main Content: Pipeline & Calendar */}
                <div>
                    {/* Pipeline Section */}
                    <div className="pipeline-container">
                        <h3 style={{ marginBottom: '24px' }}>Application Pipeline</h3>
                        <div className="pipeline-bar">
                            <div className="pipeline-segment" style={{ flex: 2, background: '#3b82f6' }} title="New" onClick={() => handlePipelineClick('new')}></div>
                            <div className="pipeline-segment" style={{ flex: 1, background: '#eab308' }} title="Screening" onClick={() => handlePipelineClick('screening')}></div>
                            <div className="pipeline-segment" style={{ flex: 1, background: '#a855f7' }} title="Interview" onClick={() => handlePipelineClick('interview')}></div>
                            <div className="pipeline-segment" style={{ flex: 1, background: '#22c55e' }} title="Offer" onClick={() => handlePipelineClick('offer')}></div>
                            <div className="pipeline-segment" style={{ flex: 0.5, background: '#ef4444' }} title="Rejected" onClick={() => handlePipelineClick('rejected')}></div>
                        </div>
                        <div className="pipeline-legend">
                            {Object.entries(pipelineData).map(([key, data]) => (
                                <div key={key} className="pipeline-legend-item" onClick={() => handlePipelineClick(key)}>
                                    <div className="pipeline-dot" style={{ background: data.color }}></div>
                                    {data.label} ({data.count})
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="content-card">
                        <div className="card-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Calendar size={20} color="var(--primary)" />
                                <h3 className="card-title">
                                    Upcoming Interviews {provider ? `(${provider === 'google' ? 'Google' : 'Outlook'})` : ''}
                                </h3>
                            </div>
                        </div>
                        <div className="card-body" style={{ padding: '24px' }}>
                            {!isCalendarConnected ? (
                                <div style={{ textAlign: 'center', padding: '24px' }}>
                                    <div style={{
                                        width: '64px',
                                        height: '64px',
                                        background: 'var(--bg-body)',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        margin: '0 auto 16px auto',
                                        color: 'var(--text-secondary)'
                                    }}>
                                        <Calendar size={32} />
                                    </div>
                                    <h4 style={{ marginBottom: '8px' }}>Connect Your Calendar</h4>
                                    <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', maxWidth: '300px', margin: '0 auto 24px auto' }}>
                                        Sync your calendar to see upcoming interviews and schedule meetings directly from HireFlow.
                                    </p>
                                    <Link to="/settings" className="btn btn-primary" style={{ display: 'inline-flex' }}>
                                        Go to Settings to Connect
                                    </Link>
                                </div>
                            ) : (
                                <div className="calendar-events">
                                    <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Upcoming</span>
                                        <Link to="/settings" style={{ fontSize: '12px', color: 'var(--primary)', textDecoration: 'none' }}>
                                            Manage Selection
                                        </Link>
                                    </div>

                                    {(() => {
                                        const filteredEvents = calendarEvents;

                                        if (filteredEvents.length === 0) {
                                            return (
                                                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px' }}>
                                                    No upcoming interviews or meetings found.
                                                </div>
                                            );
                                        }

                                        return (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                {filteredEvents.map((event, idx) => {
                                                    // Extract meeting link from various possible fields
                                                    const getMeetingLink = () => {
                                                        // Check hangoutLink first
                                                        if (event.hangoutLink) return event.hangoutLink;

                                                        // Check conferenceData
                                                        if (event.conferenceData?.entryPoints?.[0]?.uri) {
                                                            return event.conferenceData.entryPoints[0].uri;
                                                        }

                                                        // Extract from location or description
                                                        const searchText = `${event.location || ''} ${event.description || ''}`;
                                                        const zoomRegex = /(https?:\/\/[^\s]*zoom\.us\/[^\s<>"]*|https?:\/\/us\d+web\.zoom\.us\/[^\s<>"]*)/i;
                                                        const teamsRegex = /(https?:\/\/teams\.(microsoft|live)\.com\/[^\s<>"]*)/i;
                                                        const meetRegex = /(https?:\/\/meet\.google\.com\/[^\s<>"]*)/i;

                                                        const zoomMatch = searchText.match(zoomRegex);
                                                        if (zoomMatch) return zoomMatch[0];

                                                        const teamsMatch = searchText.match(teamsRegex);
                                                        if (teamsMatch) return teamsMatch[0];

                                                        const meetMatch = searchText.match(meetRegex);
                                                        if (meetMatch) return meetMatch[0];

                                                        return null;
                                                    };

                                                    const meetingLink = getMeetingLink();

                                                    const getMeetingType = () => {
                                                        if (!meetingLink) return null;
                                                        if (meetingLink.includes('zoom.us')) return 'Zoom Meeting';
                                                        if (meetingLink.includes('teams.microsoft.com') || meetingLink.includes('teams.live.com')) return 'Microsoft Teams';
                                                        if (meetingLink.includes('meet.google.com')) return 'Google Meet';
                                                        return 'Meeting Link';
                                                    };

                                                    return (
                                                        <div key={idx} style={{
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: 'center',
                                                            padding: '12px',
                                                            background: 'var(--bg-body)',
                                                            borderRadius: '8px',
                                                            borderLeft: `4px solid ${['#3b82f6', '#a855f7', '#10b981', '#f59e0b'][idx % 4]}`
                                                        }}>
                                                            <div style={{ display: 'flex', gap: '12px' }}>
                                                                <div style={{ minWidth: '60px', textAlign: 'center' }}>
                                                                    <div style={{ fontSize: '14px', fontWeight: '700' }}>
                                                                        {new Date(event.start.dateTime || event.start.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                    </div>
                                                                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                                                        {new Date(event.start.dateTime || event.start.date).toLocaleDateString()}
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <div style={{ fontWeight: '600', fontSize: '14px' }}>{event.summary}</div>
                                                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                                                        {getMeetingType() || event.location || 'No Location'}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {meetingLink && (
                                                                <a
                                                                    href={meetingLink}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="btn btn-sm btn-primary"
                                                                    style={{ padding: '6px 12px', fontSize: '12px', gap: '6px', whiteSpace: 'nowrap' }}
                                                                >
                                                                    Join Meeting <Video size={14} />
                                                                </a>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={{ marginTop: '20px', textAlign: 'center' }}>
                        <a
                            href={provider === 'microsoft' ? "https://outlook.office.com/calendar" : "https://calendar.google.com"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary"
                            style={{ width: '100%', justifyContent: 'center' }}
                        >
                            <Plus size={16} /> Open {provider === 'microsoft' ? 'Outlook' : 'Google'} Calendar
                        </a>
                    </div>
                </div>

                {/* Sidebar Right: Quick Actions */}
                <div style={{
                    background: 'white',
                    padding: '24px',
                    borderRadius: '12px',
                    border: '1px solid var(--border)',
                    height: 'fit-content'
                }}>
                    <h3 style={{ marginBottom: '20px' }}>Quick Actions</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <Link to="/create-job" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
                            <Briefcase size={16} /> Create New Job Posting
                        </Link>
                        <Link to="/candidates" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
                            <Users size={16} /> View All Candidates
                        </Link>
                        <Link to="/interviews" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
                            <Video size={16} /> View Scheduled Interviews
                        </Link>
                        <Link to="/templates" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
                            <FileText size={16} /> Manage Templates
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function SafeDashboard() {
    return (
        <ErrorBoundary>
            <Dashboard />
        </ErrorBoundary>
    );
}
