import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, ArrowLeft } from 'lucide-react';

const ForgotPasswordPage = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setMessage('');

        try {
            const res = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await res.json();

            if (res.ok) {
                setMessage('If an account exists with this email, you will receive a reset link shortly.');
            } else {
                setError(data.error || 'Request failed');
            }
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-light)' }}>
            <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '40px' }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--primary)' }}>Reset Password</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Enter your email to receive recovery instructions.</p>
                </div>

                {error && <div className="alert alert-error" style={{ marginBottom: '16px' }}>{error}</div>}
                {message && <div className="alert alert-success" style={{ marginBottom: '16px', background: '#ecfdf5', color: '#047857', padding: '12px', borderRadius: '8px', border: '1px solid #a7f3d0' }}>{message}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Email Address</label>
                        <div className="input-with-icon">
                            <Mail size={18} />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="john@company.com"
                                required
                            />
                        </div>
                    </div>

                    <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '16px' }} disabled={loading}>
                        {loading ? 'Sending Link...' : 'Send Reset Link'}
                    </button>
                </form>

                <div style={{ marginTop: '24px', textAlign: 'center' }}>
                    <Link to="/login" style={{ color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                        <ArrowLeft size={16} /> Back to Login
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default ForgotPasswordPage;
