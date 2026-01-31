import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCircle, ExternalLink } from 'lucide-react';

function NotificationsPage() {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchNotifications();
    }, []);

    const fetchNotifications = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/notifications', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setNotifications(data.notifications || []);
            setLoading(false);
        } catch (err) {
            console.error('Failed to fetch notifications', err);
            setLoading(false);
        }
    };

    const markAsRead = async (id, link) => {
        try {
            const token = localStorage.getItem('token');
            await fetch(`/api/notifications/${id}/read`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            // Optimistic update
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));

            // If link provided, we rely on Link navigation or window.location if external.
            // But usually user just clicks the item. 
            // This function is for explicit button or row click logic.
        } catch (err) {
            console.error('Failed to mark read', err);
        }
    };

    const markAllRead = async () => {
        try {
            const token = localStorage.getItem('token');
            await fetch('/api/notifications/read-all', {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
        } catch (err) {
            console.error('Failed to mark all read', err);
        }
    };

    if (loading) return <div className="p-8">Loading notifications...</div>;

    return (
        <div style={{ padding: '0px', maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontSize: '28px', marginBottom: '8px' }}>Notifications</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Stay updated with your recruiting pipeline.</p>
                </div>
                <button className="btn btn-secondary" onClick={markAllRead}>
                    <CheckCircle size={16} style={{ marginRight: '8px' }} /> Mark all read
                </button>
            </div>

            <div className="content-card">
                <div className="card-body" style={{ padding: 0 }}>
                    {notifications.length === 0 && (
                        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                            <Bell size={32} style={{ marginBottom: '16px', opacity: 0.2 }} />
                            <p>No notifications yet.</p>
                        </div>
                    )}
                    {notifications.map(n => (
                        <div
                            key={n.id}
                            style={{
                                padding: '16px 24px',
                                borderBottom: '1px solid var(--border)',
                                display: 'flex',
                                gap: '16px',
                                background: n.is_read ? 'white' : '#f0f9ff',
                                alignItems: 'start',
                                transition: 'background 0.2s'
                            }}
                            className="hover:bg-gray-50"
                        >
                            <div style={{
                                width: '40px', height: '40px',
                                borderRadius: '50%',
                                background: n.type === 'job' ? '#e0f2fe' : (n.type === 'application' ? '#ecfdf5' : '#f3f4f6'),
                                color: n.type === 'job' ? '#0284c7' : (n.type === 'application' ? '#059669' : '#4b5563'),
                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                            }}>
                                <Bell size={20} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                    <h4 style={{ fontWeight: '600', color: n.is_read ? 'var(--text-main)' : 'var(--primary)', fontSize: '15px' }}>{n.title}</h4>
                                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                        {new Date(n.created_at).toLocaleString()}
                                    </span>
                                </div>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px' }}>{n.message}</p>
                                {n.link && (
                                    <Link
                                        to={n.link}
                                        onClick={() => markAsRead(n.id)}
                                        style={{ fontSize: '13px', color: 'var(--primary)', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    >
                                        View Details <ExternalLink size={12} />
                                    </Link>
                                )}
                            </div>
                            {!n.is_read && (
                                <button
                                    onClick={() => markAsRead(n.id)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-secondary)' }}
                                    title="Mark as read"
                                >
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)' }} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default NotificationsPage;
