import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, MoreHorizontal, User, Clock, AlertCircle } from 'lucide-react';

const COLUMNS = [
    { id: 'new', title: 'Applied', color: '#3b82f6', bg: '#eff6ff' },
    { id: 'screening', title: 'Screening', color: '#eab308', bg: '#fef9c3' },
    { id: 'interview', title: 'Interview', color: '#a855f7', bg: '#f3e8ff' },
    { id: 'offer', title: 'Offer', color: '#22c55e', bg: '#dcfce7' },
    { id: 'rejected', title: 'Rejected', color: '#ef4444', bg: '#fee2e2' }
];

function JobPipeline() {
    const { jobId } = useParams();
    const [candidates, setCandidates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [draggingId, setDraggingId] = useState(null);

    useEffect(() => {
        fetchCandidates();
    }, [jobId]);

    const fetchCandidates = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/jobs/${jobId}/candidates`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setCandidates(data.candidates || []);
            } else {
                setError('Failed to load candidates');
            }
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDragStart = (e, id) => {
        setDraggingId(id);
        e.dataTransfer.effectAllowed = 'move';
        // Hide the drag image slightly if needed, or let browser handle it
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = async (e, targetStatus) => {
        e.preventDefault();
        if (!draggingId) return;

        const candidate = candidates.find(c => c.id === draggingId);
        if (candidate && candidate.status !== targetStatus) {
            // Optimistic Update
            setCandidates(prev => prev.map(c =>
                c.id === draggingId ? { ...c, status: targetStatus } : c
            ));

            try {
                // Determine API endpoint - status usually updated via generic update
                // Assuming POST /api/candidates/:id/status or PATCH /api/candidates/:id exists?
                // OR generic PUT /api/candidates/:id

                // Let's assume generic update for now
                const token = localStorage.getItem('token');
                const res = await fetch(`/api/candidates/${draggingId}/status`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ status: targetStatus })
                });

                if (!res.ok) {
                    throw new Error('Failed to update status');
                }
            } catch (err) {
                console.error(err);
                alert('Failed to save status change');
                fetchCandidates(); // Revert
            }
        }
        setDraggingId(null);
    };

    if (loading) return <div className="p-8">Loading pipeline...</div>;
    if (error) return <div className="p-8 text-red-600">{error}</div>;

    return (
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <Link to="/jobs" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: '8px', fontSize: '14px' }}>
                        <ArrowLeft size={16} /> Back to Jobs
                    </Link>
                    <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>Hiring Pipeline</h1>
                </div>
            </div>

            <div style={{
                display: 'flex',
                gap: '16px',
                overflowX: 'auto',
                paddingBottom: '16px',
                flex: 1
            }}>
                {COLUMNS.map(col => {
                    const colCandidates = candidates.filter(c => (c.status || 'new') === col.id);

                    return (
                        <div
                            key={col.id}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, col.id)}
                            style={{
                                flex: '0 0 280px',
                                background: '#f8fafc',
                                borderRadius: '12px',
                                border: '1px solid #e2e8f0',
                                display: 'flex',
                                flexDirection: 'column',
                                maxHeight: '100%'
                            }}
                        >
                            {/* Column Header */}
                            <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: col.color }}></div>
                                    <span style={{ fontWeight: '600', fontSize: '14px' }}>{col.title}</span>
                                    <span style={{ fontSize: '12px', color: '#94a3b8', background: '#e2e8f0', padding: '2px 6px', borderRadius: '10px' }}>
                                        {colCandidates.length}
                                    </span>
                                </div>
                            </div>

                            {/* Cards Container */}
                            <div style={{ padding: '12px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {colCandidates.map(c => (
                                    <div
                                        key={c.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, c.id)}
                                        style={{
                                            background: 'white',
                                            padding: '16px',
                                            borderRadius: '8px',
                                            border: '1px solid #e2e8f0',
                                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                            cursor: 'grab',
                                            opacity: draggingId === c.id ? 0.5 : 1
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                            <div style={{ fontWeight: '600', fontSize: '15px' }}>{c.name}</div>
                                            {(c.match_score > 0) && (
                                                <div style={{
                                                    fontSize: '12px',
                                                    fontWeight: '700',
                                                    color: c.match_score >= 80 ? '#16a34a' : (c.match_score >= 50 ? '#ca8a04' : '#dc2626')
                                                }}>
                                                    {c.match_score}%
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Clock size={12} /> {new Date(c.created_at).toLocaleDateString()}
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                                            <Link
                                                to={`/candidates/${c.id}`}
                                                style={{ fontSize: '12px', color: '#2563eb', textDecoration: 'none', fontWeight: '500' }}
                                            >
                                                View Profile
                                            </Link>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default JobPipeline;
