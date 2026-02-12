import { useState, useEffect } from 'react';
import { 
    ScatterChart, 
    Scatter, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    Legend, 
    ResponsiveContainer,
    Cell 
} from 'recharts';
import { Users, Clock, TrendingUp, AlertCircle, Info, Filter } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

const AttendanceClustersChart = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [dateRange, setDateRange] = useState({
        startDate: '',
        endDate: ''
    });
    const [showFilters, setShowFilters] = useState(false);

    // Color palette for different clusters (using system colors)
    const clusterColors = [
        'hsl(var(--primary))',      // Primary brand color
        'hsl(142, 76%, 36%)',       // Green (success)
        'hsl(24, 95%, 53%)',        // Orange (warning)
        'hsl(0, 84%, 60%)',         // Red (danger)
        'hsl(199, 89%, 48%)',       // Blue (info)
        'hsl(280, 65%, 60%)',       // Purple
        'hsl(142, 52%, 60%)',       // Light Green
        'hsl(24, 70%, 65%)'         // Light Orange
    ];

    // Fetch clustering data from API
    const fetchClusterData = async (filters = {}) => {
        try {
            setLoading(true);
            setError(null);

            let url = '/api/attendance/clusters';
            const params = new URLSearchParams();
            
            if (filters.startDate) params.append('startDate', filters.startDate);
            if (filters.endDate) params.append('endDate', filters.endDate);
            
            if (params.toString()) {
                url += `?${params.toString()}`;
            }

            console.log('Fetching cluster data from:', url);
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            
            if (result.success) {
                setData(result.data);
                console.log('Clustering data loaded:', result.data.summary);
            } else {
                throw new Error(result.message || 'Failed to fetch clustering data');
            }
        } catch (err) {
            console.error('Clustering data fetch error:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Initial data load
    useEffect(() => {
        fetchClusterData();
    }, []);

    // Handle filter application
    const applyFilters = () => {
        fetchClusterData(dateRange);
    };

    // Clear filters
    const clearFilters = () => {
        setDateRange({ startDate: '', endDate: '' });
        fetchClusterData();
    };

    // Prepare scatter plot data
    const prepareScatterData = () => {
        if (!data || !data.clusters) return [];

        const scatterData = [];
        data.clusters.forEach((cluster, clusterIndex) => {
            cluster.members.forEach(member => {
                // Convert arrival time from minutes to hours for better readability
                const arrivalTimeHours = member.features.average_arrival_time / 60;
                
                scatterData.push({
                    name: member.user_name,
                    userId: member.user_id,
                    x: arrivalTimeHours,
                    y: member.features.late_percentage,
                    cluster: cluster.cluster_id,
                    clusterType: cluster.behavior_type,
                    color: clusterColors[clusterIndex % clusterColors.length],
                    absencePercentage: member.features.absence_percentage,
                    consistency: member.features.attendance_consistency,
                    attendanceCount: member.attendance_count
                });
            });
        });

        return scatterData;
    };

    // Format time for display
    const formatTime = (hours) => {
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return `${h}:${m.toString().padStart(2, '0')}`;
    };

    // Custom tooltip for scatter plot
    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length > 0) {
            const data = payload[0].payload;
            return (
                <div className="bg-card border shadow-lg rounded-lg p-3">
                    <p className="font-semibold">{data.name}</p>
                    <p className="text-sm text-muted-foreground">Cluster: {data.clusterType}</p>
                    <hr className="my-2 border-border" />
                    <p className="text-sm">Avg Arrival: {formatTime(data.x)}</p>
                    <p className="text-sm">Late Rate: {data.y.toFixed(1)}%</p>
                    <p className="text-sm">Absence Rate: {data.absencePercentage.toFixed(1)}%</p>
                    <p className="text-sm">Consistency: {data.consistency.toFixed(1)} min</p>
                    <p className="text-sm">Records: {data.attendanceCount}</p>
                </div>
            );
        }
        return null;
    };

    if (loading) {
        return (
            <div className="space-y-6 p-6">
                <div className="animate-pulse">
                    <div className="h-8 bg-muted rounded mb-4"></div>
                    <div className="h-96 bg-muted/50 rounded mb-6"></div>
                    <div className="space-y-3">
                        <div className="h-4 bg-muted rounded"></div>
                        <div className="h-4 bg-muted rounded w-3/4"></div>
                        <div className="h-4 bg-muted rounded w-1/2"></div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6">
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                        <div className="font-semibold mb-2">Clustering Analysis Failed</div>
                        <div className="text-sm">{error}</div>
                        <Button 
                            onClick={() => fetchClusterData()} 
                            className="mt-3 text-sm"
                            variant="outline"
                        >
                            Try Again
                        </Button>
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    if (!data || !data.clusters || data.clusters.length === 0) {
        return (
            <div className="p-6">
                <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                        <div className="font-semibold mb-2">No Clustering Data Available</div>
                        <div className="text-sm">
                            No attendance patterns found for clustering analysis. Users need sufficient attendance records to generate meaningful clusters.
                        </div>
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    const scatterData = prepareScatterData();

    return (
        <div className="space-y-6 p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold">Attendance Behavior Clustering</h2>
                    <p className="text-muted-foreground text-sm mt-1">
                        AI-powered analysis grouping users by attendance patterns
                    </p>
                </div>
                <Button
                    onClick={() => setShowFilters(!showFilters)}
                    variant="outline"
                    className="flex items-center gap-2"
                >
                    <Filter className="h-4 w-4" />
                    Filters
                </Button>
            </div>

            {/* Filter Section */}
            {showFilters && (
                <div className="bg-muted/50 rounded-lg p-4 space-y-4">
                    <h3 className="font-semibold">Filter by Date Range</h3>
                    <div className="flex gap-4 items-end">
                        <div className="flex-1">
                            <label className="block text-sm font-medium mb-1">Start Date</label>
                            <input
                                type="date"
                                value={dateRange.startDate}
                                onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                                className="w-full p-2 border rounded bg-background"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-sm font-medium mb-1">End Date</label>
                            <input
                                type="date"
                                value={dateRange.endDate}
                                onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                                className="w-full p-2 border rounded bg-background"
                            />
                        </div>
                        <Button onClick={applyFilters} className="px-6">
                            Apply
                        </Button>
                        <Button onClick={clearFilters} variant="outline">
                            Clear
                        </Button>
                    </div>
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-6 rounded-xl border bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-muted-foreground">Total Users</h3>
                        <Users className="h-4 w-4 text-blue-500" />
                    </div>
                    <p className="text-3xl font-bold">{data.summary.total_users}</p>
                </div>

                <div className="p-6 rounded-xl border bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-muted-foreground">Clusters Found</h3>
                        <TrendingUp className="h-4 w-4 text-green-500" />
                    </div>
                    <p className="text-3xl font-bold">{data.summary.optimal_clusters}</p>
                </div>

                <div className="p-6 rounded-xl border bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-muted-foreground">Dominant Behavior</h3>
                        <Clock className="h-4 w-4 text-purple-500" />
                    </div>
                    <p className="text-xl font-bold">{data.analysis.cluster_insights.dominant_behavior}</p>
                </div>

                <div className="p-6 rounded-xl border bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-muted-foreground">Algorithm</h3>
                        <AlertCircle className="h-4 w-4 text-orange-500" />
                    </div>
                    <p className="text-lg font-bold">K-Means + Elbow</p>
                </div>
            </div>

            {/* Scatter Plot */}
            <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
                <h3 className="text-lg font-semibold mb-4">
                    Attendance Behavior Patterns
                </h3>
                <p className="text-sm text-muted-foreground mb-6">
                    Each point represents a user positioned by their average arrival time (X-axis) and late arrival rate (Y-axis).
                    Colors indicate different behavior clusters.
                </p>
                
                <ResponsiveContainer width="100%" height={400}>
                    <ScatterChart data={scatterData} margin={{ top: 20, right: 20, bottom: 60, left: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                            type="number" 
                            dataKey="x" 
                            name="Avg Arrival Time"
                            domain={['dataMin - 0.5', 'dataMax + 0.5']}
                            tickFormatter={formatTime}
                        />
                        <YAxis 
                            type="number" 
                            dataKey="y" 
                            name="Late Percentage"
                            domain={['dataMin - 5', 'dataMax + 5']}
                            label={{ value: 'Late Arrival Rate (%)', angle: -90, position: 'insideLeft' }}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        
                        {/* Render scatter points for each cluster */}
                        {data.clusters.map((cluster, index) => {
                            const clusterData = scatterData.filter(item => item.cluster === cluster.cluster_id);
                            return (
                                <Scatter 
                                    key={cluster.cluster_id}
                                    name={cluster.behavior_type}
                                    data={clusterData}
                                    fill={clusterColors[index % clusterColors.length]}
                                />
                            );
                        })}
                        
                        <Legend 
                            wrapperStyle={{ paddingTop: '20px' }}
                            iconType="circle"
                        />
                    </ScatterChart>
                </ResponsiveContainer>
            </div>

            {/* Cluster Summary Table */}
            <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
                <h3 className="text-lg font-semibold mb-4">
                    Cluster Summary
                </h3>
                
                <div className="overflow-x-auto">
                    <table className="min-w-full table-auto">
                        <thead>
                            <tr className="bg-muted/50">
                                <th className="px-4 py-2 text-left text-sm font-semibold">Cluster</th>
                                <th className="px-4 py-2 text-left text-sm font-semibold">Behavior Type</th>
                                <th className="px-4 py-2 text-left text-sm font-semibold">Users</th>
                                <th className="px-4 py-2 text-left text-sm font-semibold">Avg Arrival</th>
                                <th className="px-4 py-2 text-left text-sm font-semibold">Late Rate</th>
                                <th className="px-4 py-2 text-left text-sm font-semibold">Absence Rate</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.clusters.map((cluster, index) => (
                                <tr key={cluster.cluster_id} className="border-t hover:bg-muted/30">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center">
                                            <div 
                                                className="w-4 h-4 rounded-full mr-2" 
                                                style={{ backgroundColor: clusterColors[index % clusterColors.length] }}
                                            ></div>
                                            {cluster.cluster_id}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="font-medium">{cluster.behavior_type}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-lg font-semibold">{cluster.size}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        {cluster.characteristics?.avg_arrival_time ? formatTime(cluster.characteristics.avg_arrival_time / 60) : 'N/A'}
                                    </td>
                                    <td className="px-4 py-3">
                                        {cluster.characteristics?.avg_late_percentage != null ? cluster.characteristics.avg_late_percentage.toFixed(1) + '%' : 'N/A'}
                                    </td>
                                    <td className="px-4 py-3">
                                        {cluster.characteristics?.avg_absence_percentage != null ? cluster.characteristics.avg_absence_percentage.toFixed(1) + '%' : 'N/A'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Insights and Recommendations */}
            {data.analysis.cluster_insights.recommendations.length > 0 && (
                <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
                    <h3 className="text-lg font-semibold mb-4">
                        AI Insights & Recommendations
                    </h3>
                    <div className="space-y-2">
                        {data.analysis.cluster_insights.recommendations.map((recommendation, index) => (
                            <div key={index} className="flex items-start">
                                <div className="flex-shrink-0 w-2 h-2 bg-primary rounded-full mt-2 mr-3"></div>
                                <p className="text-sm">{recommendation}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Metadata */}
            <div className="bg-muted/50 rounded-lg p-4">
                <div className="text-xs text-muted-foreground">
                    <p>Analysis Period: {data.summary.date_range.start} to {data.summary.date_range.end}</p>
                    <p>Generated: {new Date(data.metadata.timestamp).toLocaleString()}</p>
                    <p>Algorithm: {data.metadata.algorithm_info.name} with {data.metadata.algorithm_info.optimization}</p>
                </div>
            </div>
        </div>
    );
};

export default AttendanceClustersChart;

