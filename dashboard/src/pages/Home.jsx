import React from 'react';

const Home = () => {
    return (
        <div>
            <h1>Dashboard Overview</h1>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginTop: '30px' }}>
                <div style={{ padding: '20px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', borderRadius: '8px' }}>
                    <h3>Total Users</h3>
                    <p style={{ fontSize: '24px', fontWeight: 'bold' }}>1,250</p>
                </div>
                <div style={{ padding: '20px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', borderRadius: '8px' }}>
                    <h3>Active Today</h3>
                    <p style={{ fontSize: '24px', fontWeight: 'bold' }}>890</p>
                </div>
                <div style={{ padding: '20px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', borderRadius: '8px' }}>
                    <h3>Alerts</h3>
                    <p style={{ fontSize: '24px', fontWeight: 'bold', color: 'red' }}>3</p>
                </div>
            </div>
        </div>
    );
};

export default Home;
