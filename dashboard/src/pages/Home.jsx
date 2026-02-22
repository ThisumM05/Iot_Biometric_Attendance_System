import React, { useState, useEffect } from 'react';
import { Users, Activity, UserCheck, AlertTriangle, Clock, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import io from 'socket.io-client';


const StatCard = ({ title, value, icon: Icon, trend, trendUp, color = "default" }) => (
  <div className="p-6 rounded-xl border bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow">
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      <Icon className={`h-4 w-4 ${color === 'green' ? 'text-green-500' : color === 'blue' ? 'text-blue-500' : color === 'orange' ? 'text-orange-500' : 'text-muted-foreground'}`} />
    </div>
    <div className="flex items-end justify-between">
      <p className="text-3xl font-bold">{value}</p>
      {trend && (
        <div className={`flex items-center text-xs font-medium px-2 py-1 rounded-full ${trendUp ? 'text-green-600 bg-green-50 dark:bg-green-500/10' : 'text-red-600 bg-red-50 dark:bg-red-500/10'
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
    totalStudents: 0,
    presentToday: 0,
    lateArrivals: 0,
    absentees: 0
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [error, setError] = useState(null);

  // Fetch dashboard data from API
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch statistics
      const statsResponse = await fetch('http://localhost:5000/api/dashboard/stats');
      if (!statsResponse.ok) {
        throw new Error(`Failed to fetch stats: ${statsResponse.status}`);
      }
      const statsData = await statsResponse.json();

      if (statsData.success) {
        setDashboardStats(statsData.data);
      }

      // Fetch recent activity
      const activityResponse = await fetch('http://localhost:5000/api/dashboard/recent-activity?limit=6');
      if (!activityResponse.ok) {
        throw new Error(`Failed to fetch activity: ${activityResponse.status}`);
      }
      const activityData = await activityResponse.json();

      if (activityData.success) {
        // Format initial data to ensure consistency
        const formatted = activityData.data.map(activity => ({
          ...activity,
          time: new Date(activity.timestamp).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          }),
          date: new Date(activity.timestamp).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          })
        }));
        setRecentActivity(formatted);
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError(error.message);
      // Keep dummy data as fallback
      setDashboardStats({
        totalStudents: 0,
        presentToday: 0,
        lateArrivals: 0,
        absentees: 0
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    // Connect to Socket.IO
    const socket = io('http://localhost:5000', {
      transports: ['websocket', 'polling'],
      path: '/socket.io/'
    });

    socket.on('attendance-update', (data) => {
      // Format new activity to match our structure
      const newActivity = {
        id: data._id,
        student: data.username || (data.user && data.user.username) || 'System User',
        time: new Date(data.timestamp).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }),
        date: new Date(data.timestamp).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }),
        status: (data.type || '').toLowerCase().replace('_', ' '),
        device: data.deviceId || data.scannerID || 'Unknown',
        timestamp: data.timestamp
      };

      setRecentActivity(prev => [newActivity, ...prev].slice(0, 10));

      // Update stats as well
      setDashboardStats(prev => ({
        ...prev,
        presentToday: prev.presentToday + 1
      }));
    });

    // Refresh data every 60 seconds (less frequent polling now that we have sockets)
    const interval = setInterval(fetchDashboardData, 60000);
    return () => {
      clearInterval(interval);
      socket.disconnect();
    };
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

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 font-medium mb-2">Failed to load dashboard data</p>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Retry
          </button>
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

      {/* Recent Activity */}
      {recentActivity.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center justify-between p-4 rounded-xl border bg-card/50 hover:bg-card transition-colors">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-10 w-10 border-2 border-primary/10">
                      <AvatarFallback className="bg-primary/5 text-primary">
                        {activity.student.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-1">
                      <p className="font-bold text-base leading-none">{activity.student}</p>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-blue-500" />
                          <span className="font-medium text-slate-700 dark:text-slate-300">{activity.time}</span>
                        </div>
                        <span className="text-slate-300 dark:text-slate-700">•</span>
                        <div className="flex items-center gap-1.5 font-medium">
                          <span className="text-slate-500">{activity.date || new Date(activity.timestamp).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-bold text-slate-400">
                        <MapPin className="h-3 w-3" />
                        <span>NODE: {activity.device}</span>
                      </div>
                    </div>
                  </div>
                  <Badge
                    variant={activity.status.includes('late') ? 'destructive' : 'default'}
                    className={`px-3 py-1 rounded-full font-bold text-[10px] uppercase tracking-wide ${activity.status.includes('check in') ? 'bg-blue-500 hover:bg-blue-600' :
                      activity.status.includes('check out') ? 'bg-slate-500 hover:bg-slate-600' : ''
                      }`}
                  >
                    {activity.status}
                  </Badge>
                </div>
              ))}
            </div>

          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Home;
