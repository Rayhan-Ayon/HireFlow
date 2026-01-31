import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LayoutDashboard, Globe, User, Building, Mail, Lock } from 'lucide-react'; // Icons

const SignupPage = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        name: '',
        company_name: '',
        company_website: '',
        role: '',
        email: '',
        password: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSignup = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await res.json();

            if (res.ok) {
                localStorage.setItem('token', data.token);
                // Redirect to Dashboard
                window.location.href = '/';
            } else {
                setError(data.error || 'Signup failed');
            }
        } catch (err) {
            setError('Network error');
        } finally {
            setLoading(false);
        }
    };

    const handleSocialLogin = async (provider) => {
        try {
            // Save form data to apply after signup
            localStorage.setItem('pending_signup_data', JSON.stringify(formData));

            // Explicitly request 'login' state so backend creates user
            const res = await fetch(`/api/auth/${provider}?state=login`);
            const data = await res.json();
            if (data.url) window.location.href = data.url;
        } catch (err) {
            console.error('Auth Error', err);
        }
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-light)' }}>
            <div className="card" style={{ width: '100%', maxWidth: '500px', padding: '40px' }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--primary)' }}>Start Your Free Trial</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Join thousands of recruiters optimizing their workflow.</p>
                </div>

                {error && <div className="alert alert-error" style={{ marginBottom: '16px' }}>{error}</div>}

                <form onSubmit={handleSignup}>
                    <div className="form-group">
                        <label>Full Name</label>
                        <input name="name" placeholder="John Doe" required onChange={handleChange} />
                    </div>

                    <div className="form-group">
                        <label>Company Name</label>
                        <input name="company_name" placeholder="Acme Corp" required onChange={handleChange} />
                    </div>

                    <div className="form-group">
                        <label>Company Website</label>
                        <input name="company_website" placeholder="https://acme.com" required onChange={handleChange} />
                    </div>

                    <div className="form-group">
                        <label>Your Role</label>
                        <select name="role" className="select" required onChange={handleChange} style={{ width: '100%' }}>
                            <option value="">Select Role...</option>
                            <option value="Recruiter">Recruiter</option>
                            <option value="Hiring Manager">Hiring Manager</option>
                            <option value="Admin">Admin</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Email</label>
                        <input name="email" type="email" placeholder="john@acme.com" required onChange={handleChange} />
                    </div>

                    <div className="form-group">
                        <label>Password</label>
                        <input name="password" type="password" placeholder="••••••••" required onChange={handleChange} />
                    </div>

                    <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '16px' }} disabled={loading}>
                        {loading ? 'Creating Account...' : 'Get Started'}
                    </button>
                </form>

                <div style={{ margin: '24px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>Or sign up with</div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => handleSocialLogin('google')}>
                        Google
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => handleSocialLogin('microsoft')}>
                        Microsoft
                    </button>
                </div>

                <div style={{ marginTop: '24px', textAlign: 'center' }}>
                    Already have an account? <Link to="/login" style={{ color: 'var(--primary)', fontWeight: '500' }}>Log in</Link>
                </div>
            </div>
        </div>
    );
};

export default SignupPage;
