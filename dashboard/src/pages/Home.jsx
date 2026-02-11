import React, { useState, useEffect } from 'react';
import { Users, Activity, UserCheck, AlertTriangle, Clock, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const StatCard = ({ title, value, icon: Icon, trend, trendUp, color = "default" }) => (
  <div className="p-6 rounded-xl border bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow">
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      <Icon className={`h-4 w-4 ${color === 'green' ? 'text-green-500' : color === 'blue' ? 'text-blue-500' : color === 'orange' ? 'text-orange-500' : 'text-muted-foreground'}`} />
    </div>
    <div className="flex items-end justify-between">
      <p className="text-3xl font-bold">{value}</p>
      {trend && (
        <div className={`flex items-center text-xs font-medium px-2 py-1 rounded-full ${
          trendUp ? 'text-green-600 bg-green-50 dark:bg-green-500/10' : 'text-red-600 bg-red-50 dark:bg-red-500/10'
        }`}>
          {trend}
        </div>
      )}
    </div>
  </div>
);

const Home = () => {
  const [loading, setLoading] = useState(true);
  const [dashboardStats, setDashboardStats] = useState({
    totalStudents: 247,
    presentToday: 198,
    lateArrivals: 23,
    absentees: 26
  });

  const recentActivity = [
    { id: 1, student: 'John Doe', time: '08:15', status: 'entry', device: 'Main Gate' },
    { id: 2, student: 'Sarah Smith', time: '08:12', status: 'entry', device: 'Side Gate' },  
    { id: 3, student: 'Mike Johnson', time: '08:45', status: 'late entry', device: 'Main Gate' },
    { id: 4, student: 'Emma Wilson', time: '08:05', status: 'entry', device: 'Main Gate' },
    { id: 5, student: 'David Lee', time: '09:15', status: 'very late', device: 'Side Gate' },
    { id: 6, student: 'Lisa Chen', time: '08:20', status: 'entry', device: 'Main Gate' }
  ];

  useEffect(() => {
    // Simulate API loading
    setTimeout(() => setLoading(false), 1000);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin border-4 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Attendance Dashboard</h1>
        <p className="text-muted-foreground">Overview of today's attendance</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Total Students" 
          value={dashboardStats.totalStudents}
          icon={Users} 
          color="blue"
        />
        <StatCard 
          title="Present Today" 
          value={dashboardStats.presentToday}
          icon={UserCheck} 
          trend="+5%" 
          trendUp={true}
          color="green"
        />
        <StatCard 
          title="Late Arrivals" 
          value={dashboardStats.lateArrivals}
          icon={Clock} 
          trend="-2%" 
          trendUp={false}
          color="orange"
        />
        <StatCard 
          title="Absentees" 
          value={dashboardStats.absentees}
          icon={AlertTriangle} 
          trend="+1%" 
          trendUp={false}
          color="orange"
        />
      </div>
    </div>
  );
};

export default Home;
