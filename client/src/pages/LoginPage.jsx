import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock } from 'lucide-react';

const LoginPage = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');

        if (code) {
            const completeSocialLogin = async () => {
                setLoading(true);
                try {
                    // Retrieve any pending signup data (from SignupPage)
                    const pendingDataStr = localStorage.getItem('pending_signup_data');
                    let pendingData = {};
                    try {
                        if (pendingDataStr) pendingData = JSON.parse(pendingDataStr);
                    } catch (e) { console.error('Error parsing pending data', e); }

                    const res = await fetch('/api/auth/google/callback', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            code,
                            state: 'login',
                            signupData: pendingData // Pass it to backend
                        })
                    });

                    // Clear pending data after use
                    localStorage.removeItem('pending_signup_data');
                    const data = await res.json();
                    if (res.ok) {
                        localStorage.setItem('token', data.token);
                        window.location.href = '/';
                    } else {
                        setError(data.error || 'Social Login Failed');
                    }
                } catch (err) {
                    setError('Social Login Network Error');
                } finally {
                    setLoading(false);
                }
            };
            completeSocialLogin();
        }
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await res.json();

            if (res.ok) {
                localStorage.setItem('token', data.token);
                // Redirect to Dashboard (Standard SaaS behavior)
                window.location.href = '/';
            } else {
                setError(data.error || 'Login failed');
            }
        } catch (err) {
            setError('Network error');
        } finally {
            setLoading(false);
        }
    };

    const handleSocialLogin = async (provider) => {
        try {
            const res = await fetch(`/api/auth/${provider}?state=login`);
            const data = await res.json();
            if (data.url) window.location.href = data.url;
        } catch (err) {
            console.error('Auth Error', err);
        }
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-light)' }}>
            <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '40px' }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--primary)' }}>Welcome Back</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Login to your HireFlow account.</p>
                </div>

                {error && <div className="alert alert-error" style={{ marginBottom: '16px' }}>{error}</div>}

                <form onSubmit={handleLogin}>
                    <div className="form-group">
                        <label>Email</label>
                        <div className="input-with-icon">
                            <Mail size={18} />
                            <input name="email" type="email" placeholder="john@acme.com" required onChange={handleChange} />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Password</label>
                        <div className="input-with-icon">
                            <Lock size={18} />
                            <input name="password" type="password" placeholder="••••••••" required onChange={handleChange} />
                        </div>
                        <div style={{ textAlign: 'right', marginTop: '6px' }}>
                            <Link to="/forgot-password" style={{ fontSize: '13px', color: 'var(--primary)', fontWeight: '500', textDecoration: 'none' }}>
                                Forgot password?
                            </Link>
                        </div>
                    </div>

                    <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '16px' }} disabled={loading}>
                        {loading ? 'Logging In...' : 'Log In'}
                    </button>
                </form>

                <div style={{ margin: '24px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>Or login with</div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => handleSocialLogin('google')}>
                        Google
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => handleSocialLogin('microsoft')}>
                        Microsoft
                    </button>
                </div>

                <div style={{ marginTop: '24px', textAlign: 'center' }}>
                    Don't have an account? <Link to="/signup" style={{ color: 'var(--primary)', fontWeight: '500' }}>Sign up</Link>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
