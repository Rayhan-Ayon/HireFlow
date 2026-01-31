import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronDown, ChevronUp, Download, ArrowLeft, Layout } from 'lucide-react';

function CandidatesPage() {
    const { jobId } = useParams();
    const [jobs, setJobs] = useState([]);
    const [candidatesByJob, setCandidatesByJob] = useState({});
    const [loading, setLoading] = useState(true);
    const [expandedJobs, setExpandedJobs] = useState({});

    useEffect(() => {
        const fetchData = async () => {
            try {
                // 1. Fetch Jobs
                let jobsData = [];
                const token = localStorage.getItem('token');
                const authHeaders = { 'Authorization': `Bearer ${token}` };

                if (jobId) {
                    const res = await fetch(`/api/public/jobs/${jobId}`);
                    const data = await res.json();
                    jobsData = [data];
                    setExpandedJobs({ [data.id]: true });
                } else {
                    const res = await fetch('/api/jobs', { headers: authHeaders });
                    const data = await res.json();
                    jobsData = data.jobs || [];
                }
                setJobs(jobsData);

                // 2. Fetch Candidates for each job
                const candidatesMap = {};
                await Promise.all(jobsData.map(async (job) => {
                    try {
                        const res = await fetch(`/api/jobs/${job.id}/candidates`, { headers: authHeaders });
                        const data = await res.json();
                        candidatesMap[job.id] = data.candidates || [];
                    } catch (e) {
                        console.error(`Failed to fetch candidates for job ${job.id}`, e);
                        candidatesMap[job.id] = [];
                    }
                }));
                setCandidatesByJob(candidatesMap);
                setLoading(false);
            } catch (err) {
                console.error('Error loading data:', err);
                setLoading(false);
            }
        };

        fetchData();
    }, [jobId]);

    const toggleJob = (id) => {
        setExpandedJobs(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const calculateAvgScore = (candidates) => {
        if (!candidates || candidates.length === 0) return 0;
        const total = candidates.reduce((sum, c) => sum + (c.match_score || 0), 0);
        return Math.round(total / candidates.length);
    };

    // Filter State
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedJob, setSelectedJob] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [sortOrder, setSortOrder] = useState('newest'); // newest, oldest, highest_match, lowest_match

    // Auto-select job if jobId is in URL
    useEffect(() => {
        if (jobId) {
            setSelectedJob(jobId);
        }
    }, [jobId]);

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? '' : date.toLocaleDateString();
    };

    const getSafeDate = (dateStr) => {
        if (!dateStr) return 0;
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? 0 : d.getTime();
    };

    if (loading) return <div className="p-8">Loading candidates...</div>;

    // Filter Jobs logic - If a specific job is selected, only show that job
    const visibleJobs = selectedJob === 'all'
        ? jobs
        : jobs.filter(j => j.id.toString() === selectedJob.toString());

    return (
        <div className="candidates-list" style={{ maxWidth: '1000px', margin: '0 auto' }}>
            {jobId && (
                <Link to="/jobs" style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: 'var(--text-secondary)',
                    textDecoration: 'none',
                    marginBottom: '16px',
                    fontSize: '14px',
                    fontWeight: '500'
                }}>
                    <ArrowLeft size={16} /> Back to Jobs
                </Link>
            )}
            <div style={{ marginBottom: '32px' }}>
                <h1 style={{ fontSize: '32px', marginBottom: '8px' }}>Candidates</h1>
                <p style={{ color: 'var(--text-secondary)' }}>View and manage candidates grouped by job positions.</p>
            </div>

            {/* Filters Row */}
            <div style={{
                background: 'white',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                marginBottom: '24px',
                display: 'flex',
                gap: '16px',
                flexWrap: 'wrap',
                alignItems: 'center'
            }}>
                <input
                    type="text"
                    placeholder="Search candidates..."
                    className="modern-input"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ flex: 1, minWidth: '200px', height: '45px', margin: 0 }}
                />

                {/* Hide Job Select if we are in Single Job View context, OR disable it
                    Actually user said "it is only that job". If I hide it, they can't switch back to All easily?
                    But if they came from a specific job page, maybe they want to focus.
                    Let's just default it correctly. If they want to see all, they can select "All Jobs".
                */}
                {!jobId && (
                    <select
                        className="modern-input"
                        value={selectedJob}
                        onChange={(e) => setSelectedJob(e.target.value)}
                        style={{ width: '200px', height: '45px', margin: 0, padding: '0 12px' }}
                    >
                        <option value="all">All Jobs</option>
                        {jobs.map(job => (
                            <option key={job.id} value={job.id}>{job.title}</option>
                        ))}
                    </select>
                )}
                {/* If jobId is present, maybe display just the job title as static text or a disabled input?
                    User said "filter should not be like all jobs...it is only that job".
                */}
                {jobId && jobs.length > 0 && (
                    <div style={{
                        height: '45px',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0 16px',
                        background: 'var(--bg-body)',
                        borderRadius: '8px',
                        fontWeight: '600',
                        border: '1px solid var(--border)',
                        color: 'var(--text-secondary)'
                    }}>
                        {jobs[0].title}
                    </div>
                )}

                <select
                    className="modern-input"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    style={{ width: '160px', height: '45px', margin: 0, padding: '0 12px' }}
                >
                    <option value="all">All Status</option>
                    <option value="new">New</option>
                    <option value="screening">Screening</option>
                    <option value="interview">Interview</option>
                    <option value="offer">Offer</option>
                    <option value="rejected">Rejected</option>
                </select>

                <select
                    className="modern-input"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    style={{ width: '180px', height: '45px', margin: 0, padding: '0 12px' }}
                >
                    <option value="newest">Newest Application</option>
                    <option value="oldest">Oldest Application</option>
                    <option value="highest_match">Highest Match %</option>
                    <option value="lowest_match">Lowest Match %</option>
                </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {visibleJobs.map(job => {
                    const allJobCandidates = candidatesByJob[job.id] || [];

                    // Filter Candidates
                    const filteredCandidates = allJobCandidates.filter(c => {
                        // Search
                        const search = searchQuery.toLowerCase();
                        if (search && !c.name.toLowerCase().includes(search) && !c.email.toLowerCase().includes(search)) return false;

                        // Status
                        if (statusFilter !== 'all') {
                            const cStatus = (c.status || 'new').toLowerCase();
                            if (cStatus !== statusFilter) return false;
                        }
                        return true;
                    }).sort((a, b) => {
                        // Sort
                        if (sortOrder === 'newest') return getSafeDate(b.created_at) - getSafeDate(a.created_at);
                        if (sortOrder === 'oldest') return getSafeDate(a.created_at) - getSafeDate(b.created_at);
                        if (sortOrder === 'highest_match') return (b.match_score || 0) - (a.match_score || 0);
                        if (sortOrder === 'lowest_match') return (a.match_score || 0) - (b.match_score || 0);
                        return 0;
                    });

                    // Skip job if no candidates match filter (optional, but cleaner)
                    if (searchQuery && filteredCandidates.length === 0) return null;

                    const isExpanded = expandedJobs[job.id];
                    const avgScore = calculateAvgScore(filteredCandidates); // Calculate on visible? or all? Usually all is better for stats, but dynamic is nicer for feedback. Let's use filtered.

                    return (
                        <div key={job.id} style={{
                            background: 'white',
                            borderRadius: '12px',
                            border: '1px solid var(--border)',
                            overflow: 'hidden'
                        }}>
                            {/* Accordion Header */}
                            <div
                                onClick={() => toggleJob(job.id)}
                                style={{
                                    padding: '24px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    cursor: 'pointer',
                                    background: isExpanded ? 'var(--bg-body)' : 'white',
                                    transition: 'background 0.2s'
                                }}
                            >
                                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                    <button style={{
                                        background: 'white',
                                        border: '1px solid var(--border)',
                                        borderRadius: '8px',
                                        width: '32px',
                                        height: '32px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'var(--text-secondary)'
                                    }}>
                                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </button>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '18px' }}>{job.title}</h3>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                            Engineering • London, UK • Full Time
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>{filteredCandidates.length} applicants</div>
                                        {filteredCandidates.length > 0 && (
                                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                                Avg score: <span style={{ color: avgScore > 70 ? '#22c55e' : 'inherit' }}>{avgScore}%</span>
                                            </div>
                                        )}
                                    </div>
                                    <Link
                                        to={`/jobs/${job.id}/pipeline`}
                                        className="btn btn-primary"
                                        style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <Layout size={14} /> View Pipeline
                                    </Link>
                                    <a
                                        href={`/apply/${job.id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn-secondary"
                                        style={{ fontSize: '12px', padding: '6px 12px' }}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        View Job Page
                                    </a>
                                </div>
                            </div>

                            {/* Accordion Body: Candidate List */}
                            {isExpanded && (
                                <div style={{ padding: '0 24px 24px 24px', background: 'var(--bg-body)' }}>
                                    {filteredCandidates.length === 0 ? (
                                        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                            No candidates match your filters.
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                                            {filteredCandidates.map(candidate => {
                                                const score = candidate.match_score || 0;
                                                return (
                                                    <div key={candidate.id} style={{
                                                        background: 'white',
                                                        padding: '16px',
                                                        borderRadius: '8px',
                                                        border: '1px solid var(--border)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between'
                                                    }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                            <div style={{
                                                                width: '40px',
                                                                height: '40px',
                                                                borderRadius: '50%',
                                                                background: '#e0f2fe',
                                                                color: '#0369a1',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                fontWeight: '600',
                                                                fontSize: '14px'
                                                            }}>
                                                                {candidate.name.charAt(0)}
                                                            </div>
                                                            <div>
                                                                <div style={{ fontWeight: '600' }}>{candidate.name}</div>
                                                                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                                                    {candidate.email}
                                                                    <span style={{ margin: '0 8px' }}>•</span>
                                                                    Applied: {formatDate(candidate.created_at)}
                                                                </div>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                                                    <div style={{ fontSize: '12px', fontWeight: '600', color: score >= 80 ? '#22c55e' : (score >= 50 ? '#eab308' : '#ef4444') }}>{score}% Match</div>
                                                                    <div style={{ width: '1px', height: '12px', background: 'var(--border)' }}></div>
                                                                    <div style={{
                                                                        fontSize: '11px',
                                                                        padding: '2px 8px',
                                                                        borderRadius: '12px',
                                                                        background: '#fff7ed',
                                                                        color: '#c2410c',
                                                                        border: '1px solid #fed7aa',
                                                                        textTransform: 'capitalize',
                                                                        fontWeight: '600'
                                                                    }}>
                                                                        {candidate.status || 'New'}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                            {candidate.resume_filename && (
                                                                <a
                                                                    href={`/api/uploads/${candidate.resume_filename}`}
                                                                    target="_blank"
                                                                    className="btn btn-secondary"
                                                                    style={{ padding: '6px 12px', fontSize: '12px' }}
                                                                >
                                                                    <Download size={14} /> Resume
                                                                </a>
                                                            )}

                                                            <Link
                                                                to={`/candidates/${candidate.id}`}
                                                                className="btn btn-primary"
                                                                style={{ padding: '6px 16px', fontSize: '12px' }}
                                                            >
                                                                View Profile
                                                            </Link>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default CandidatesPage;
