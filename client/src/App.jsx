import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import CreateJob from './pages/CreateJob';
import JobsPage from './pages/JobsPage';
import JobPipeline from './pages/JobPipeline';
import ApplyPage from './pages/ApplyPage';
import CandidatesPage from './pages/CandidatesPage';
import CandidateProfile from './pages/CandidateProfile';
import InterviewsPage from './pages/InterviewsPage';
import Templates from './pages/Templates';
import Mailbox from './pages/Mailbox';
import NotificationsPage from './pages/NotificationsPage';
import SignupPage from './pages/SignupPage';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';

import Settings from './pages/Settings';
import './App.css';

function App() {
    // Theme State
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

    useEffect(() => {
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    };

    return (
        <Router>
            <Routes>
                {/* Public Auth Routes */}
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />

                {/* Application Flow Routes (No Sidebar) - Should be protected? Keeping plain for now or protect later */}
                <Route path="/apply/:jobId" element={<ApplyPage />} />

                {/* Protected Admin Dashboard Routes */}
                <Route path="/*" element={
                    localStorage.getItem('token') ? (
                        <Layout>
                            <Routes>
                                <Route path="/" element={<Dashboard />} />
                                <Route path="/create-job" element={<CreateJob />} />
                                <Route path="/edit-job/:jobId" element={<CreateJob />} />
                                <Route path="/jobs" element={<JobsPage />} />
                                <Route path="/jobs/:jobId/candidates" element={<CandidatesPage />} />
                                <Route path="/jobs/:jobId/pipeline" element={<JobPipeline />} />
                                <Route path="/candidates" element={<CandidatesPage />} />
                                <Route path="/candidates/:candidateId" element={<CandidateProfile />} />
                                <Route path="/mailbox" element={<Mailbox />} />
                                <Route path="/interviews" element={<InterviewsPage />} />
                                <Route path="/notifications" element={<NotificationsPage />} />
                                <Route path="/templates" element={<Templates />} />
                                <Route path="/settings" element={<Settings theme={theme} toggleTheme={toggleTheme} />} />
                            </Routes>
                        </Layout>
                    ) : (
                        <LoginPage /> // Redirect to login if no token
                    )
                } />
            </Routes>
        </Router>
    );
}

export default App;
