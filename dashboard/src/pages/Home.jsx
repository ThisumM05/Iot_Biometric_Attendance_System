import React from 'react';
import { Users, Activity, Bell, ArrowUpRight } from 'lucide-react';

const StatCard = ({ title, value, icon: Icon, trend, trendUp }) => (
    <div className="p-6 rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex items-end justify-between">
            <p className="text-2xl font-bold">{value}</p>
            {trend && (
                <div className={`flex items-center text-xs ${trendUp ? 'text-green-500' : 'text-red-500'}`}>
                    {trend}
                    <ArrowUpRight className="h-3 w-3 ml-1" />
                </div>
            )}
        </div>
    </div>
);

const Home = () => {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Dashboard Overview</h1>
                <div className="text-sm text-muted-foreground">
                    Welcome back, Admin
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    title="Total Users"
                    value="1,250"
                    icon={Users}
                    trend="+12%"
                    trendUp={true}
                />
                <StatCard
                    title="Active Today"
                    value="890"
                    icon={Activity}
                    trend="+5%"
                    trendUp={true}
                />
                <StatCard
                    title="Pending Alerts"
                    value="3"
                    icon={Bell}
                    trend="-2"
                    trendUp={false}
                />
                <StatCard
                    title="System Status"
                    value="Optimal"
                    icon={Database}
                    trend="99.9%"
                    trendUp={true}
                />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <div className="col-span-4 rounded-xl border bg-card text-card-foreground shadow-sm p-6">
                    <h3 className="font-semibold mb-4">Attendance Overview</h3>
                    <div className="h-[200px] flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg">
                        Chart Placeholder
                    </div>
                </div>
                <div className="col-span-3 rounded-xl border bg-card text-card-foreground shadow-sm p-6">
                    <h3 className="font-semibold mb-4">Recent Activity</h3>
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex items-center gap-4">
                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                    <Users className="h-4 w-4 text-primary" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm font-medium leading-none">User {i} Checked In</p>
                                    <p className="text-xs text-muted-foreground">2 minutes ago</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Simple Database icon component for the stats since lucide might not export it directly as Database in all versions or just to be safe
const Database = ({ className }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
        <path d="M3 5v14c0 1.66-4 3-9 3s9-1.34 9-3V5"></path>
    </svg>
)

export default Home;
