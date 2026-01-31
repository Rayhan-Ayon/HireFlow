import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Sparkles, ArrowRight, ArrowLeft, CheckCircle } from 'lucide-react';

function CreateJob() {
    const [step, setStep] = useState(1); // 1: Notes, 2: Edit/Publish
    const [notes, setNotes] = useState('');
    const [jobData, setJobData] = useState({ title: '', description: '', chatbot_instructions: '' });
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { jobId } = useParams();
    const isEditMode = !!jobId;

    useEffect(() => {
        if (isEditMode) {
            setLoading(true);
            fetch(`/api/public/jobs/${jobId}`)
                .then(res => {
                    if (!res.ok) throw new Error("Failed to fetch job");
                    return res.json();
                })
                .then(data => {
                    setJobData({
                        title: data.title || '',
                        description: data.description || '',
                        chatbot_instructions: data.chatbot_instructions || ''
                    });
                    setNotes('Job loaded for editing.');
                    setStep(2);
                })
                .catch(err => {
                    console.error("Failed to load job", err);
                    alert("Could not load job details. Redirecting...");
                    navigate('/jobs');
                })
                .finally(() => setLoading(false));
        }
    }, [jobId, navigate]);

    const handleDraft = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/jobs/draft', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notes }),
            });
            const data = await res.json();

            if (data.title) {
                setJobData({
                    title: data.title,
                    description: data.description,
                    chatbot_instructions: data.chatbot_instructions || ''
                });
            } else {
                setJobData({ title: "Draft Job", description: notes, chatbot_instructions: '' });
            }
            setStep(2);
        } catch (err) {
            console.error('Error drafting job:', err);
            alert('Failed to draft job description. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handlePublish = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/jobs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(jobData),
            });
            if (res.ok) {
                navigate('/');
            } else {
                alert('Failed to publish job');
            }
        } catch (err) {
            console.error('Error publishing job:', err);
        }
    };

    const handleUpdate = async () => {
        try {
            const res = await fetch(`/api/jobs/${jobId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(jobData),
            });
            if (res.ok) {
                navigate('/jobs');
            } else {
                alert('Failed to update job');
            }
        } catch (err) {
            console.error('Error updating job:', err);
        }
    };

    if (loading && isEditMode && step === 1) {
        return <div className="p-8 text-center">Loading job details...</div>;
    }

    return (
        <div className="create-job-container">
            <div className="page-header-center">
                <h1 className="page-title">{isEditMode ? 'Edit Job' : 'Create a New Job'}</h1>
                <p className="page-subtitle">
                    {isEditMode ? 'Update the role details below.' : "Let's help you find the perfect candidate. We'll start with your notes."}
                </p>
            </div>

            <div className="form-card">
                <div className="form-header">
                    <div className="step-indicator">
                        <span className="step-badge">Step {step} of 2</span>
                        <span>{step === 1 ? 'Rough Notes & Requirements' : 'Review & Publish'}</span>
                    </div>
                </div>

                <div className="form-body">
                    {step === 1 ? (
                        <>
                            <div className="form-section">
                                <label className="form-label">Job Requirements & Notes</label>
                                <span className="form-hint">Describe the role, key skills, experience level, and any perks. Our AI will draft a full description for you.</span>
                                <textarea
                                    className="modern-textarea"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="e.g. We need a Senior React Developer with 5+ years of experience. Must know Node.js and have led a team before. Remote friendly, $140k salary..."
                                    rows={8}
                                />
                            </div>
                            <div className="form-actions">
                                <button
                                    onClick={handleDraft}
                                    disabled={!notes || loading}
                                    className="btn btn-primary btn-lg"
                                >
                                    {loading ? (
                                        <>
                                            <Sparkles size={18} className="typing-dot" /> Drafting...
                                        </>
                                    ) : (
                                        <>
                                            Generate Description <Sparkles size={18} />
                                        </>
                                    )}
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="form-section">
                                <label className="form-label">Job Title</label>
                                <input
                                    type="text"
                                    className="modern-input"
                                    value={jobData.title || ''}
                                    onChange={(e) => setJobData({ ...jobData, title: e.target.value })}
                                />
                            </div>
                            <div className="form-section">
                                <label className="form-label">Job Description (Markdown)</label>
                                <textarea
                                    className="modern-textarea"
                                    style={{ minHeight: '400px', fontFamily: 'monospace', fontSize: '14px' }}
                                    value={jobData.description || ''}
                                    onChange={(e) => setJobData({ ...jobData, description: e.target.value })}
                                />
                            </div>

                            <div className="form-section" style={{ marginTop: '24px', padding: '20px', background: 'var(--primary-subtle)', borderRadius: '12px', border: '1px dashed var(--primary)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                    <Sparkles size={20} className="text-primary" />
                                    <label className="form-label" style={{ marginBottom: 0 }}>Train Your AI Bot</label>
                                </div>
                                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.5' }}>
                                    Tell the AI recruiter exactly how to screen candidates. You can specify questions to ask, topics to avoid, or the general vibe of the interview.
                                </p>
                                <textarea
                                    className="modern-textarea"
                                    style={{ minHeight: '120px', background: 'white' }}
                                    placeholder="e.g. This is an internship, so don't ask about notice period or salary. Focus on academic projects and their passion for tech."
                                    value={jobData.chatbot_instructions || ''}
                                    onChange={(e) => setJobData({ ...jobData, chatbot_instructions: e.target.value })}
                                />
                            </div>
                            <div className="form-actions">
                                <button onClick={() => setStep(1)} className="btn btn-secondary btn-lg">
                                    <ArrowLeft size={18} /> Back
                                </button>
                                <button onClick={isEditMode ? handleUpdate : handlePublish} className="btn btn-primary btn-lg">
                                    {isEditMode ? 'Update Job' : 'Publish Job'} <ArrowRight size={18} />
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default CreateJob;
