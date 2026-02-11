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
        setRecentActivity(activityData.data);
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
    // Refresh data every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
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
            <div className="space-y-3">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>
                        {activity.student.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{activity.student}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {activity.time}
                        <MapPin className="h-3 w-3" />
                        {activity.device}
                      </div>
                    </div>
                  </div>
                  <Badge 
                    variant={activity.status.includes('late') ? 'destructive' : 'default'}
                    className="capitalize"
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
