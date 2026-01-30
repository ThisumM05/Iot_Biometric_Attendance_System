import React from 'react';
import { Users, Activity, UserCheck, AlertTriangle, TrendingUp, TrendingDown, Clock, MapPin } from 'lucide-react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

// Mock data for charts
const attendanceData = [
  { time: '08:00', attendance: 120 },
  { time: '09:00', attendance: 890 },
  { time: '10:00', attendance: 1200 },
  { time: '11:00', attendance: 1180 },
  { time: '12:00', attendance: 1250 },
  { time: '13:00', attendance: 1100 },
  { time: '14:00', attendance: 1150 },
  { time: '15:00', attendance: 1220 },
  { time: '16:00', attendance: 980 },
  { time: '17:00', attendance: 450 },
  { time: '18:00', attendance: 200 },
  { time: '19:00', attendance: 80 },
  { time: '20:00', attendance: 30 }
];

const peakTimesData = [
  ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
  [
    [0, 0, 1, 2, 3, 4, 4],
    [1, 2, 3, 4, 4, 3, 2],
    [2, 3, 4, 4, 3, 2, 1],
    [3, 4, 4, 3, 2, 1, 0],
    [4, 4, 3, 2, 1, 0, 0],
    [4, 3, 2, 1, 0, 0, 0]
  ]
];

const liveAttendance = [
  { id: '#STU-8821', name: 'Alex Thompson', lastEntry: '08:14 AM', lastExit: '', status: 'IN' },
  { id: '#STU-7752', name: 'Sarah Jenkins', lastEntry: '08:02 AM', lastExit: '05:45 PM', status: 'OUT' },
  { id: '#STU-1294', name: 'Michael Chen', lastEntry: '08:30 AM', lastExit: '', status: 'IN' },
];

const whatsAppAlerts = [
  { type: 'Sent', time: '10:24 AM', message: 'Alert sent to Alex T\'s parent: "Student entered school premises."', status: 'delivered' },
  { type: 'Delivered', time: '10:22 AM', message: 'Alert sent to Sarah P\'s parent: "Student exited school premises."', status: 'delivered' },
  { type: 'Failed', time: '10:20 AM', message: 'Connection error while messaging Michael C\'s parent. Retrying in 3 min...', status: 'failed' },
  { type: 'Sent', time: '09:45 AM', message: 'Morning Summary sent to Principal Office (1,200 | 300 present)', status: 'delivered' },
  { type: 'Delivered', time: '09:15 AM', message: 'Staff Entry alert: "Professor Susan arrived at Gate 2."', status: 'delivered' }
];

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

const PeakTimesHeatmap = () => (
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

const Home = () => {
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
          value="1,284"
          icon={Users}
          trend="+12%"
          trendUp={true}
          color="blue"
        />
        <StatCard
          title="Total Exits"
          value="1,102"
          icon={Activity}
          trend="+9%"
          trendUp={true}
          color="green"
        />
        <StatCard
          title="Current Occupancy"
          value="182"
          icon={UserCheck}
          trend="LIVE"
          trendUp={true}
          color="orange"
        />
        <StatCard
          title="Failed Scans"
          value="14"
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
            <PeakTimesHeatmap />
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
              {whatsAppAlerts.map((alert, index) => (
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
              ))}
            </div>
          </div>

          {/* Live Attendance Status */}
          <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Live Attendance Status</h3>
              <a href="/dashboard/attendance" className="text-sm text-primary hover:underline">View All Logs</a>
            </div>
            <div className="space-y-4">
              {liveAttendance.map((student, index) => (
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
              ))}
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
