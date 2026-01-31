import { useState, useEffect } from 'react';
import { Mail, Plus, Sparkles, Trash2, Edit3, Check, X, ToggleLeft, ToggleRight, Loader2, Wand2 } from 'lucide-react';

function Templates() {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    const [formData, setFormData] = useState({
        id: null,
        name: '',
        subject: '',
        content: '',
        category: 'custom'
    });

    const [aiPrompt, setAiPrompt] = useState('');

    useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/templates', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setTemplates(data.templates || []);
        } catch (err) {
            console.error('Failed to fetch templates:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = async (template) => {
        try {
            const res = await fetch(`/api/templates/${template.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ is_enabled: !template.is_enabled })
            });
            if (res.ok) {
                setTemplates(prev => prev.map(t => t.id === template.id ? { ...t, is_enabled: !t.is_enabled } : t));
            }
        } catch (err) {
            console.error('Failed to toggle template:', err);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this custom template?')) return;
        try {
            const res = await fetch(`/api/templates/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) {
                setTemplates(prev => prev.filter(t => t.id !== id));
            }
        } catch (err) {
            console.error('Failed to delete template:', err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const method = isEditing ? 'PUT' : 'POST';
        const url = isEditing ? `/api/templates/${formData.id}` : '/api/templates';

        try {
            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(formData)
            });
            if (res.ok) {
                fetchTemplates();
                setShowModal(false);
                setFormData({ id: null, name: '', subject: '', content: '', category: 'custom' });
            }
        } catch (err) {
            console.error('Failed to save template:', err);
        }
    };

    const handleGenerateAI = async () => {
        if (!aiPrompt) return;
        setIsGenerating(true);
        try {
            const res = await fetch('/api/templates/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ prompt: aiPrompt })
            });
            const data = await res.json();
            if (data.content) {
                setFormData({
                    ...formData,
                    name: data.name || 'AI Generated Template',
                    subject: data.subject || '',
                    content: data.content || ''
                });
                setAiPrompt('');
            }
        } catch (err) {
            console.error('AI Generation failed:', err);
            alert('AI was unable to generate a template. Please try a different prompt.');
        } finally {
            setIsGenerating(false);
        }
    };

    const openEdit = (template) => {
        setFormData({
            id: template.id,
            name: template.name,
            subject: template.subject,
            content: template.content,
            category: template.category
        });
        setIsEditing(true);
        setShowModal(true);
    };

    const categories = {
        invite: { label: 'Interview Invites', color: 'blue' },
        availability: { label: 'Availability', color: 'indigo' },
        rejection: { label: 'Rejections', color: 'red' },
        hiring: { label: 'Offer Letters', color: 'emerald' },
        custom: { label: 'Custom', color: 'slate' }
    };

    return (
        <div className="page-container">
            <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 className="dashboard-title">Email Templates</h1>
                    <p className="dashboard-subtitle">Manage and automate your candidate communication with professional templates.</p>
                </div>
                <button className="btn btn-primary" onClick={() => { setIsEditing(false); setShowModal(true); }}>
                    <Plus size={18} /> Create Template
                </button>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '100px' }}>
                    <div className="typing-dot"></div>
                    <div className="typing-dot"></div>
                    <div className="typing-dot"></div>
                    <p style={{ marginTop: '16px', color: 'var(--text-secondary)' }}>Loading templates...</p>
                </div>
            ) : (
                <div className="templates-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '24px' }}>
                    {templates.map(template => (
                        <div key={template.id} className="job-card" style={{ opacity: template.is_enabled ? 1 : 0.6, position: 'relative' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                <div style={{
                                    padding: '4px 10px',
                                    borderRadius: '50px',
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    textTransform: 'uppercase',
                                    backgroundColor: `var(--${categories[template.category]?.color || 'slate'}-light, #f1f5f9)`,
                                    color: `var(--${categories[template.category]?.color || 'slate'}, #64748b)`,
                                    border: `1px solid var(--${categories[template.category]?.color || 'slate'}-subtle, #e2e8f0)`
                                }}>
                                    {template.category}
                                </div>
                                <button
                                    onClick={() => handleToggle(template)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: template.is_enabled ? 'var(--primary)' : 'var(--text-secondary)' }}
                                >
                                    {template.is_enabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                                </button>
                            </div>

                            <h3 style={{ marginBottom: '8px', fontSize: '18px' }}>{template.name}</h3>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', fontStyle: 'italic' }}>
                                Subject: {template.subject}
                            </p>

                            <div style={{
                                height: '100px',
                                overflow: 'hidden',
                                fontSize: '14px',
                                color: 'var(--text-main)',
                                padding: '12px',
                                background: 'var(--bg-body)',
                                borderRadius: '8px',
                                border: '1px solid var(--border)',
                                marginBottom: '20px',
                                whiteSpace: 'pre-wrap',
                                maskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)'
                            }}>
                                {template.content}
                            </div>

                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => openEdit(template)}>
                                    <Edit3 size={16} /> Edit
                                </button>
                                {!template.is_prebuilt && (
                                    <button className="btn btn-secondary" style={{ color: 'var(--red)' }} onClick={() => handleDelete(template.id)}>
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px'
                }}>
                    <div className="form-card" style={{ maxWidth: '700px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div className="form-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ margin: 0 }}>{isEditing ? 'Edit Template' : 'Create Custom Template'}</h2>
                            <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                <X size={24} />
                            </button>
                        </div>

                        <div className="form-body">
                            {!isEditing && (
                                <div style={{
                                    padding: '20px',
                                    background: 'var(--primary-light)',
                                    borderRadius: '12px',
                                    marginBottom: '24px',
                                    border: '1px solid var(--primary-subtle)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                        <Sparkles size={20} className="text-primary" />
                                        <label className="form-label" style={{ marginBottom: 0 }}>Draft with AI</label>
                                    </div>
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <input
                                            className="modern-input"
                                            placeholder="Describe what this email should say... (e.g. A polite rejection after the first interview)"
                                            value={aiPrompt}
                                            onChange={(e) => setAiPrompt(e.target.value)}
                                            onKeyPress={(e) => e.key === 'Enter' && handleGenerateAI()}
                                        />
                                        <button className="btn btn-primary" onClick={handleGenerateAI} disabled={isGenerating || !aiPrompt}>
                                            {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Wand2 size={18} />}
                                            Generate
                                        </button>
                                    </div>
                                </div>
                            )}

                            <form onSubmit={handleSubmit}>
                                <div className="form-section">
                                    <label className="form-label">Template Name</label>
                                    <input
                                        className="modern-input"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="e.g. Second Interview Invite"
                                        required
                                    />
                                </div>

                                <div className="form-section">
                                    <label className="form-label">Email Subject</label>
                                    <input
                                        className="modern-input"
                                        value={formData.subject}
                                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                        placeholder="Use {{candidate_name}} or {{job_title}} as placeholders"
                                        required
                                    />
                                </div>

                                <div className="form-section">
                                    <label className="form-label">Email Body</label>
                                    <textarea
                                        className="modern-textarea"
                                        rows={10}
                                        value={formData.content}
                                        onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                        placeholder="Hi {{candidate_name}}, ..."
                                        required
                                    />
                                    <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        {['{{candidate_name}}', '{{job_title}}', '{{company_name}}', '{{user_name}}'].map(tag => (
                                            <span key={tag} style={{
                                                fontSize: '11px',
                                                background: 'var(--bg-body)',
                                                padding: '4px 8px',
                                                borderRadius: '4px',
                                                border: '1px solid var(--border)',
                                                color: 'var(--text-secondary)'
                                            }}>
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div className="form-actions" style={{ marginTop: '32px' }}>
                                    <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">Cancel</button>
                                    <button type="submit" className="btn btn-primary">
                                        <Check size={18} /> {isEditing ? 'Save Changes' : 'Create Template'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Templates;
