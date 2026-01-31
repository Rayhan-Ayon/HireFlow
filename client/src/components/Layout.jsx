import Sidebar from './Sidebar';

const Layout = ({ children }) => {
    return (
        <div className="app-layout">
            <Sidebar />
            <main className="main-content">
                <header style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '32px'
                }}>
                    <div>
                        {/* Breadcrumbs or Title could go here based on Page */}
                    </div>
                    <div style={{ display: 'flex', gap: '16px' }}>
                        {/* Top actions */}
                    </div>
                </header>
                {children}
            </main>
        </div>
    );
};

export default Layout;
