import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import Chatbot from '../components/Chatbot';
import { CheckCircle, ArrowLeft, Upload, FileText, Send, Sparkles } from 'lucide-react';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';

function ApplyPage() {
    const { jobId } = useParams();
    const location = useLocation();
    const isEmbed = new URLSearchParams(location.search).get('embed') === 'true';

    const [job, setJob] = useState(null);
    const [loading, setLoading] = useState(true);
    const [chatAnswers, setChatAnswers] = useState(null);
    const [submitted, setSubmitted] = useState(false);
    const [formData, setFormData] = useState({ name: '', email: '', phone: '', linkedin: '' });
    const [whatsappOption, setWhatsappOption] = useState('same'); // 'same', 'different', 'none'
    const [customWhatsapp, setCustomWhatsapp] = useState('');
    const [resume, setResume] = useState(null);

    useEffect(() => {
        fetch(`/api/public/jobs/${jobId}`)
            .then(res => res.json())
            .then(data => {
                setJob(data);
                setLoading(false);
            })
            .catch(err => {
                console.error('Error fetching job:', err);
                setLoading(false);
            });
    }, [jobId]);

    // Smart Embed: Broadcast height to parent iframe
    useEffect(() => {
        if (!isEmbed) return;

        const sendHeight = () => {
            const height = document.body.scrollHeight;
            window.parent.postMessage({ type: 'RESIZE_IFRAME', height }, '*');
        };

        // Send initial height
        sendHeight();

        // Observe changes
        const observer = new ResizeObserver(sendHeight);
        observer.observe(document.body);

        // Cleanup
        return () => observer.disconnect();
    }, [isEmbed, job, chatAnswers]); // Re-run when content usually changes

    const handleSubmit = async (e) => {
        e.preventDefault();

        const formDataPayload = new FormData();
        formDataPayload.append('job_id', jobId);
        formDataPayload.append('name', formData.name);
        formDataPayload.append('email', formData.email);
        formDataPayload.append('phone', formData.phone);
        formDataPayload.append('linkedin', formData.linkedin);
        formDataPayload.append('chat_transcript', JSON.stringify(chatAnswers));

        // Determine WhatsApp number based on option
        let finalWhatsapp = '';
        if (whatsappOption === 'same') {
            finalWhatsapp = formData.phone;
        } else if (whatsappOption === 'different') {
            finalWhatsapp = customWhatsapp;
        } else {
            finalWhatsapp = ''; // None
        }
        formDataPayload.append('whatsapp_number', finalWhatsapp);

        if (resume) {
            formDataPayload.append('resume', resume);
        }

        try {
            const res = await fetch('/api/candidates', {
                method: 'POST',
                body: formDataPayload
            });
            if (res.ok) {
                setSubmitted(true);
            } else {
                alert('Failed to submit application');
            }
        } catch (err) {
            console.error('Submission error:', err);
        }
    };

    if (loading) return <div className="page-container" style={{ textAlign: 'center' }}>Loading job details...</div>;
    if (!job) return <div className="page-container" style={{ textAlign: 'center' }}>Job not found</div>;

    if (submitted) {
        return (
            <div className="page-container">
                <div className="form-card" style={{ maxWidth: '600px', margin: '40px auto', padding: '40px', textAlign: 'center' }}>
                    <div style={{
                        width: '80px', height: '80px', background: '#dcfce7', color: '#16a34a',
                        borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 24px auto'
                    }}>
                        <CheckCircle size={40} />
                    </div>
                    <h1 className="page-title">Application Received!</h1>
                    <p className="page-subtitle" style={{ marginBottom: '32px' }}>
                        Thank you for applying for the <strong>{job.title}</strong> position. We've received your details and will be in touch soon.
                    </p>
                    {isEmbed ? (
                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>You can now close this window.</p>
                    ) : (
                        <button onClick={() => window.location.href = '/'} className="btn btn-secondary">
                            Back to Home
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="page-container" style={isEmbed ? { padding: '20px', maxWidth: '100%' } : {}}>
            {/* Header Section */}
            <div className="page-header-center">
                <h1 className="page-title">{job.title}</h1>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                    <span className="step-badge" style={{ background: 'var(--primary-subtle)', color: 'var(--primary)' }}>Remote Position</span>
                    <span>•</span>
                    <span>Full-time</span>
                    <span>•</span>
                    <span>Engineering</span>
                </div>
            </div>

            <div className="apply-grid">
                {/* Left Column: Job Description */}
                <div className="space-y-6">
                    <div className="content-card">
                        <div className="card-header">
                            <FileText size={20} className="text-primary" />
                            <h2 className="card-title">Job Description</h2>
                        </div>
                        <div className="card-body markdown-content" style={{ color: 'var(--text-main)', lineHeight: '1.7' }}>
                            <ReactMarkdown
                                components={{
                                    h1: ({ node, ...props }) => <h3 style={{ fontSize: '20px', fontWeight: '700', marginTop: '24px', marginBottom: '12px' }} {...props} />,
                                    h2: ({ node, ...props }) => <h4 style={{ fontSize: '18px', fontWeight: '600', marginTop: '20px', marginBottom: '10px' }} {...props} />,
                                    ul: ({ node, ...props }) => <ul style={{ paddingLeft: '20px', listStyleType: 'disc', marginBottom: '16px' }} {...props} />,
                                    ol: ({ node, ...props }) => <ol style={{ paddingLeft: '20px', listStyleType: 'decimal', marginBottom: '16px' }} {...props} />,
                                    li: ({ node, ...props }) => <li style={{ marginBottom: '8px' }} {...props} />,
                                    p: ({ node, ...props }) => <p style={{ marginBottom: '16px' }} {...props} />,
                                    strong: ({ node, ...props }) => <strong style={{ color: 'var(--text-main)', fontWeight: '700' }} {...props} />,
                                }}
                            >
                                {job.description}
                            </ReactMarkdown>
                        </div>
                    </div>
                </div>

                {/* Right Column: AI Assistant & Form */}
                <div className="md:sticky md:top-8 h-fit space-y-6">
                    {/* Guidelines Card - Dynamic & Right Aligned - ALWAYS VISIBLE */}
                    <div className="content-card animate-fade-in" style={{ borderLeft: '4px solid #f97316', background: '#fff7ed' }}>
                        <div className="card-header" style={{ background: 'transparent', borderBottom: '1px solid #ffedd5' }}>
                            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#c2410c' }}>
                                How to Apply
                            </h2>
                        </div>
                        <div className="card-body">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                                    <div style={{
                                        minWidth: '28px', height: '28px', borderRadius: '50%', background: '#fdba74',
                                        color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontWeight: '600', fontSize: '14px'
                                    }}>1</div>
                                    <div>
                                        <h4 style={{ fontWeight: '600', color: '#9a3412', marginBottom: '4px' }}>Chat with AI</h4>
                                        <p style={{ fontSize: '13px', color: '#9a3412', lineHeight: '1.5', opacity: 0.9 }}>
                                            Click "Start Screening" to answer a few questions. The AI evaluates your fit instantly.
                                        </p>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                                    <div style={{
                                        minWidth: '28px', height: '28px', borderRadius: '50%', background: '#fdba74',
                                        color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontWeight: '600', fontSize: '14px'
                                    }}>2</div>
                                    <div>
                                        <h4 style={{ fontWeight: '600', color: '#9a3412', marginBottom: '4px' }}>Upload Details</h4>
                                        <p style={{ fontSize: '13px', color: '#9a3412', lineHeight: '1.5', opacity: 0.9 }}>
                                            Attach your resume and provide contact info after the chat.
                                        </p>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                                    <div style={{
                                        minWidth: '28px', height: '28px', borderRadius: '50%', background: '#fdba74',
                                        color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontWeight: '600', fontSize: '14px'
                                    }}>3</div>
                                    <div>
                                        <h4 style={{ fontWeight: '600', color: '#9a3412', marginBottom: '4px' }}>Submit</h4>
                                        <p style={{ fontSize: '13px', color: '#9a3412', lineHeight: '1.5', opacity: 0.9 }}>
                                            Review and send your application. Good luck!
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>


                    <div className="content-card">
                        <div className="card-header">
                            <h2 className="card-title">Apply Now</h2>
                        </div>
                        <div className="card-body">
                            {!chatAnswers ? (
                                <div className="chatbot-section">
                                    <p style={{ marginBottom: '16px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                                        Please answer a few questions from our AI recruiter to verify your fit for this role.
                                    </p>
                                    <Chatbot jobId={jobId} onComplete={(history) => setChatAnswers(history)} />
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    <div className="form-section animate-fade-in">
                                        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>Your Details</h3>

                                        <div style={{ marginBottom: '16px' }}>
                                            <label className="form-label">Full Name</label>
                                            <input
                                                type="text"
                                                required
                                                value={formData.name}
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                className="modern-input"
                                                placeholder="John Doe"
                                            />
                                        </div>

                                        <div style={{ marginBottom: '16px' }}>
                                            <label className="form-label">Email Address</label>
                                            <input
                                                type="email"
                                                required
                                                value={formData.email}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                className="modern-input"
                                                placeholder="john@example.com"
                                            />
                                        </div>

                                        <div style={{ marginBottom: '16px' }}>
                                            <label className="form-label">Phone Number</label>
                                            <PhoneInput
                                                country={'us'}
                                                value={formData.phone}
                                                onChange={phone => setFormData({ ...formData, phone: '+' + phone })}
                                                inputStyle={{
                                                    width: '100%',
                                                    height: '42px',
                                                    borderRadius: '8px',
                                                    border: '1px solid var(--border)',
                                                    fontSize: '14px',
                                                    paddingLeft: '48px'
                                                }}
                                                containerStyle={{
                                                    borderRadius: '8px'
                                                }}
                                                buttonStyle={{
                                                    borderRadius: '8px 0 0 8px',
                                                    border: '1px solid var(--border)',
                                                    borderRight: 'none',
                                                    background: 'white'
                                                }}
                                            />
                                        </div>

                                        <div style={{ marginBottom: '16px' }}>
                                            <label className="form-label" style={{ marginBottom: '12px', display: 'block' }}>WhatsApp Contact</label>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

                                                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '10px', cursor: 'pointer', width: 'fit-content' }}>
                                                    <input
                                                        type="radio"
                                                        name="whatsappOption"
                                                        value="same"
                                                        checked={whatsappOption === 'same'}
                                                        onChange={(e) => setWhatsappOption(e.target.value)}
                                                        style={{ margin: 0, width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                                                    />
                                                    <span style={{ fontSize: '14px', color: 'var(--text-main)' }}>Same as phone number</span>
                                                </label>

                                                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '10px', cursor: 'pointer', width: 'fit-content' }}>
                                                    <input
                                                        type="radio"
                                                        name="whatsappOption"
                                                        value="different"
                                                        checked={whatsappOption === 'different'}
                                                        onChange={(e) => setWhatsappOption(e.target.value)}
                                                        style={{ margin: 0, width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                                                    />
                                                    <span style={{ fontSize: '14px', color: 'var(--text-main)' }}>Use a different number</span>
                                                </label>

                                                {whatsappOption === 'different' && (
                                                    <div style={{ marginLeft: '26px', marginTop: '8px', maxWidth: '300px' }} className="animate-fade-in">
                                                        <PhoneInput
                                                            country={'us'}
                                                            value={customWhatsapp}
                                                            onChange={phone => setCustomWhatsapp('+' + phone)}
                                                            inputStyle={{
                                                                width: '100%',
                                                                height: '42px',
                                                                borderRadius: '8px',
                                                                border: '1px solid var(--border)',
                                                                fontSize: '14px',
                                                                paddingLeft: '48px'
                                                            }}
                                                            containerStyle={{
                                                                borderRadius: '8px'
                                                            }}
                                                            buttonStyle={{
                                                                borderRadius: '8px 0 0 8px',
                                                                border: '1px solid var(--border)',
                                                                borderRight: 'none',
                                                                background: 'white'
                                                            }}
                                                        />
                                                    </div>
                                                )}

                                                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '10px', cursor: 'pointer', width: 'fit-content' }}>
                                                    <input
                                                        type="radio"
                                                        name="whatsappOption"
                                                        value="none"
                                                        checked={whatsappOption === 'none'}
                                                        onChange={(e) => setWhatsappOption(e.target.value)}
                                                        style={{ margin: 0, width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                                                    />
                                                    <span style={{ fontSize: '14px', color: 'var(--text-main)' }}>I don't receive WhatsApp messages</span>
                                                </label>
                                            </div>
                                        </div>

                                        <div style={{ marginBottom: '16px' }}>
                                            <label className="form-label">LinkedIn URL</label>
                                            <input
                                                type="url"
                                                value={formData.linkedin}
                                                onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })}
                                                className="modern-input"
                                                placeholder="https://linkedin.com/in/..."
                                            />
                                        </div>

                                        <div style={{ marginBottom: '16px' }}>
                                            <label className="form-label">Resume</label>
                                            <div style={{
                                                border: '2px dashed var(--border)',
                                                borderRadius: '8px',
                                                padding: '24px',
                                                textAlign: 'center',
                                                background: '#f9fafb',
                                                cursor: 'pointer'
                                            }} onClick={() => document.getElementById('resume-upload').click()}>
                                                <Upload size={24} style={{ color: 'var(--text-secondary)', marginBottom: '8px' }} />
                                                <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--primary)' }}>
                                                    {resume ? resume.name : 'Click to Upload Resume'}
                                                </div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                                    PDF or DOCX (Max 10MB)
                                                </div>
                                                <input
                                                    id="resume-upload"
                                                    type="file"
                                                    hidden
                                                    accept=".pdf,.docx,.doc"
                                                    onChange={(e) => setResume(e.target.files[0])}
                                                />
                                            </div>
                                        </div>

                                        <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }}>
                                            Submit Application <Send size={18} />
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
}

export default ApplyPage;
