import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { 
    TrendingUp, 
    AlertTriangle, 
    Users, 
    Activity,
    Clock,
    MapPin,
    Brain,
    Camera,
    BarChart3,
    Layers
} from 'lucide-react';

// Chart components - we'll use recharts for visualizations
import {
    LineChart,
    Line,
    AreaChart,
    Area,
    ScatterChart,
    Scatter,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis
} from 'recharts';

// Socket.io for real-time updates
import { io } from 'socket.io-client';

const Analytics = () => {
    const [dashboardData, setDashboardData] = useState(null);
    const [behaviorPatterns, setBehaviorPatterns] = useState([]);
    const [temporalTrends, setTemporalTrends] = useState([]);
    const [anomalies, setAnomalies] = useState([]);
    const [predictions, setPredictions] = useState(null);
    const [visionAnalytics, setVisionAnalytics] = useState([]);
    const [occupancyData, setOccupancyData] = useState([]);
    const [clusteringData, setClusteringData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [realTimeAlerts, setRealTimeAlerts] = useState([]);
    const [isUsingDummyData, setIsUsingDummyData] = useState(false);
    const socketRef = useRef(null);

    // Dummy data for demonstration (REMOVE when backend is ready)
    // To disable dummy data: Remove getDummyData function and all catch blocks that use it
    const getDummyData = () => {
        const dummyDashboard = {
            totalAttendance: 1247,
            activeModels: 5,
            anomaliesDetected: 12,
            predictionsCount: 890
        };

        const dummyBehaviorPatterns = [
            { avgEntryTime: 8.2, attendanceRate: 95, count: 25, cluster: 'Early Birds' },
            { avgEntryTime: 9.1, attendanceRate: 88, count: 45, cluster: 'Regular' },
            { avgEntryTime: 9.8, attendanceRate: 76, count: 32, cluster: 'Late Comers' },
            { avgEntryTime: 8.0, attendanceRate: 98, count: 18, cluster: 'Punctual' },
            { avgEntryTime: 10.2, attendanceRate: 65, count: 15, cluster: 'Irregular' }
        ];

        const dummyTemporalTrends = [
            { timeSlot: '08:00', count: 45 },
            { timeSlot: '08:30', count: 87 },
            { timeSlot: '09:00', count: 123 },
            { timeSlot: '09:30', count: 98 },
            { timeSlot: '10:00', count: 67 },
            { timeSlot: '10:30', count: 43 },
            { timeSlot: '11:00', count: 32 },
            { timeSlot: '11:30', count: 28 }
        ];

        const dummyAnomalies = [
            {
                type: 'Late Entry Spike',
                description: 'Unusual increase in entries after 10 AM',
                severity: 'high',
                resolved: false,
                timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
            },
            {
                type: 'Missing Regular User',
                description: 'John Doe (usually arrives at 8:30) not detected',
                severity: 'medium',
                resolved: false,
                timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
            },
            {
                type: 'Multiple Rapid Attempts',
                description: 'User ID 1247 attempted entry 5 times in 30 seconds',
                severity: 'low',
                resolved: true,
                timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
            }
        ];

        const dummyPredictions = {
            nextWeekPrediction: '1,340',
            peakHour: '9:15 AM',
            riskScore: 23,
            predictionsCount: 890
        };

        const dummyVisionAnalytics = [
            { location: 'Main Gate', peopleCount: 45, confidenceScore: 94 },
            { location: 'Side Entrance', peopleCount: 12, confidenceScore: 87 },
            { location: 'Parking Area', peopleCount: 28, confidenceScore: 91 },
            { location: 'Building A', peopleCount: 67, confidenceScore: 96 }
        ];

        return {
            dashboard: dummyDashboard,
            behaviorPatterns: dummyBehaviorPatterns,
            temporalTrends: dummyTemporalTrends,
            anomalies: dummyAnomalies,
            predictions: dummyPredictions,
            visionAnalytics: dummyVisionAnalytics
        };
    };

    // Socket.io connection for real-time updates
    useEffect(() => {
        const token = localStorage.getItem('token');
        
        // Try to connect to real-time updates (will fail silently if backend not available)
        try {
            socketRef.current = io(import.meta.env.VITE_API_URL || 'http://localhost:5000', {
                auth: { token }
            });

            // Listen for real-time ML insights
            socketRef.current.on('ml-insight', (data) => {
                console.log('Real-time ML insight:', data);
                
                // Update relevant state based on insight type
                switch (data.type) {
                    case 'anomaly':
                        setRealTimeAlerts(prev => [{
                            id: Date.now(),
                            type: 'Anomaly Detected',
                            message: data.message,
                            severity: data.severity,
                            timestamp: new Date().toISOString()
                        }, ...prev.slice(0, 9)]); // Keep only 10 latest alerts
                        break;
                        
                    case 'behavior':
                        // Refresh behavior patterns in background
                        fetchBehaviorPatterns();
                        break;
                        
                    case 'prediction':
                        setRealTimeAlerts(prev => [{
                            id: Date.now(),
                            type: 'Prediction Alert',
                            message: data.message,
                            severity: 'info',
                            timestamp: new Date().toISOString()
                        }, ...prev.slice(0, 9)]);
                        break;
                }
            });
        } catch (error) {
            console.log('Real-time connection failed, using demo alerts');
            // Add some demo alerts for demonstration
            setRealTimeAlerts([
                {
                    id: 1,
                    type: 'Demo Alert',
                    message: 'Unusual attendance pattern detected in Building A',
                    severity: 'medium',
                    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString()
                },
                {
                    id: 2,
                    type: 'Prediction Alert',
                    message: 'Expected 15% increase in afternoon attendance',
                    severity: 'info',
                    timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString()
                }
            ]);
        }

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
        };
    }, []);

    // API call helper with authentication
    const apiCall = async (endpoint) => {
        const token = localStorage.getItem('token');
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/analytics${endpoint}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`API call failed: ${response.status}`);
        }
        
        return await response.json();
    };

    // Fetch analytics data
    const fetchDashboardData = async () => {
        try {
            const data = await apiCall('/dashboard');
            setDashboardData(data.data);
            setIsUsingDummyData(false);
        } catch (err) {
            console.log('Using dummy data (backend not available)');
            const dummyData = getDummyData();
            setDashboardData(dummyData.dashboard);
            setIsUsingDummyData(true);
        }
    };

    const fetchBehaviorPatterns = async () => {
        try {
            const data = await apiCall('/behavior-patterns');
            setBehaviorPatterns(data.data || []);
        } catch (err) {
            const dummyData = getDummyData();
            setBehaviorPatterns(dummyData.behaviorPatterns);
        }
    };

    const fetchTemporalTrends = async () => {
        try {
            const data = await apiCall('/temporal-trends');
            setTemporalTrends(data.data || []);
        } catch (err) {
            const dummyData = getDummyData();
            setTemporalTrends(dummyData.temporalTrends);
        }
    };

    const fetchAnomalies = async () => {
        try {
            const data = await apiCall('/anomalies');
            setAnomalies(data.data || []);
        } catch (err) {
            const dummyData = getDummyData();
            setAnomalies(dummyData.anomalies);
        }
    };

    const fetchPredictions = async () => {
        try {
            const data = await apiCall('/predictions');
            setPredictions(data.data);
        } catch (err) {
            const dummyData = getDummyData();
            setPredictions(dummyData.predictions);
        }
    };

    const fetchVisionAnalytics = async () => {
        try {
            const data = await apiCall('/vision-analytics');
            setVisionAnalytics(data.data || []);
        } catch (err) {
            const dummyData = getDummyData();
            setVisionAnalytics(dummyData.visionAnalytics);
        }
    };

    // Load all analytics data
    useEffect(() => {
        const loadAllData = async () => {
            setLoading(true);
            try {
                await Promise.all([
                    fetchDashboardData(),
                    fetchBehaviorPatterns(),
                    fetchTemporalTrends(),
                    fetchAnomalies(),
                    fetchPredictions(),
                    fetchVisionAnalytics()
                ]);
            } catch (err) {
                console.log('Some data loaded from dummy source');
            } finally {
                setLoading(false);
            }
        };

        // Add demo real-time alerts on load
        setRealTimeAlerts([
            {
                id: 1,
                type: 'Demo Alert',
                message: 'Unusual attendance pattern detected in Building A',
                severity: 'medium',
                timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString()
            },
            {
                id: 2,
                type: 'Prediction Alert',
                message: 'Expected 15% increase in afternoon attendance',
                severity: 'info',
                timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString()
            }
        ]);

        loadAllData();
    }, []);

    // Refresh data every 30 seconds (or simulate updates in demo mode)
    useEffect(() => {
        const interval = setInterval(() => {
            if (isUsingDummyData) {
                // In demo mode, simulate some data changes
                const dummyData = getDummyData();
                // Add some randomness to make it feel more dynamic
                dummyData.dashboard.totalAttendance += Math.floor(Math.random() * 5);
                setDashboardData(dummyData.dashboard);
            } else {
                // Real data refresh
                fetchDashboardData();
                fetchAnomalies();
            }
        }, 30000);

        return () => clearInterval(interval);
    }, [isUsingDummyData]);

    // Mock occupancy heatmap data (would come from API in real implementation)
    useEffect(() => {
        // Generate mock heatmap data based on current time
        const generateOccupancyData = () => {
            const hours = Array.from({ length: 24 }, (_, i) => i);
            const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            
            return days.map(day => 
                hours.map(hour => ({
                    day,
                    hour,
                    value: Math.random() * 100 // Mock occupancy percentage
                }))
            ).flat();
        };

        setOccupancyData(generateOccupancyData());
    }, []);

    // Loading state
    if (loading) {
        return (
            <div className="space-y-6 p-6">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">AI Analytics Dashboard</h1>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[...Array(8)].map((_, i) => (
                        <Card key={i}>
                            <CardContent className="p-6">
                                <Skeleton className="h-4 w-[250px]" />
                                <Skeleton className="h-4 w-[200px] mt-2" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    const getAnomalySeverityColor = (severity) => {
        switch (severity) {
            case 'high': return 'text-red-600 bg-red-100 dark:bg-red-900/20 dark:text-red-400';
            case 'medium': return 'text-orange-600 bg-orange-100 dark:bg-orange-900/20 dark:text-orange-400';
            default: return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400';
        }
    };

    return (
        <div className="space-y-6 p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">AI Analytics Dashboard</h1>
                    {isUsingDummyData && (
                        <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400">
                            Demo Mode
                        </Badge>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 ${isUsingDummyData ? 'bg-orange-500' : 'bg-green-500'} rounded-full animate-pulse`}></div>
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                            {isUsingDummyData ? 'Demo Analytics' : 'Real-time Analytics'}
                        </span>
                    </div>
                    <Button variant="outline" onClick={() => window.location.reload()}>
                        Refresh Data
                    </Button>
                </div>
            </div>
            
            {/* Real-time Alerts */}
            {realTimeAlerts.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Activity className="h-5 w-5" />
                            Real-time Alerts
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {realTimeAlerts.slice(0, 3).map((alert) => (
                                <div key={alert.id} className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                    <div>
                                        <p className="font-medium text-blue-900 dark:text-blue-100">{alert.type}</p>
                                        <p className="text-sm text-blue-700 dark:text-blue-300">{alert.message}</p>
                                    </div>
                                    <span className="text-xs text-blue-600 dark:text-blue-400">
                                        {new Date(alert.timestamp).toLocaleTimeString()}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Summary Cards */}
            {dashboardData && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Attendance</p>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                        {dashboardData.totalAttendance || 0}
                                    </p>
                                </div>
                                <Users className="h-8 w-8 text-blue-600" />
                            </div>
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Active Anomalies</p>
                                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                                        {anomalies.filter(a => a.resolved === false).length}
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
                                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">ML Models Active</p>
                                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                                        {dashboardData.activeModels || 5}
                                    </p>
                                </div>
                                <Brain className="h-8 w-8 text-green-600" />
                            </div>
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Predictions Made</p>
                                    <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                                        {predictions?.predictionsCount || 0}
                                    </p>
                                </div>
                                <TrendingUp className="h-8 w-8 text-purple-600" />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Temporal Trends */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Clock className="h-5 w-5" />
                            Temporal Attendance Trends
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={temporalTrends}>
                                <defs>
                                    <linearGradient id="colorAttendance" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="timeSlot" />
                                <YAxis />
                                <Tooltip />
                                <Area 
                                    type="monotone" 
                                    dataKey="count" 
                                    stroke="#3B82F6" 
                                    fillOpacity={1} 
                                    fill="url(#colorAttendance)" 
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Behavior Patterns */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            Behavior Pattern Clusters
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <ScatterChart data={behaviorPatterns}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="avgEntryTime" name="Avg Entry Time" />
                                <YAxis dataKey="attendanceRate" name="Attendance Rate" />
                                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                                <Scatter name="Users" dataKey="count" fill="#8B5CF6" />
                            </ScatterChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Anomaly Timeline */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5" />
                            Recent Anomalies
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {anomalies.slice(0, 5).map((anomaly, index) => (
                                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                                    <div>
                                        <p className="font-medium">{anomaly.type}</p>
                                        <p className="text-sm text-gray-600 dark:text-gray-300">{anomaly.description}</p>
                                    </div>
                                    <div className="text-right">
                                        <Badge className={getAnomalySeverityColor(anomaly.severity)}>
                                            {anomaly.severity}
                                        </Badge>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {new Date(anomaly.timestamp).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Vision Analytics */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Camera className="h-5 w-5" />
                            Computer Vision Analytics
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={visionAnalytics}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="location" />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="peopleCount" fill="#10B981" name="People Count" />
                                <Bar dataKey="confidenceScore" fill="#F59E0B" name="Confidence Score" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Predictions Summary */}
            {predictions && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5" />
                            Predictive Analytics Summary
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                    {predictions.nextWeekPrediction || 'N/A'}
                                </p>
                                <p className="text-sm text-gray-600 dark:text-gray-300">Next Week Attendance</p>
                            </div>
                            <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                                    {predictions.peakHour || 'N/A'}
                                </p>
                                <p className="text-sm text-gray-600 dark:text-gray-300">Peak Hour Today</p>
                            </div>
                            <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                                    {predictions.riskScore || 'N/A'}%
                                </p>
                                <p className="text-sm text-gray-600 dark:text-gray-300">Risk Score</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Occupancy Heatmap */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <MapPin className="h-5 w-5" />
                        Occupancy Heatmap (Weekly Pattern)
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                        Real-time occupancy visualization shows attendance patterns across days and hours
                    </div>
                    {/* Note: This would be implemented with a proper heatmap library like react-calendar-heatmap */}
                    <div className="grid grid-cols-7 gap-2">
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                            <div key={day} className="text-center">
                                <div className="text-xs font-medium mb-2">{day}</div>
                                <div className="space-y-1">
                                    {Array.from({ length: 8 }, (_, i) => (
                                        <div 
                                            key={i} 
                                            className={`h-4 w-full rounded ${i < 5 ? 'bg-blue-200 dark:bg-blue-800' : 'bg-gray-100 dark:bg-gray-800'}`}
                                            title={`${day} ${i + 9}:00 - ${Math.random() * 100}% occupancy`}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Demo Mode Notice */}
            {isUsingDummyData && (
                <Card className="border-orange-200 bg-orange-50 dark:bg-orange-900/10 dark:border-orange-800">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-orange-800 dark:text-orange-400">
                            <Brain className="h-5 w-5" />
                            Demo Mode Active
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-orange-700 dark:text-orange-300 mb-2">
                            Currently displaying demonstration data. All charts, analytics, and insights shown are simulated examples of the AI/ML capabilities.
                        </p>
                        <p className="text-sm text-orange-600 dark:text-orange-400">
                            <strong>To enable real data:</strong> Start the backend server and refresh the page. The system will automatically switch to live analytics.
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default Analytics;