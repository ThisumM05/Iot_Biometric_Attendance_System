import { useState, useEffect } from 'react';
import { AlertTriangle, Shield, Clock, Smartphone, Calendar, TrendingUp, Filter, RefreshCw, Eye } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const AnomalyDetection = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        severity: '',
        status: 'new'
    });
    const [showFilters, setShowFilters] = useState(false);
    const [detecting, setDetecting] = useState(false);
    const [training, setTraining] = useState(false);

    // Fetch anomalies
    const fetchAnomalies = async () => {
        try {
            setLoading(true);
            setError(null);

            let url = '/api/attendance/anomalies?';
            const params = new URLSearchParams();
            
            if (filters.startDate) params.append('startDate', filters.startDate);
            if (filters.endDate) params.append('endDate', filters.endDate);
            if (filters.severity) params.append('severity', filters.severity);
            if (filters.status) params.append('status', filters.status);
            
            url += params.toString();

            const response = await fetch(url, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();
            
            if (result.success) {
                setData(result.data);
            } else {
                throw new Error(result.message || 'Failed to fetch anomalies');
            }
        } catch (err) {
            console.error('Error fetching anomalies:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Run anomaly detection
    const runDetection = async () => {
        try {
            setDetecting(true);
            
            const response = await fetch('/api/attendance/anomaly-detect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    startDate: filters.startDate,
                    endDate: filters.endDate,
                    saveResults: true
                })
            });

            const result = await response.json();
            
            if (result.success) {
                await fetchAnomalies(); // Refresh list
                alert(`Detection complete: ${result.data.summary.anomalies_found} anomalies found`);
            } else {
                throw new Error(result.message);
            }
        } catch (err) {
            alert(`Detection failed: ${err.message}`);
        } finally {
            setDetecting(false);
        }
    };

    // Train model
    const trainModel = async () => {
        try {
            setTraining(true);
            
            const response = await fetch('/api/attendance/anomaly-train', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    startDate: filters.startDate,
                    endDate: filters.endDate
                })
            });

            const result = await response.json();
            
            if (result.success) {
                alert('Model trained successfully!');
            } else {
                throw new Error(result.message);
            }
        } catch (err) {
            alert(`Training failed: ${err.message}`);
        } finally {
            setTraining(false);
        }
    };

    useEffect(() => {
        fetchAnomalies();
    }, []);

    // Apply filters
    const applyFilters = () => {
        fetchAnomalies();
    };

    // Clear filters
    const clearFilters = () => {
        setFilters({ startDate: '', endDate: '', severity: '', status: 'new' });
    };

    // Get severity badge color
    const getSeverityColor = (severity) => {
        switch (severity) {
            case 'high': return 'bg-red-500';
            case 'medium': return 'bg-orange-500';
            case 'low': return 'bg-yellow-500';
            default: return 'bg-gray-500';
        }
    };

    // Get type icon
    const getTypeIcon = (type) => {
        switch (type) {
            case 'time_anomaly': return Clock;
            case 'device_anomaly': return Smartphone;
            case 'frequency_anomaly': return Calendar;
            default: return AlertTriangle;
        }
    };

    if (loading) {
        return (
            <div className="space-y-6 p-6">
                <div className="animate-pulse">
                    <div className="h-8 bg-muted rounded mb-4"></div>
                    <div className="h-64 bg-muted/50 rounded"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6">
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                        <div className="font-semibold mb-2">Failed to load anomalies</div>
                        <div className="text-sm">{error}</div>
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold">Anomaly Detection</h2>
                    <p className="text-muted-foreground text-sm mt-1">
                        Isolation Forest-based anomaly detection for attendance patterns
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        onClick={trainModel}
                        disabled={training}
                        variant="outline"
                    >
                        <Shield className="h-4 w-4 mr-2" />
                        {training ? 'Training...' : 'Train Model'}
                    </Button>
                    <Button
                        onClick={runDetection}
                        disabled={detecting}
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${detecting ? 'animate-spin' : ''}`} />
                        {detecting ? 'Detecting...' : 'Run Detection'}
                    </Button>
                    <Button
                        onClick={() => setShowFilters(!showFilters)}
                        variant="outline"
                    >
                        <Filter className="h-4 w-4 mr-2" />
                        Filters
                    </Button>
                </div>
            </div>

            {/* Filters */}
            {showFilters && (
                <div className="bg-muted/50 rounded-lg p-4 space-y-4">
                    <h3 className="font-semibold">Filter Anomalies</h3>
                    <div className="grid grid-cols-4 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Start Date</label>
                            <input
                                type="date"
                                value={filters.startDate}
                                onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                                className="w-full p-2 border rounded bg-background"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">End Date</label>
                            <input
                                type="date"
                                value={filters.endDate}
                                onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                                className="w-full p-2 border rounded bg-background"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Severity</label>
                            <select
                                value={filters.severity}
                                onChange={(e) => setFilters(prev => ({ ...prev, severity: e.target.value }))}
                                className="w-full p-2 border rounded bg-background"
                            >
                                <option value="">All</option>
                                <option value="high">High</option>
                                <option value="medium">Medium</option>
                                <option value="low">Low</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Status</label>
                            <select
                                value={filters.status}
                                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                                className="w-full p-2 border rounded bg-background"
                            >
                                <option value="">All</option>
                                <option value="new">New</option>
                                <option value="reviewed">Reviewed</option>
                                <option value="resolved">Resolved</option>
                                <option value="false_positive">False Positive</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={applyFilters}>Apply</Button>
                        <Button onClick={clearFilters} variant="outline">Clear</Button>
                    </div>
                </div>
            )}

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-6 rounded-xl border bg-card shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-muted-foreground">Total Anomalies</h3>
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                    </div>
                    <p className="text-3xl font-bold">{data?.stats?.total || 0}</p>
                </div>

                <div className="p-6 rounded-xl border bg-card shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-muted-foreground">High Severity</h3>
                        <Shield className="h-4 w-4 text-red-500" />
                    </div>
                    <p className="text-3xl font-bold text-red-600">{data?.stats?.by_severity?.high || 0}</p>
                </div>

                <div className="p-6 rounded-xl border bg-card shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-muted-foreground">Medium Severity</h3>
                        <TrendingUp className="h-4 w-4 text-orange-500" />
                    </div>
                    <p className="text-3xl font-bold text-orange-600">{data?.stats?.by_severity?.medium || 0}</p>
                </div>

                <div className="p-6 rounded-xl border bg-card shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-muted-foreground">Low Severity</h3>
                        <Eye className="h-4 w-4 text-yellow-500" />
                    </div>
                    <p className="text-3xl font-bold text-yellow-600">{data?.stats?.by_severity?.low || 0}</p>
                </div>
            </div>

            {/* Anomalies Table */}
            <div className="rounded-xl border bg-card shadow-sm p-6">
                <h3 className="text-lg font-semibold mb-4">Detected Anomalies</h3>
                
                {data?.anomalies?.length === 0 ? (
                    <div className="text-center py-12">
                        <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">No anomalies detected</p>
                        <p className="text-sm text-muted-foreground mt-2">Run detection to analyze attendance patterns</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full table-auto">
                            <thead>
                                <tr className="bg-muted/50">
                                    <th className="px-4 py-2 text-left text-sm font-semibold">Date</th>
                                    <th className="px-4 py-2 text-left text-sm font-semibold">User</th>
                                    <th className="px-4 py-2 text-left text-sm font-semibold">Score</th>
                                    <th className="px-4 py-2 text-left text-sm font-semibold">Severity</th>
                                    <th className="px-4 py-2 text-left text-sm font-semibold">Types</th>
                                    <th className="px-4 py-2 text-left text-sm font-semibold">Reason</th>
                                    <th className="px-4 py-2 text-left text-sm font-semibold">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data?.anomalies?.map((anomaly) => (
                                    <tr key={anomaly._id} className="border-t hover:bg-muted/30">
                                        <td className="px-4 py-3 text-sm">
                                            {new Date(anomaly.date).toLocaleDateString()}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="font-medium">{anomaly.user_name}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="text-sm font-mono">{anomaly.anomaly_score.toFixed(3)}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge className={getSeverityColor(anomaly.severity)}>
                                                {anomaly.severity}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex gap-1 flex-wrap">
                                                {anomaly.anomaly_types.map((type, idx) => {
                                                    const Icon = getTypeIcon(type);
                                                    return (
                                                        <div key={idx} className="flex items-center gap-1 text-xs" title={type}>
                                                            <Icon className="h-3 w-3" />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="text-sm max-w-md truncate" title={anomaly.reason}>
                                                {anomaly.reason}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge variant="outline">{anomaly.status}</Badge>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Type Breakdown */}
            {data?.stats?.by_type && Object.keys(data.stats.by_type).length > 0 && (
                <div className="rounded-xl border bg-card shadow-sm p-6">
                    <h3 className="text-lg font-semibold mb-4">Anomaly Type Distribution</h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        {Object.entries(data.stats.by_type).map(([type, count]) => {
                            const Icon = getTypeIcon(type);
                            return (
                                <div key={type} className="flex items-center gap-3">
                                    <Icon className="h-5 w-5 text-muted-foreground" />
                                    <div>
                                        <div className="text-lg font-bold">{count}</div>
                                        <div className="text-xs text-muted-foreground">{type.replace('_', ' ')}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AnomalyDetection;
