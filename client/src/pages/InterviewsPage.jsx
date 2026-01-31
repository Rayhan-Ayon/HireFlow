import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, Video, FileText, Save, CheckCircle, Search } from 'lucide-react';

function InterviewsPage() {
    const [interviews, setInterviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedInterview, setSelectedInterview] = useState(null);
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFilter, setDateFilter] = useState('');

    useEffect(() => {
        fetchInterviews();
    }, []);

    const fetchInterviews = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/interviews', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setInterviews(data.interviews || []);
            setLoading(false);
        } catch (err) {
            console.error('Failed to fetch interviews', err);
            setLoading(false);
        }
    };

    const handleSelectInterview = (interview) => {
        setSelectedInterview(interview);
        setNotes(interview.notes || '');
    };

    const handleSaveNotes = async () => {
        if (!selectedInterview) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/interviews/${selectedInterview.id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ notes })
            });
            if (res.ok) {
                // Update local state
                setInterviews(prev => prev.map(i => i.id === selectedInterview.id ? { ...i, notes } : i));
                alert('Notes saved successfully');
            }
        } catch (err) {
            console.error('Failed to save notes', err);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8">Loading interviews...</div>;

    // Grouping & Filtering
    const now = new Date();

    let filtered = interviews;
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(i =>
            (i.title && i.title.toLowerCase().includes(q)) ||
            (i.candidate_name && i.candidate_name.toLowerCase().includes(q))
        );
    }
    if (dateFilter) {
        // i.scheduled_at is ISO string (e.g. 2026-01-25T...)
        // dateFilter is YYYY-MM-DD
        filtered = filtered.filter(i => i.scheduled_at.startsWith(dateFilter));
    }

    const upcoming = filtered.filter(i => new Date(i.scheduled_at) >= now);
    const past = filtered.filter(i => new Date(i.scheduled_at) < now);

    return (
        <div style={{ padding: '0px', maxWidth: '1200px', margin: '0 auto', display: 'flex', gap: '24px', height: 'calc(100vh - 100px)' }}>

            {/* Left Column: List */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
                <div style={{ marginBottom: '24px' }}>
                    <h1 style={{ fontSize: '28px', marginBottom: '8px' }}>Interviews</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Manage scheduled interviews and notes.</p>
                </div>

                {/* Search & Filter */}
                <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                        <input
                            type="text"
                            placeholder="Search candidate or role..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="modern-input"
                            style={{ paddingLeft: '40px' }}
                        />
                    </div>
                    <input
                        type="date"
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        className="modern-input"
                        style={{ width: 'auto' }}
                    />
                </div>

                <h3 style={{ fontSize: '16px', color: 'var(--text-secondary)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Upcoming</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
                    {upcoming.length === 0 && <div className="text-secondary italic">No upcoming interviews.</div>}
                    {upcoming.map(interview => (
                        <InterviewCard
                            key={interview.id}
                            interview={interview}
                            active={selectedInterview?.id === interview.id}
                            onClick={() => handleSelectInterview(interview)}
                        />
                    ))}
                </div>

                <h3 style={{ fontSize: '16px', color: 'var(--text-secondary)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Past</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {past.length === 0 && <div className="text-secondary italic">No past interviews.</div>}
                    {past.map(interview => (
                        <InterviewCard
                            key={interview.id}
                            interview={interview}
                            active={selectedInterview?.id === interview.id}
                            onClick={() => handleSelectInterview(interview)}
                        />
                    ))}
                </div>
            </div>

            {/* Right Column: Detail / Notes */}
            <div style={{
                flex: 1.5,
                background: 'white',
                borderRadius: '16px',
                border: '1px solid var(--border)',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column'
            }}>
                {selectedInterview ? (
                    <>
                        <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '16px', marginBottom: '16px' }}>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                {new Date(selectedInterview.scheduled_at).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </div>
                            <h2 style={{ fontSize: '24px', marginBottom: '8px' }}>{selectedInterview.title}</h2>
                            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary)', fontWeight: '600' }}>
                                    <Clock size={16} />
                                    {new Date(selectedInterview.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                                {selectedInterview.candidate_name && (
                                    <Link to={`/candidates/${selectedInterview.candidate_id}`} className="hover:underline" style={{ color: 'var(--text-main)' }}>
                                        👤 {selectedInterview.candidate_name}
                                    </Link>
                                )}
                            </div>
                        </div>

                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <label style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <FileText size={18} /> Interview Notes
                                </label>
                                {saving && <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Saving...</span>}
                            </div>
                            <textarea
                                className="modern-textarea"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Type your interview notes here..."
                                style={{
                                    flex: 1,
                                    resize: 'none',
                                    padding: '16px',
                                    fontSize: '15px',
                                    lineHeight: '1.6',
                                    border: '1px solid var(--border)',
                                    borderRadius: '8px',
                                    marginBottom: '16px'
                                }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button className="btn btn-primary" onClick={handleSaveNotes} disabled={saving}>
                                    <Save size={16} /> Save Notes
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'var(--text-secondary)' }}>
                        <div style={{ width: '64px', height: '64px', background: 'var(--bg-body)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                            <FileText size={32} />
                        </div>
                        <p>Select an interview to view details and take notes.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function InterviewCard({ interview, active, onClick }) {
    const isPast = new Date(interview.scheduled_at) < new Date();

    return (
        <div
            onClick={onClick}
            style={{
                background: active ? '#f0f9ff' : 'white',
                border: active ? '1px solid var(--primary)' : '1px solid var(--border)',
                borderRadius: '12px',
                padding: '16px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                opacity: isPast ? 0.8 : 1
            }}
            className="hover:shadow-md"
        >
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{
                    background: isPast ? '#f3f4f6' : '#e0f2fe',
                    color: isPast ? '#6b7280' : '#0284c7',
                    padding: '8px',
                    borderRadius: '8px',
                    textAlign: 'center',
                    minWidth: '50px'
                }}>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                        {new Date(interview.scheduled_at).toLocaleDateString(undefined, { month: 'short' })}
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                        {new Date(interview.scheduled_at).getDate()}
                    </div>
                </div>
                <div>
                    <div style={{ fontWeight: '600', marginBottom: '4px', color: 'var(--text-main)' }}>{interview.title}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        {new Date(interview.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {interview.candidate_name && ` • with ${interview.candidate_name}`}
                    </div>
                    {/* Visual indicator for notes */}
                    {interview.notes && (
                        <div style={{ fontSize: '11px', color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle size={10} /> Notes added
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default InterviewsPage;
