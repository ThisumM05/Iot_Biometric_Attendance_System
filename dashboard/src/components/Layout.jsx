import { Outlet } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { FaHome, FaUser, FaChartBar, FaCog } from 'react-icons/fa';

const Sidebar = () => {
    return (
        <div style={{ width: '250px', background: '#333', color: '#fff', height: '100vh', padding: '20px' }}>
            <h2>IoT Biometrics</h2>
            <ul style={{ listStyle: 'none', padding: 0, marginTop: '50px' }}>
                <li style={{ marginBottom: '20px' }}><Link to="/" style={{ color: '#fff', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}><FaHome /> Dashboard</Link></li>
                <li style={{ marginBottom: '20px' }}><Link to="/users" style={{ color: '#fff', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}><FaUser /> Users</Link></li>
                <li style={{ marginBottom: '20px' }}><Link to="/analytics" style={{ color: '#fff', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}><FaChartBar /> Analytics</Link></li>
                <li style={{ marginBottom: '20px' }}><Link to="/settings" style={{ color: '#fff', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}><FaCog /> Settings</Link></li>
            </ul>
        </div>
    );
};

const Layout = () => {
    return (
        <div style={{ display: 'flex' }}>
            <Sidebar />
            <div style={{ flex: 1, padding: '20px' }}>
                <Outlet />
            </div>
        </div>
    );
};

export default Layout;
