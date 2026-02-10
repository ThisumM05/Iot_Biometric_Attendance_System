import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { 
    User, 
    TrendingUp, 
    TrendingDown, 
    Clock, 
    Calendar,
    AlertTriangle,
    CheckCircle,
    XCircle,
    BarChart3,
    Users as UsersIcon,
    ArrowLeft
} from 'lucide-react';
import {
    LineChart,
    Line,
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from 'recharts';

const Users = () => {
    const [selectedUser, setSelectedUser] = useState(null);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    // Dummy users data with AI/ML behavior analytics
    const getDummyUsers = () => {
        return [
            {
                id: 'U001',
                name: 'John Doe',
                email: 'john.doe@school.edu',
                fingerprintId: 'FP001',
                riskLevel: 'Low',
                behaviorCluster: 'Early Birds',
                averageArrival: '07:45',
                attendanceRate: 95,
                punctualityScore: 92,
                lastSeen: '2026-02-11T07:43:00Z',
                weeklyPattern: [
                    { day: 'Mon', arrival: '07:45', status: 'on-time' },
                    { day: 'Tue', arrival: '07:42', status: 'early' },
                    { day: 'Wed', arrival: '07:48', status: 'on-time' },
                    { day: 'Thu', arrival: '07:40', status: 'early' },
                    { day: 'Fri', arrival: '07:50', status: 'on-time' }
                ],
                monthlyAttendance: [
                    { month: 'Oct', present: 22, absent: 1 },
                    { month: 'Nov', present: 21, absent: 2 },
                    { month: 'Dec', present: 18, absent: 1 },
                    { month: 'Jan', present: 23, absent: 0 },
                    { month: 'Feb', present: 8, absent: 0 }
                ],
                behaviorInsights: [
                    'Consistently arrives early (7:40-7:50 AM)',
                    'Never missed a day this month',
                    'Strong punctuality pattern',
                    'Belongs to "Early Birds" cluster'
                ],
                anomalies: []
            },
            {
                id: 'U002',
                name: 'Sarah Smith',
                email: 'sarah.smith@school.edu',
                fingerprintId: 'FP002',
                riskLevel: 'Medium',
                behaviorCluster: 'Regular',
                averageArrival: '08:15',
                attendanceRate: 88,
                punctualityScore: 78,
                lastSeen: '2026-02-11T08:18:00Z',
                weeklyPattern: [
                    { day: 'Mon', arrival: '08:12', status: 'on-time' },
                    { day: 'Tue', arrival: '08:25', status: 'late' },
                    { day: 'Wed', arrival: '08:08', status: 'early' },
                    { day: 'Thu', arrival: '08:20', status: 'on-time' },
                    { day: 'Fri', arrival: '08:30', status: 'late' }
                ],
                monthlyAttendance: [
                    { month: 'Oct', present: 20, absent: 3 },
                    { month: 'Nov', present: 19, absent: 4 },
                    { month: 'Dec', present: 17, absent: 2 },
                    { month: 'Jan', present: 21, absent: 2 },
                    { month: 'Feb', present: 7, absent: 1 }
                ],
                behaviorInsights: [
                    'Regular attendance pattern',
                    'Occasionally late on Tuesdays and Fridays',
                    'Average arrival time: 8:15 AM',
                    'Improvement trend in punctuality'
                ],
                anomalies: [
                    { date: '2026-02-07', type: 'Late Arrival', description: 'Arrived 25 minutes late' }
                ]
            },
            {
                id: 'U003',
                name: 'Mike Johnson',
                email: 'mike.johnson@school.edu',
                fingerprintId: 'FP003',
                riskLevel: 'High',
                behaviorCluster: 'Frequently Late',
                averageArrival: '08:45',
                attendanceRate: 76,
                punctualityScore: 45,
                lastSeen: '2026-02-10T09:15:00Z',
                weeklyPattern: [
                    { day: 'Mon', arrival: '08:45', status: 'late' },
                    { day: 'Tue', arrival: '09:10', status: 'very-late' },
                    { day: 'Wed', arrival: '08:30', status: 'late' },
                    { day: 'Thu', arrival: '09:00', status: 'very-late' },
                    { day: 'Fri', arrival: 'absent', status: 'absent' }
                ],
                monthlyAttendance: [
                    { month: 'Oct', present: 18, absent: 5 },
                    { month: 'Nov', present: 16, absent: 7 },
                    { month: 'Dec', present: 14, absent: 5 },
                    { month: 'Jan', present: 17, absent: 6 },
                    { month: 'Feb', present: 6, absent: 2 }
                ],
                behaviorInsights: [
                    'Consistently late arrivals (30-60 minutes)',
                    'Frequent Friday absences',
                    'Declining attendance trend',
                    'Requires intervention'
                ],
                anomalies: [
                    { date: '2026-02-10', type: 'Extended Absence', description: 'No show for entire day' },
                    { date: '2026-02-08', type: 'Very Late', description: 'Arrived 90 minutes late' }
                ]
            },
            {
                id: 'U004',
                name: 'Emma Wilson',
                email: 'emma.wilson@school.edu',
                fingerprintId: 'FP004',
                riskLevel: 'Very Low',
                behaviorCluster: 'Punctual',
                averageArrival: '08:00',
                attendanceRate: 98,
                punctualityScore: 98,
                lastSeen: '2026-02-11T07:58:00Z',
                weeklyPattern: [
                    { day: 'Mon', arrival: '07:58', status: 'on-time' },
                    { day: 'Tue', arrival: '08:02', status: 'on-time' },
                    { day: 'Wed', arrival: '07:59', status: 'on-time' },
                    { day: 'Thu', arrival: '08:01', status: 'on-time' },
                    { day: 'Fri', arrival: '08:00', status: 'on-time' }
                ],
                monthlyAttendance: [
                    { month: 'Oct', present: 23, absent: 0 },
                    { month: 'Nov', present: 22, absent: 1 },
                    { month: 'Dec', present: 19, absent: 0 },
                    { month: 'Jan', present: 23, absent: 0 },
                    { month: 'Feb', present: 8, absent: 0 }
                ],
                behaviorInsights: [
                    'Exceptional punctuality (±2 minutes)',
                    'Perfect attendance this semester',
                    'Model student behavior pattern',
                    'Consistent 8:00 AM arrival'
                ],
                anomalies: []
            },
            {
                id: 'U005',
                name: 'David Lee',
                email: 'david.lee@school.edu',
                fingerprintId: 'FP005',
                riskLevel: 'Very High',
                behaviorCluster: 'Irregular',
                averageArrival: '09:30',
                attendanceRate: 62,
                punctualityScore: 25,
                lastSeen: '2026-02-09T10:45:00Z',
                weeklyPattern: [
                    { day: 'Mon', arrival: '09:30', status: 'very-late' },
                    { day: 'Tue', arrival: 'absent', status: 'absent' },
                    { day: 'Wed', arrival: '11:00', status: 'very-late' },
                    { day: 'Thu', arrival: '08:15', status: 'on-time' },
                    { day: 'Fri', arrival: 'absent', status: 'absent' }
                ],
                monthlyAttendance: [
                    { month: 'Oct', present: 14, absent: 9 },
                    { month: 'Nov', present: 12, absent: 11 },
                    { month: 'Dec', present: 11, absent: 8 },
                    { month: 'Jan', present: 15, absent: 8 },
                    { month: 'Feb', present: 5, absent: 3 }
                ],
                behaviorInsights: [
                    'Highly irregular attendance pattern',
                    'Extremely variable arrival times',
                    'Frequent multi-day absences',
                    'Urgent intervention required'
                ],
                anomalies: [
                    { date: '2026-02-09', type: 'No Show', description: 'Expected but did not arrive' },
                    { date: '2026-02-06', type: 'Erratic Pattern', description: 'Arrived 3 hours late' },
                    { date: '2026-02-04', type: 'Extended Absence', description: '3-day consecutive absence' }
                ]
            }
        ];
    };

    useEffect(() => {
        // Try to fetch from backend API, fallback to dummy data
        const fetchUsers = async () => {
            try {
                const response = await fetch('/api/analytics/users');
                if (response.ok) {
                    const result = await response.json();
                    setUsers(result.data);
                } else {
                    throw new Error('Backend not available');
                }
            } catch (error) {
                console.log('Backend not available, using demo data');
                // Fallback to demo data
                setUsers(getDummyUsers());
            }
            setLoading(false);
        };

        fetchUsers();
    }, []);

    const handleUserSelection = async (user) => {
        setLoading(true);
        try {
            const response = await fetch(`/api/analytics/users/${user.id}`);
            if (response.ok) {
                const result = await response.json();
                setSelectedUser(result.data);
            } else {
                throw new Error('Backend not available');
            }
        } catch (error) {
            console.log('Backend not available, using demo data');
            // Fallback to demo data - use the user from the list if it has full details
            const fullUserData = getDummyUsers().find(u => u.id === user.id) || user;
            setSelectedUser(fullUserData);
        }
        setLoading(false);
    };

    const getRiskBadgeColor = (risk) => {
        switch (risk) {
            case 'Very Low': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
            case 'Low': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
            case 'Medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
            case 'High': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400';
            case 'Very High': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
            default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'early':
            case 'on-time':
                return <CheckCircle className="h-4 w-4 text-green-500" />;
            case 'late':
                return <Clock className="h-4 w-4 text-orange-500" />;
            case 'very-late':
                return <AlertTriangle className="h-4 w-4 text-red-500" />;
            case 'absent':
                return <XCircle className="h-4 w-4 text-red-500" />;
            default:
                return null;
        }
    };

    if (loading) {
        return (
            <div className="space-y-6 p-6">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">User Management</h1>
                <Card>
                    <CardContent className="p-6">
                        <div className="text-center py-8">Loading users...</div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (selectedUser) {
        return (
            <div className="space-y-6 p-6">
                {/* User Detail Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button 
                            variant="outline" 
                            onClick={() => setSelectedUser(null)}
                            className="flex items-center gap-2"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Back to Users
                        </Button>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                            {selectedUser.name} - Behavior Analytics
                        </h1>
                    </div>
                    <Badge className={getRiskBadgeColor(selectedUser.riskLevel)}>
                        {selectedUser.riskLevel} Risk
                    </Badge>
                </div>

                {/* User Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Attendance Rate</p>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                        {selectedUser.attendanceRate}%
                                    </p>
                                </div>
                                <BarChart3 className="h-8 w-8 text-blue-600" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Punctuality Score</p>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                        {selectedUser.punctualityScore}%
                                    </p>
                                </div>
                                <Clock className="h-8 w-8 text-green-600" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Avg Arrival</p>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                        {selectedUser.averageArrival}
                                    </p>
                                </div>
                                <TrendingUp className="h-8 w-8 text-purple-600" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Behavior Cluster</p>
                                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                                        {selectedUser.behaviorCluster}
                                    </p>
                                </div>
                                <UsersIcon className="h-8 w-8 text-orange-600" />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Charts Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Weekly Pattern */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Weekly Attendance Pattern</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {selectedUser.weeklyPattern.map((day) => (
                                    <div key={day.day} className="flex items-center justify-between p-3 border rounded-lg">
                                        <div className="flex items-center gap-3">
                                            {getStatusIcon(day.status)}
                                            <span className="font-medium">{day.day}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className={`font-medium ${
                                                day.status === 'absent' ? 'text-red-600' :
                                                day.status === 'early' ? 'text-green-600' :
                                                day.status === 'on-time' ? 'text-blue-600' :
                                                'text-orange-600'
                                            }`}>
                                                {day.arrival === 'absent' ? 'Absent' : day.arrival}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Monthly Attendance Trend */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Monthly Attendance Trend</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={250}>
                                <BarChart data={selectedUser.monthlyAttendance}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="month" />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="present" fill="#10B981" name="Present" />
                                    <Bar dataKey="absent" fill="#EF4444" name="Absent" />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </div>

                {/* Behavior Insights & Anomalies */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* AI Behavior Insights */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <BarChart3 className="h-5 w-5" />
                                AI Behavior Insights
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {selectedUser.behaviorInsights.map((insight, index) => (
                                    <div key={index} className="flex items-start gap-3">
                                        <CheckCircle className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                                        <span className="text-sm text-gray-700 dark:text-gray-300">{insight}</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Recent Anomalies */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5" />
                                Recent Anomalies
                                <Badge className="ml-2 bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
                                    {selectedUser.anomalies.length}
                                </Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {selectedUser.anomalies.length > 0 ? (
                                <div className="space-y-3">
                                    {selectedUser.anomalies.map((anomaly, index) => (
                                        <div key={index} className="p-3 border-l-4 border-red-500 bg-red-50 dark:bg-red-900/10">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="font-medium text-red-800 dark:text-red-400">{anomaly.type}</p>
                                                    <p className="text-sm text-red-600 dark:text-red-300">{anomaly.description}</p>
                                                </div>
                                                <span className="text-xs text-red-500">
                                                    {new Date(anomaly.date).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center text-green-600 py-4">
                                    <CheckCircle className="h-8 w-8 mx-auto mb-2" />
                                    <p>No anomalies detected</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">User Behavior Analytics</h1>
                <div className="flex items-center gap-2">
                    <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                        {users.length} Students
                    </Badge>
                </div>
            </div>

            {/* Users Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Student Behavior Profile</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="grid grid-cols-6 gap-4 font-medium text-sm text-gray-600 dark:text-gray-300 border-b pb-2">
                            <span>Student</span>
                            <span>ID</span>
                            <span>Risk Level</span>
                            <span>Behavior Cluster</span>
                            <span>Attendance Rate</span>
                            <span>Actions</span>
                        </div>
                        
                        {users.map((user) => (
                            <div key={user.id} className="grid grid-cols-6 gap-4 items-center py-3 border-b hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                <div className="flex items-center gap-3">
                                    <User className="h-8 w-8 text-blue-500" />
                                    <div>
                                        <p className="font-medium text-gray-900 dark:text-white">{user.name}</p>
                                        <p className="text-sm text-gray-500">{user.email}</p>
                                    </div>
                                </div>
                                
                                <span className="text-sm font-mono">{user.id}</span>
                                
                                <Badge className={getRiskBadgeColor(user.riskLevel)}>
                                    {user.riskLevel}
                                </Badge>
                                
                                <span className="text-sm text-gray-700 dark:text-gray-300">
                                    {user.behaviorCluster}
                                </span>
                                
                                <div className="flex items-center gap-2">
                                    <div className="flex-1">
                                        <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                                            <div 
                                                className={`h-2 rounded-full ${
                                                    user.attendanceRate >= 90 ? 'bg-green-500' :
                                                    user.attendanceRate >= 75 ? 'bg-blue-500' :
                                                    user.attendanceRate >= 60 ? 'bg-yellow-500' :
                                                    'bg-red-500'
                                                }`}
                                                style={{ width: `${user.attendanceRate}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                    <span className="text-sm font-medium">{user.attendanceRate}%</span>
                                </div>
                                
                                <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => handleUserSelection(user)}
                                    className="flex items-center gap-1"
                                >
                                    <BarChart3 className="h-3 w-3" />
                                    View Analytics
                                </Button>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Summary Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">High Risk Students</p>
                                <p className="text-2xl font-bold text-red-600">
                                    {users.filter(u => ['High', 'Very High'].includes(u.riskLevel)).length}
                                </p>
                            </div>
                            <AlertTriangle className="h-8 w-8 text-red-600" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Average Attendance</p>
                                <p className="text-2xl font-bold text-blue-600">
                                    {Math.round(users.reduce((acc, u) => acc + u.attendanceRate, 0) / users.length)}%
                                </p>
                            </div>
                            <BarChart3 className="h-8 w-8 text-blue-600" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Punctual Students</p>
                                <p className="text-2xl font-bold text-green-600">
                                    {users.filter(u => u.punctualityScore >= 90).length}
                                </p>
                            </div>
                            <CheckCircle className="h-8 w-8 text-green-600" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Need Intervention</p>
                                <p className="text-2xl font-bold text-orange-600">
                                    {users.filter(u => u.anomalies.length > 0 || u.attendanceRate < 70).length}
                                </p>
                            </div>
                            <TrendingDown className="h-8 w-8 text-orange-600" />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default Users;