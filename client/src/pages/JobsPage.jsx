import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, MoreVertical } from 'lucide-react';

function JobsPage() {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [visibleMenu, setVisibleMenu] = useState(null);
    const [embedJob, setEmbedJob] = useState(null); // State for embed modal

    // Filter State
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // all, published, closed
    const [sortOrder, setSortOrder] = useState('newest'); // newest, oldest, republished

    useEffect(() => {
        const fetchJobs = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) {
                    window.location.href = '/login';
                    return;
                }
                const res = await fetch('/api/jobs', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!res.ok) throw new Error('Failed to fetch jobs');
                const data = await res.json();
                setJobs(Array.isArray(data.jobs) ? data.jobs : []);
            } catch (err) {
                console.error('Error fetching jobs:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchJobs();
    }, []);

    // Helper: Safe Date
    const getSafeDate = (dateStr) => {
        if (!dateStr) return 0;
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? 0 : d.getTime();
    };

    // Helper: Format Date
    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? '' : date.toLocaleDateString();
    };

    const handleDelete = async (jobId) => {
        if (!confirm('Are you sure you want to delete this job? This action cannot be undone.')) return;
        try {
            const res = await fetch(`/api/jobs/${jobId}`, { method: 'DELETE' });
            if (res.ok) {
                setJobs(jobs.filter(j => j.id !== jobId));
            } else {
                alert('Failed to delete job');
            }
        } catch (err) {
            console.error(err);
            alert('Error deleting job');
        }
    };

    const handleStatusChange = async (jobId, newStatus) => {
        try {
            const res = await fetch(`/api/jobs/${jobId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            if (res.ok) {
                if (newStatus === 'published') {
                    const reload = await fetch('/api/jobs');
                    const data = await reload.json();
                    setJobs(data.jobs || []);
                } else {
                    setJobs(jobs.map(j => j.id === jobId ? { ...j, status: newStatus } : j));
                }
                setVisibleMenu(null);
            } else {
                alert('Failed to update status');
            }
        } catch (err) {
            console.error(err);
            alert('Error updating status');
        }
    };

    if (loading) return <div className="p-8">Loading jobs...</div>;
    if (error) return <div className="p-8 text-red-500">Error: {error}</div>;

    // Filter Logic
    const filteredJobs = jobs.filter(job => {
        const title = job.title || '';
        if (searchQuery && !title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        if (statusFilter !== 'all' && (job.status || 'draft') !== statusFilter) return false;
        return true;
    }).sort((a, b) => {
        if (sortOrder === 'republished') {
            const dateA = getSafeDate(a.republished_at);
            const dateB = getSafeDate(b.republished_at);
            return dateB - dateA;
        }
        const dateA = getSafeDate(a.created_at);
        const dateB = getSafeDate(b.created_at);
        return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });

    return (
        <div className="page-container" style={{ maxWidth: '900px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1>Jobs</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Manage your open positions and applications.</p>
                </div>
                <Link to="/create-job" className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '13px' }}>
                    <Plus size={16} /> Post New Job
                </Link>
            </div>

            {/* Filter Bar */}
            <div style={{
                background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)',
                marginBottom: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center'
            }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                    <input
                        type="text" placeholder="Search by Job Title..." className="modern-input"
                        value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ height: '45px', margin: 0, width: '100%' }}
                    />
                </div>
                <select
                    className="modern-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                    style={{ width: '180px', height: '45px', margin: 0, padding: '0 12px' }}
                >
                    <option value="all">All Status</option>
                    <option value="published">Live</option>
                    <option value="closed">Closed</option>
                </select>
                <select
                    className="modern-input" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}
                    style={{ width: '240px', height: '45px', margin: 0, padding: '0 12px' }}
                >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="republished">Recently Republished</option>
                </select>
            </div>

            {/* List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {filteredJobs.map(job => (
                    <div key={job.id} className="job-card" style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px',
                        opacity: job.status === 'closed' ? 0.7 : 1,
                        position: 'relative',
                        zIndex: visibleMenu === job.id ? 100 : 1
                    }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                <Link to={`/jobs/${job.id}/candidates`} style={{ textDecoration: 'none', color: 'inherit' }}>
                                    <h3 style={{ margin: 0, fontSize: '18px', cursor: 'pointer' }} className="hover:text-primary transition-colors">
                                        {job.title}
                                    </h3>
                                </Link>
                                {job.status === 'published' ? (
                                    <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '10px', background: '#dbeafe', color: '#1e40af' }}>Live</span>
                                ) : (
                                    <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '10px', background: '#f3f4f6', color: '#374151' }}>Closed</span>
                                )}
                            </div>
                            <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                                {job.department || 'Engineering'} • {job.location || 'Remote'} • {job.employment_type || 'Full Time'}
                                <span style={{ margin: '0 8px' }}>•</span>
                                Published: {formatDate(job.created_at)}
                                {job.republished_at && (
                                    <>
                                        <span style={{ margin: '0 8px' }}>•</span>
                                        <span style={{ color: '#059669', fontWeight: '500' }}>Republished: {formatDate(job.republished_at)}</span>
                                    </>
                                )}
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-main)' }}>{job.applicant_count || 0}</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>applicants</div>
                            </div>
                            <Link to={`/jobs/${job.id}/candidates`} className={`btn btn-secondary ${job.status === 'closed' ? 'disabled' : ''}`} style={{ padding: '8px 16px' }}>
                                Manage
                            </Link>
                            <button
                                onClick={() => setVisibleMenu(visibleMenu === job.id ? null : job.id)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', position: 'relative' }}
                            >
                                <MoreVertical size={20} />
                                {visibleMenu === job.id && (
                                    <div style={{
                                        position: 'absolute', right: 0, top: '100%',
                                        background: '#ffffff', border: '1px solid var(--border)', borderRadius: '8px', boxShadow: 'var(--shadow-lg)',
                                        zIndex: 50, minWidth: '160px', overflow: 'hidden', textAlign: 'left'
                                    }}>
                                        <div style={{ padding: '10px 16px', fontSize: '14px', cursor: 'pointer', color: 'var(--text-main)' }} onClick={() => window.location.href = `/edit-job/${job.id}`}>
                                            Edit Job
                                        </div>
                                        {job.status === 'published' ? (
                                            <div style={{ padding: '10px 16px', fontSize: '14px', cursor: 'pointer', color: '#f59e0b' }} onClick={() => handleStatusChange(job.id, 'closed')}>
                                                Close Job
                                            </div>
                                        ) : (
                                            <div style={{ padding: '10px 16px', fontSize: '14px', cursor: 'pointer', color: '#10b981' }} onClick={() => handleStatusChange(job.id, 'published')}>
                                                Republish Job
                                            </div>
                                        )}
                                        <div style={{ padding: '10px 16px', fontSize: '14px', cursor: 'pointer', color: 'var(--text-main)' }} onClick={() => {
                                            setEmbedJob(job);
                                            setVisibleMenu(null);
                                        }}>
                                            Share / Embed
                                        </div>
                                        <div style={{ padding: '10px 16px', fontSize: '14px', cursor: 'pointer', color: '#ef4444', borderTop: '1px solid var(--border)' }} onClick={() => handleDeleteClick(job)}>
                                            Delete Job
                                        </div>
                                    </div>
                                )}
                            </button>
                        </div>
                    </div>
                ))}
                {filteredJobs.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '48px', background: 'white', borderRadius: '12px', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                        {jobs.length === 0 ? 'No jobs found. Create your first job posting.' : 'No jobs match your filters.'}
                    </div>
                )}
            </div>

            {/* Embed Modal */}
            {embedJob && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                }} onClick={() => setEmbedJob(null)}>
                    <div style={{
                        background: 'var(--bg-card)', padding: '24px', borderRadius: '12px', width: '90%', maxWidth: '600px',
                        boxShadow: 'var(--shadow-xl)', border: '1px solid var(--border)'
                    }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600', color: 'var(--text-main)' }}>
                            Share Job: {embedJob.title}
                        </h3>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>
                                Direct Link
                            </label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    readOnly
                                    value={`${window.location.origin}/apply/${embedJob.id}`}
                                    className="modern-input"
                                    onClick={e => e.target.select()}
                                />
                                <button className="btn btn-secondary" onClick={() => {
                                    navigator.clipboard.writeText(`${window.location.origin}/apply/${embedJob.id}`);
                                    alert('Copied!');
                                }}>Copy</button>
                            </div>
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>
                                Smart Embed (Auto-Resizing)
                            </label>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', color: '#f59e0b' }}>
                                Copy this script where you want the form to appear. It will automatically fit the height.
                            </label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <textarea
                                    readOnly
                                    value={`<div id="job-widget-${embedJob.id}"></div>
<script>
  (function() {
    var container = document.getElementById('job-widget-${embedJob.id}');
    if (!container) return;
    var iframe = document.createElement('iframe');
    iframe.src = "${window.location.origin}/apply/${embedJob.id}?embed=true";
    iframe.style.width = "100%";
    iframe.style.border = "none";
    iframe.style.overflow = "hidden";
    iframe.style.minHeight = "500px";
    container.appendChild(iframe);

    window.addEventListener('message', function(e) {
      if (e.data.type === 'RESIZE_IFRAME') {
        iframe.style.height = e.data.height + 'px';
      }
    });
  })();
</script>`}
                                    className="modern-input"
                                    style={{ height: '120px', fontFamily: 'monospace', fontSize: '12px' }}
                                    onClick={e => e.target.select()}
                                />
                                <button className="btn btn-secondary" onClick={() => {
                                    navigator.clipboard.writeText(`<div id="job-widget-${embedJob.id}"></div>
<script>
  (function() {
    var container = document.getElementById('job-widget-${embedJob.id}');
    if (!container) return;
    var iframe = document.createElement('iframe');
    iframe.src = "${window.location.origin}/apply/${embedJob.id}?embed=true";
    iframe.style.width = "100%";
    iframe.style.border = "none";
    iframe.style.overflow = "hidden";
    iframe.style.minHeight = "500px";
    container.appendChild(iframe);

    window.addEventListener('message', function(e) {
      if (e.data.type === 'RESIZE_IFRAME') {
        iframe.style.height = e.data.height + 'px';
      }
    });
  })();
</script>`);
                                    alert('Copied!');
                                }}>Copy</button>
                            </div>
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>
                                Button Code (HTML)
                            </label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <textarea
                                    readOnly
                                    value={`<a href="${window.location.origin}/apply/${embedJob.id}" target="_blank" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-family: sans-serif; font-weight: 600;">Apply Now</a>`}
                                    className="modern-input"
                                    style={{ height: '80px', fontFamily: 'monospace', fontSize: '12px' }}
                                    onClick={e => e.target.select()}
                                />
                                <button className="btn btn-secondary" onClick={() => {
                                    navigator.clipboard.writeText(`<a href="${window.location.origin}/apply/${embedJob.id}" target="_blank" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-family: sans-serif; font-weight: 600;">Apply Now</a>`);
                                    alert('Copied!');
                                }}>Copy</button>
                            </div>
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>
                                Embed Code (Iframe)
                            </label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <textarea
                                    readOnly
                                    value={`<iframe src="${window.location.origin}/apply/${embedJob.id}?embed=true" width="100%" height="800" frameborder="0" style="border:none; box-shadow:none;"></iframe>`}
                                    className="modern-input"
                                    style={{ height: '80px', fontFamily: 'monospace', fontSize: '12px' }}
                                    onClick={e => e.target.select()}
                                />
                                <button className="btn btn-secondary" style={{ height: 'fit-content' }} onClick={() => {
                                    navigator.clipboard.writeText(`<iframe src="${window.location.origin}/apply/${embedJob.id}?embed=true" width="100%" height="800" frameborder="0" style="border:none; box-shadow:none;"></iframe>`);
                                    alert('Copied!');
                                }}>Copy</button>
                            </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                            <button className="btn btn-primary" onClick={() => setEmbedJob(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
        </div>
    );
}

export default JobsPage;
