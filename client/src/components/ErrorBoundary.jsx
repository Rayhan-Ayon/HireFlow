import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Dashboard Error Boundary Caught:", error, errorInfo);
        this.setState({ error, errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '40px', color: 'red', fontFamily: 'monospace' }}>
                    <h1>Dashboard Crashed</h1>
                    <p>{this.state.error && this.state.error.toString()}</p>
                    <pre style={{ background: '#f0f0f0', padding: '20px', overflow: 'auto' }}>
                        {this.state.errorInfo && this.state.errorInfo.componentStack}
                    </pre>
                    <button
                        onClick={() => window.location.reload()}
                        style={{ padding: '10px 20px', marginTop: '20px', cursor: 'pointer' }}
                    >
                        Reload Page
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
