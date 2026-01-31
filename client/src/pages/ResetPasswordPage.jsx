import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Lock, CheckCircle } from 'lucide-react';

const ResetPasswordPage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (!token) {
            setError('Invalid or missing reset token.');
        }
    }, [token]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password })
            });
            const data = await res.json();

            if (res.ok) {
                setSuccess(true);
                setMessage('Password reset successful! You can now log in.');
            } else {
                setError(data.error || 'Failed to reset password');
            }
        } catch (err) {
            setError('Network error');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-light)' }}>
                <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '40px', textAlign: 'center' }}>
                    <div style={{ margin: '0 auto 24px auto', width: '64px', height: '64px', background: '#ecfdf5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#047857' }}>
                        <CheckCircle size={32} />
                    </div>
                    <h2 style={{ marginBottom: '16px' }}>Password Reset Complete</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>Your password has been successfully updated.</p>
                    <Link to="/login" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                        Proceed to Login
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-light)' }}>
            <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '40px' }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--primary)' }}>Set New Password</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Please create a strong password.</p>
                </div>

                {error && <div className="alert alert-error" style={{ marginBottom: '16px' }}>{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>New Password</label>
                        <div className="input-with-icon">
                            <Lock size={18} />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                minLength={6}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Confirm Password</label>
                        <div className="input-with-icon">
                            <Lock size={18} />
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                            />
                        </div>
                    </div>

                    <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '16px' }} disabled={loading || !token}>
                        {loading ? 'Updating...' : 'Update Password'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ResetPasswordPage;
