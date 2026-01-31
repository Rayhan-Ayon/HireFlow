import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    Briefcase,
    Users,
    FileText,
    MessageSquare,
    Settings,
    Calendar,
    Bell,
    LogOut
} from 'lucide-react';

const Sidebar = () => {
    const location = useLocation();
    const [user, setUser] = useState({ name: 'Loading...', role: 'Recruiter' });
    const [unreadCount, setUnreadCount] = useState(0);

    const isActive = (path) => location.pathname === path;

    const navItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
        { icon: Bell, label: 'Notifications', path: '/notifications' },
        { icon: Briefcase, label: 'Jobs', path: '/jobs' },
        { icon: Users, label: 'Candidates', path: '/candidates' },
        { icon: MessageSquare, label: 'Mailbox', path: '/mailbox' },
        { icon: Calendar, label: 'Interviews', path: '/interviews' },
        { icon: FileText, label: 'Templates', path: '/templates' },
        { icon: Settings, label: 'Settings', path: '/settings' },
    ];

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch('/api/user/profile', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setUser({
                        name: data.profile?.name || data.name || 'User',
                        role: data.profile?.role || data.role || 'Recruiter'
                    });
                }
            } catch (err) {
                console.error('Failed to fetch sidebar profile', err);
            }
        };

        fetchProfile();
        const fetchNotifications = async () => {
            try {
                // Notifications might need auth too? Assuming yes if profile does.
                // But let's check index.js - not guarded yet? Wait, notifications not guarded in index.js yet.
                // I should add Header anyway.
                const token = localStorage.getItem('token');
                const res = await fetch('/api/notifications', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    const unread = (data.notifications || []).filter(n => !n.is_read).length;
                    setUnreadCount(unread);
                }
            } catch (err) {
                console.error('Failed to fetch notifications', err);
            }
        };

        fetchProfile();
        fetchNotifications();
        // Poll for updates (e.g. if user renames in Settings or new notifications)
        const interval = setInterval(() => {
            fetchProfile();
            fetchNotifications();
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    const getInitials = (name) => {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);
    };

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <div className="logo-container">
                    <div className="logo-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                        </svg>
                    </div>
                    <span className="logo-text">HireFlow</span>
                </div>
                <div className="logo-subtitle">Recruitment Made Simple</div>
            </div>

            <nav className="sidebar-nav">
                <div className="nav-section-label">Navigation</div>
                <ul className="nav-list">
                    {navItems.map((item) => (
                        <li key={item.path}>
                            <Link to={item.path} className={`nav-item ${isActive(item.path) ? 'active' : ''}`} style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <item.icon size={20} />
                                    {item.label}
                                </div>
                                {item.label === 'Notifications' && unreadCount > 0 && (
                                    <span style={{
                                        background: '#ef4444',
                                        color: 'white',
                                        fontSize: '11px',
                                        fontWeight: 'bold',
                                        padding: '2px 6px',
                                        borderRadius: '10px',
                                        minWidth: '18px',
                                        textAlign: 'center'
                                    }}>
                                        {unreadCount}
                                    </span>
                                )}
                            </Link>
                        </li>
                    ))}
                </ul>
            </nav>

            <div className="user-profile-section">
                <div className="user-profile-card">
                    <div className="user-avatar">{getInitials(user.name === 'Loading...' ? '?' : user.name)}</div>
                    <div className="user-info">
                        <div className="user-name">{user.name}</div>
                        <div className="user-role">{user.role}</div>
                    </div>
                    <button
                        onClick={() => {
                            localStorage.removeItem('token');
                            window.location.href = '/login';
                        }}
                        style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', marginLeft: 'auto', padding: '4px' }}
                        title="Sign Out"
                    >
                        <LogOut size={18} />
                    </button>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
