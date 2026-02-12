import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const Analytics = () => {
    const [analyticsData, setAnalyticsData] = useState({
        userMetrics: [],
        trends: [],
        peakHours: [],
        departmentSummary: {},
        heatmapData: []
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    console.log('🔍 Analytics component rendered');

    const fetchAnalytics = async () => {
        try {
            setLoading(true);
            setError(null);

            console.log('🔍 Fetching analytics data...');
            
            const summaryRes = await fetch('http://localhost:5000/api/analytics/summary?days=60');
            const summaryData = await summaryRes.json();

            console.log('📊 Summary data received:', summaryData);
            
            if (!summaryData.success) {
                throw new Error('Failed to fetch analytics data');
            }

            // Fetch heat map data
            const heatmapRes = await fetch('http://localhost:5000/api/analytics/heatmap?days=60');
            const heatmapData = await heatmapRes.json();
            console.log('🗺️ Heat map data received:', heatmapData);

            setAnalyticsData({
                userMetrics: summaryData.data,
                trends: [],
                peakHours: [],
                departmentSummary: {},
                heatmapData: heatmapData.success ? heatmapData.data : [],
                heatmapStats: heatmapData.success ? heatmapData.stats : null,
                analysisPeriod: summaryData.analysis_period
            });
            
        } catch (error) {
            console.error('❌ Error fetching analytics:', error);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        console.log('🚀 useEffect triggered - fetching analytics');
        fetchAnalytics();
    }, []);

    console.log('📈 Current state:', { loading, error, dataLength: analyticsData.userMetrics.length });

    if (loading) {
        return (
            <div className="p-6 space-y-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
                    <p className="text-muted-foreground">Loading behavior pattern analysis...</p>
                </div>
                <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                        <p>Analyzing behavior patterns...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 space-y-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
                    <p className="text-muted-foreground">Error loading analytics</p>
                </div>
                <Alert>
                    <AlertDescription>
                        <strong>Analytics Error:</strong> {error}
                        <div className="mt-2">
                            <Button onClick={fetchAnalytics} size="sm" variant="outline">
                                Retry Analysis
                            </Button>
                        </div>
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
                <p className="text-muted-foreground">Comprehensive behavior pattern analysis</p>
                <p className="text-xs text-muted-foreground mt-1">
                    Analyzing {analyticsData.userMetrics.length} students
                </p>
            </div>

            {/* Aggregate Metrics */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Total Students</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{analyticsData.userMetrics.length}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Total On-Time</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            {analyticsData.userMetrics.reduce((sum, user) => sum + user.on_time_arrivals, 0)}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Total Late</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-600">
                            {analyticsData.userMetrics.reduce((sum, user) => sum + user.late_arrivals, 0)}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Average Punctuality</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {analyticsData.userMetrics.length > 0 
                                ? Math.round(analyticsData.userMetrics.reduce((sum, user) => sum + user.punctuality_score, 0) / analyticsData.userMetrics.length)
                                : 0}%
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Attendance Heat Map */}
            <Card>
                <CardHeader>
                    <CardTitle>Attendance Heat Map - Peak Times</CardTitle>
                    <CardDescription>
                        Attendance patterns by day of week and hour of day
                        {analyticsData.heatmapStats && ` • ${analyticsData.heatmapStats.total_records} total check-ins analyzed`}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        {analyticsData.heatmapData && analyticsData.heatmapData.length > 0 ? (
                            <div>
                                {/* Heat Map Grid */}
                                <div className="inline-block min-w-full">
                                    {/* Hour labels (top) */}
                                    <div className="flex mb-1">
                                        <div className="w-24 flex-shrink-0"></div>
                                        {Array.from({ length: 24 }, (_, hour) => (
                                            <div 
                                                key={hour}
                                                className="w-8 h-8 flex items-center justify-center text-xs text-muted-foreground"
                                            >
                                                {hour < 6 || hour >= 22 ? '' : hour}
                                            </div>
                                        ))}
                                    </div>
                                    
                                    {/* Heat map rows */}
                                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((dayName, dayIdx) => {
                                        const dayIndex = dayName === 'Sunday' ? 0 : 
                                                        dayName === 'Monday' ? 1 : 
                                                        dayName === 'Tuesday' ? 2 : 
                                                        dayName === 'Wednesday' ? 3 : 
                                                        dayName === 'Thursday' ? 4 : 
                                                        dayName === 'Friday' ? 5 : 6;
                                        
                                        return (
                                            <div key={dayName} className="flex items-center mb-1">
                                                {/* Day label */}
                                                <div className="w-24 flex-shrink-0 text-sm font-medium">{dayName}</div>
                                                
                                                {/* Hour cells */}
                                                {Array.from({ length: 24 }, (_, hour) => {
                                                    const dataPoint = analyticsData.heatmapData.find(
                                                        d => d.dayIndex === dayIndex && d.hour === hour
                                                    );
                                                    const count = dataPoint?.count || 0;
                                                    const intensity = dataPoint?.intensity || 0;
                                                    
                                                    // Color gradient from blue (low) to red (high)
                                                    const getColor = (intensity) => {
                                                        if (intensity === 0) return 'bg-gray-100';
                                                        if (intensity < 20) return 'bg-blue-200';
                                                        if (intensity < 40) return 'bg-green-300';
                                                        if (intensity < 60) return 'bg-yellow-400';
                                                        if (intensity < 80) return 'bg-orange-500';
                                                        return 'bg-red-600';
                                                    };
                                                    
                                                    return (
                                                        <div
                                                            key={hour}
                                                            className={`w-8 h-8 border border-gray-200 ${getColor(intensity)} hover:ring-2 hover:ring-blue-500 cursor-pointer transition-all relative group`}
                                                            title={`${dayName} ${hour}:00 - ${count} check-ins`}
                                                        >
                                                            {/* Tooltip on hover */}
                                                            <div className="hidden group-hover:block absolute z-10 bg-black text-white text-xs rounded px-2 py-1 -top-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                                                                {count} check-ins
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })}
                                    
                                    {/* Legend */}
                                    <div className="mt-4 flex items-center gap-4 text-sm">
                                        <span className="font-medium">Attendance Intensity:</span>
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 bg-gray-100 border border-gray-200"></div>
                                            <span className="text-xs">None</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 bg-blue-200"></div>
                                            <span className="text-xs">Low</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 bg-green-300"></div>
                                            <span className="text-xs">Moderate</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 bg-yellow-400"></div>
                                            <span className="text-xs">High</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 bg-orange-500"></div>
                                            <span className="text-xs">Very High</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 bg-red-600"></div>
                                            <span className="text-xs">Peak</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-8 text-muted-foreground">
                                No heat map data available
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Charts */}
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Punctuality Distribution */}
                <Card>
                    <CardHeader>
                        <CardTitle>Overall Punctuality Distribution</CardTitle>
                        <CardDescription>Total on-time vs late arrivals across all students</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={[
                                            {
                                                name: 'On-Time',
                                                value: analyticsData.userMetrics.reduce((sum, user) => sum + user.on_time_arrivals, 0),
                                                fill: '#10b981'
                                            },
                                            {
                                                name: 'Late',
                                                value: analyticsData.userMetrics.reduce((sum, user) => sum + user.late_arrivals, 0),
                                                fill: '#f59e0b'
                                            }
                                        ]}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={({name, percent}) => `${name} ${(percent * 100).toFixed(1)}%`}
                                        outerRadius={80}
                                        fill="#8884d8"
                                        dataKey="value"
                                    />
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Punctuality Score Categories */}
                <Card>
                    <CardHeader>
                        <CardTitle>Student Performance Categories</CardTitle>
                        <CardDescription>Distribution of students by punctuality scores</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={[
                                    {
                                        range: 'Excellent (90-100%)',
                                        count: analyticsData.userMetrics.filter(user => user.punctuality_score >= 90).length,
                                        fill: '#22c55e'
                                    },
                                    {
                                        range: 'Good (80-89%)',
                                        count: analyticsData.userMetrics.filter(user => user.punctuality_score >= 80 && user.punctuality_score < 90).length,
                                        fill: '#3b82f6'
                                    },
                                    {
                                        range: 'Average (70-79%)',
                                        count: analyticsData.userMetrics.filter(user => user.punctuality_score >= 70 && user.punctuality_score < 80).length,
                                        fill: '#f59e0b'
                                    },
                                    {
                                        range: 'Poor (<70%)',
                                        count: analyticsData.userMetrics.filter(user => user.punctuality_score < 70).length,
                                        fill: '#ef4444'
                                    }
                                ]}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis 
                                        dataKey="range" 
                                        angle={-45}
                                        textAnchor="end"
                                        height={100}
                                        fontSize={12}
                                    />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="count" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Individual User Punctuality Bars */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Student Punctuality Overview</CardTitle>
                        <CardDescription>Punctuality scores for all students</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={analyticsData.userMetrics.map(user => ({
                                    name: user.username,
                                    score: user.punctuality_score,
                                    fill: user.punctuality_score >= 80 ? '#22c55e' : user.punctuality_score >= 60 ? '#f59e0b' : '#ef4444'
                                }))}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis 
                                        dataKey="name" 
                                        angle={-45}
                                        textAnchor="end"
                                        height={100}
                                        fontSize={12}
                                    />
                                    <YAxis domain={[0, 100]} />
                                    <Tooltip formatter={(value) => [`${value}%`, 'Punctuality Score']} />
                                    <Bar dataKey="score" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Summary Statistics */}
            <Card>
                <CardHeader>
                    <CardTitle>Performance Summary</CardTitle>
                    <CardDescription>Key insights from behavior analysis</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="text-center p-4 border rounded">
                            <div className="text-2xl font-bold text-green-600">
                                {analyticsData.userMetrics.filter(user => user.punctuality_score >= 80).length}
                            </div>
                            <p className="text-sm text-muted-foreground">High Performers (≥80%)</p>
                        </div>
                        <div className="text-center p-4 border rounded">
                            <div className="text-2xl font-bold text-blue-600">
                                {analyticsData.userMetrics.reduce((sum, user) => sum + user.total_days, 0)}
                            </div>
                            <p className="text-sm text-muted-foreground">Total Attendance Days</p>
                        </div>
                        <div className="text-center p-4 border rounded">
                            <div className="text-2xl font-bold">
                                {analyticsData.userMetrics.length > 0 
                                    ? (analyticsData.userMetrics.reduce((sum, user) => sum + user.avg_checkin_time, 0) / analyticsData.userMetrics.length).toFixed(1)
                                    : 0}
                            </div>
                            <p className="text-sm text-muted-foreground">Average Check-in Time</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default Analytics;