import React, { useState, useEffect } from 'react';
import { Users, Activity, UserCheck, AlertTriangle, TrendingUp, TrendingDown, Clock, MapPin } from 'lucide-react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

// Attendance data will be fetched from database
// Currently empty until database connection is established

// Peak times data will be fetched from database

// Live attendance data will be fetched from database

// WhatsApp alerts data will be fetched from database

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
          {trendUp ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
          {trend}
        </div>
      )}
    </div>
  </div>
);

const PeakTimesHeatmap = ({ peakTimesData }) => {
  // Show empty state if no data
  if (!peakTimesData || !peakTimesData[0] || !peakTimesData[1]) {
    return (
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground mb-2">
          <span>Low</span>
          <span>High</span>
        </div>
        <div className="text-center py-8 text-muted-foreground">
          <p>No peak times data available</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-muted-foreground mb-2">
        <span>Low</span>
        <span>High</span>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {peakTimesData[0].map((day, dayIndex) => (
          <div key={dayIndex} className="text-center">
            <div className="text-xs font-medium text-muted-foreground mb-1">{day}</div>
            <div className="space-y-1">
              {peakTimesData[1].map((row, rowIndex) => {
                const intensity = row[dayIndex];
                return (
                  <div
                    key={rowIndex}
                    className={`h-3 w-full rounded-sm ${
                      intensity === 0 ? 'bg-muted' :
                      intensity === 1 ? 'bg-blue-200 dark:bg-blue-900' :
                      intensity === 2 ? 'bg-blue-300 dark:bg-blue-800' :
                      intensity === 3 ? 'bg-blue-400 dark:bg-blue-700' :
                      intensity === 4 ? 'bg-blue-500 dark:bg-blue-600' : 'bg-blue-600'
                    }`}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const Home = () => {
  const [attendanceData, setAttendanceData] = useState([]);
  const [peakTimesData, setPeakTimesData] = useState([]);
  const [liveAttendance, setLiveAttendance] = useState([]);
  const [whatsAppAlerts, setWhatsAppAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dashboardStats, setDashboardStats] = useState({
    totalEntries: 0,
    totalExits: 0,
    currentlyInside: 0,
    alertsPending: 0
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Real-time biometric sync data for student entries and exits.</p>
        </div>
        <div className="text-sm text-muted-foreground">
          Last synced: Just now
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Entries"
          value={dashboardStats.totalEntries}
          icon={Users}
          trend="+12%"
          trendUp={true}
          color="blue"
        />
        <StatCard
          title="Total Exits"
          value={dashboardStats.totalExits}
          icon={Activity}
          trend="+9%"
          trendUp={true}
          color="green"
        />
        <StatCard
          title="Current Occupancy"
          value={dashboardStats.currentlyInside}
          icon={UserCheck}
          trend="LIVE"
          trendUp={true}
          color="orange"
        />
        <StatCard
          title="Failed Scans"
          value={dashboardStats.alertsPending}
          icon={AlertTriangle}
          trend="-3%"
          trendUp={false}
        />
      </div>

      {/* Charts and Live Data */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Attendance Trends Chart */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-lg">Attendance Trends</h3>
              <div className="text-xs text-muted-foreground">Last 24 Hours</div>
            </div>
            <div className="h-[280px]">
              {attendanceData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={attendanceData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis 
                      dataKey="time" 
                      className="text-xs"
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis 
                      className="text-xs"
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="attendance" 
                      stroke="hsl(var(--primary))" 
                      fill="hsl(var(--primary))" 
                      fillOpacity={0.2}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <p>No attendance data available</p>
                </div>
              )}
            </div>
          </div>

          {/* Peak Times Heatmap */}
          <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-lg">Peak Times Heatmap</h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Low</span>
                <div className="flex gap-1">
                  <div className="w-3 h-3 bg-muted rounded-sm"></div>
                  <div className="w-3 h-3 bg-blue-200 dark:bg-blue-900 rounded-sm"></div>
                  <div className="w-3 h-3 bg-blue-400 dark:bg-blue-700 rounded-sm"></div>
                  <div className="w-3 h-3 bg-blue-600 rounded-sm"></div>
                </div>
                <span>High</span>
              </div>
            </div>
            <PeakTimesHeatmap peakTimesData={peakTimesData} />
          </div>
        </div>

        {/* Right Panel */}
        <div className="space-y-6">
          {/* WhatsApp Alerts */}
          <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">WhatsApp Alerts</h3>
              <div className="px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
                <span className="text-xs font-medium text-green-600 dark:text-green-400">WHATSAPP API SETTINGS</span>
              </div>
            </div>
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {whatsAppAlerts.length > 0 ? (
                whatsAppAlerts.map((alert, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                      alert.status === 'delivered' ? 'bg-green-500' :
                      alert.status === 'failed' ? 'bg-red-500' : 'bg-yellow-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={alert.type === 'Failed' ? 'destructive' : alert.type === 'Delivered' ? 'success' : 'default'} className="text-xs">
                          {alert.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{alert.time}</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{alert.message}</p>
                  </div>
                </div>
              ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No WhatsApp alerts available</p>
                </div>
              )}
            </div>
          </div>

          {/* Live Attendance Status */}
          <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Live Attendance Status</h3>
              <a href="/dashboard/attendance" className="text-sm text-primary hover:underline">View All Logs</a>
            </div>
            <div className="space-y-4">
              {liveAttendance.length > 0 ? (
                liveAttendance.map((student, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={`/placeholder-student-${index + 1}.jpg`} />
                      <AvatarFallback className="text-xs">{student.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium truncate">{student.name}</p>
                        <Badge variant={student.status === 'IN' ? 'default' : 'secondary'} className="text-xs">
                          {student.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{student.id}</span>
                        <span>Last Entry: {student.lastEntry}</span>
                        {student.lastExit && <span>Last Exit: {student.lastExit}</span>}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No live attendance data available</p>
                </div>
              )}
            </div>
            <div className="mt-4 pt-4 border-t text-center">
              <p className="text-xs text-muted-foreground">Displaying results for all classrooms</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
