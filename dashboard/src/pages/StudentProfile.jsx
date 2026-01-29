import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Mail, Phone, MapPin, Calendar, Clock, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import NotifyParent from '@/components/NotifyParent';

// Mock student database
const studentsDatabase = {
  'STU-2023-001': {
    id: 'STU-2023-001',
    name: 'John Doe',
    class: '10-A',
    status: 'PRESENT',
    lastSeen: 'Today, 08:00 AM',
    attendanceRate: 98.2,
    daysPresent: '19/20',
    parentContact: '+1 234 567 890',
    email: 'john.doe@school.edu',
    biometricStatus: '2 Fingerprints Registered',
    address: '123 Main Street, City',
    avatar: '/placeholder-avatar.jpg',
    dateOfBirth: '2008-05-15',
    enrollmentDate: '2023-08-01',
    guardianName: 'Robert Doe',
    guardianRelation: 'Father',
    parentEmail: 'robert.doe@email.com'
  },
  'STU-2023-002': {
    id: 'STU-2023-002',
    name: 'Alice Smith',
    class: '10-A',
    status: 'LATE',
    lastSeen: 'Today, 08:45 AM',
    attendanceRate: 95.5,
    daysPresent: '19/20',
    parentContact: '+1 234 567 891',
    email: 'alice.smith@school.edu',
    biometricStatus: '2 Fingerprints Registered',
    address: '456 Oak Avenue, City',
    avatar: '/placeholder-avatar.jpg',
    dateOfBirth: '2008-03-22',
    enrollmentDate: '2023-08-01',
    guardianName: 'Mary Smith',
    guardianRelation: 'Mother',
    parentEmail: 'mary.smith@email.com'
  },
  'STU-2023-003': {
    id: 'STU-2023-003',
    name: 'Michael Jordan',
    class: '10-B',
    status: 'PRESENT',
    lastSeen: 'Today, 07:55 AM',
    attendanceRate: 97.8,
    daysPresent: '18/20',
    parentContact: '+1 234 567 892',
    email: 'michael.jordan@school.edu',
    biometricStatus: '2 Fingerprints Registered',
    address: '789 Pine Street, City',
    avatar: '/placeholder-avatar.jpg',
    dateOfBirth: '2008-07-10',
    enrollmentDate: '2023-08-01',
    guardianName: 'James Jordan',
    guardianRelation: 'Father',
    parentEmail: 'james.jordan@email.com'
  },
  'STU-2023-004': {
    id: 'STU-2023-004',
    name: 'Sarah Williams',
    class: '10-C',
    status: 'ABSENT',
    lastSeen: 'Yesterday, 04:30 PM',
    attendanceRate: 85.0,
    daysPresent: '17/20',
    parentContact: '+1 234 567 893',
    email: 'sarah.williams@school.edu',
    biometricStatus: '1 Fingerprint Registered',
    address: '321 Elm Street, City',
    avatar: '/placeholder-avatar.jpg',
    dateOfBirth: '2008-11-08',
    enrollmentDate: '2023-08-01',
    guardianName: 'Jennifer Williams',
    guardianRelation: 'Mother',
    parentEmail: 'jennifer.williams@email.com'
  },
  'STU-2023-005': {
    id: 'STU-2023-005',
    name: 'Robert Lee',
    class: '10-A',
    status: 'PRESENT',
    lastSeen: 'Today, 08:02 AM',
    attendanceRate: 99.1,
    daysPresent: '20/20',
    parentContact: '+1 234 567 894',
    email: 'robert.lee@school.edu',
    biometricStatus: '2 Fingerprints Registered',
    address: '654 Maple Drive, City',
    avatar: '/placeholder-avatar.jpg',
    dateOfBirth: '2008-01-30',
    enrollmentDate: '2023-08-01',
    guardianName: 'David Lee',
    guardianRelation: 'Father',
    parentEmail: 'david.lee@email.com'
  }
};

// Mock attendance records
const recentRecords = [
  { date: 'Oct 26, 08:00 AM', terminal: 'Terminal-A (Main Gate)', status: 'IN', type: 'entry' },
  { date: 'Oct 25, 03:30 PM', terminal: 'Terminal-B (Exit)', status: 'OUT', type: 'exit' },
  { date: 'Oct 25, 08:02 AM', terminal: 'Terminal-A (Main Gate)', status: 'IN', type: 'entry' },
  { date: 'Oct 24, 03:25 PM', terminal: 'Terminal-B (Exit)', status: 'OUT', type: 'exit' },
  { date: 'Oct 24, 07:58 AM', terminal: 'Terminal-A (Main Gate)', status: 'IN', type: 'entry' }
];

// Mock weekly trend data
const weeklyTrendData = [
  { day: 'MON', present: 100, absent: 0 },
  { day: 'TUE', present: 100, absent: 0 },
  { day: 'WED', present: 100, absent: 0 },
  { day: 'THU', present: 100, absent: 0 },
  { day: 'FRI', present: 100, absent: 0 },
  { day: 'SAT', present: 100, absent: 0 },
  { day: 'SUN', present: 0, absent: 100 }
];

const StudentProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [showNotifyModal, setShowNotifyModal] = useState(false);

  const handleEditProfile = () => {
    navigate(`/dashboard/students/${id}/edit`);
  };

  const handleNotifyParent = () => {
    setShowNotifyModal(true);
  };

  // Get student data based on ID from URL params
  const studentData = studentsDatabase[id];

  // If student not found, show error message
  if (!studentData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <h2 className="text-2xl font-bold text-muted-foreground">Student Not Found</h2>
        <p className="text-muted-foreground">The student with ID "{id}" could not be found.</p>
        <Button onClick={() => navigate('/dashboard/students')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Students
        </Button>
      </div>
    );
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PRESENT':
        return <Badge variant="default" className="font-medium bg-green-100 text-green-800 border-green-200">PRESENT</Badge>;
      case 'LATE':
        return <Badge variant="secondary" className="font-medium bg-yellow-100 text-yellow-800 border-yellow-200">LATE</Badge>;
      case 'ABSENT':
        return <Badge variant="destructive" className="font-medium">ABSENT</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/students')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Student Profile</h1>
            <p className="text-muted-foreground">Detailed information and attendance records</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            variant="outline"
            onClick={handleNotifyParent}
          >
            <Mail className="h-4 w-4 mr-2" />
            Notify Parent
          </Button>
          <Button onClick={handleEditProfile}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Profile
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b">
        <nav className="flex space-x-8">
          {['overview', 'reports'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2 px-1 border-b-2 font-medium text-sm capitalize transition-colors ${
                activeTab === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Student Search */}
      <div className="rounded-xl border bg-card p-6">
        <div className="mb-6">
          <h3 className="font-semibold mb-2">Find Student Profile</h3>
          <div className="relative max-w-md">
            <input
              type="text"
              placeholder="John Doe - STU-2023-001"
              className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              defaultValue={`${studentData.name} - ${studentData.id}`}
            />
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Student Information Card */}
        <div className="lg:col-span-1">
          <div className="rounded-xl border bg-card p-6 space-y-6">
            {/* Status Badge */}
            <div className="flex justify-between items-start">
              {getStatusBadge(studentData.status)}
              <span className="text-sm text-muted-foreground">Last Seen: {studentData.lastSeen}</span>
            </div>

            {/* Student Profile */}
            <div className="text-center space-y-4">
              <Avatar className="h-24 w-24 mx-auto border-4 border-primary/20">
                <AvatarImage src={studentData.avatar} />
                <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                  {studentData.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              
              <div>
                <h2 className="text-2xl font-bold">{studentData.name}</h2>
                <p className="text-muted-foreground">ID: {studentData.id} | Class: {studentData.class}</p>
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-3">
              <h3 className="font-semibold">PARENT CONTACT</h3>
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{studentData.parentContact}</span>
              </div>
            </div>

            {/* Biometric Status */}
            <div className="space-y-3">
              <h3 className="font-semibold">BIOMETRIC STATUS</h3>
              <div className="flex items-center gap-2 text-sm text-green-600">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span>{studentData.biometricStatus}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-4 border-t">
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={handleEditProfile}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Profile
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={handleNotifyParent}
              >
                <Mail className="h-4 w-4 mr-2" />
                Notify Parent
              </Button>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Attendance Rate and Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-xl border bg-card p-6">
              <h3 className="font-semibold mb-4">ATTEND. RATE</h3>
              <div className="text-center space-y-4">
                <div className="text-4xl font-bold text-primary">{studentData.attendanceRate}%</div>
                <Progress value={studentData.attendanceRate} className="w-full" />
                <p className="text-sm text-muted-foreground">Excellent attendance record</p>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-6">
              <h3 className="font-semibold mb-4">DAYS PRESENT</h3>
              <div className="text-center space-y-4">
                <div className="text-4xl font-bold">{studentData.daysPresent}</div>
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Current month</span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Records */}
          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold">Recent Records</h3>
              <Button variant="link" className="text-primary">View All</Button>
            </div>
            
            <div className="space-y-3">
              {recentRecords.map((record, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{record.date}</span>
                      <span className="text-xs text-muted-foreground">{record.terminal}</span>
                    </div>
                  </div>
                  <Badge 
                    variant={record.status === 'IN' ? 'default' : 'secondary'}
                    className="font-medium"
                  >
                    {record.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Weekly Attendance Trend */}
          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold">Weekly Attendance Trend</h3>
              <div className="flex items-center gap-4">
                <Button variant="outline" size="sm" className="bg-primary/10 text-primary border-primary/20">
                  Weekly
                </Button>
                <Button variant="ghost" size="sm">
                  Monthly
                </Button>
              </div>
            </div>
            
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyTrendData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis 
                    dataKey="day" 
                    className="text-xs"
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    className="text-xs"
                    axisLine={false}
                    tickLine={false}
                    domain={[0, 100]}
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
                    dataKey="present" 
                    stroke="hsl(var(--primary))" 
                    fill="hsl(var(--primary))" 
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Notify Parent Modal */}
      <NotifyParent 
        student={studentData}
        isOpen={showNotifyModal}
        onClose={() => setShowNotifyModal(false)}
      />
    </div>
  );
};

export default StudentProfile;