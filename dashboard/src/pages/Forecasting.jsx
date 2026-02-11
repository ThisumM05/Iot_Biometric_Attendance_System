import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { TrendingUp, Calendar, AlertTriangle, RefreshCcw, Target, Activity, Users, Clock } from 'lucide-react';

const Forecasting = () => {
    const [forecastData, setForecastData] = useState({
        actual: [],
        forecast: [],
        prediction: null,
        modelMetrics: null
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedUser, setSelectedUser] = useState('');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [users, setUsers] = useState([]);

    console.log('📈 Forecasting component rendered');

    // Fetch users for prediction dropdown
    const fetchUsers = async () => {
        try {
            console.log('👥 Fetching users from database...');
            const response = await fetch('http://localhost:5000/api/users');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success && result.data) {
                console.log(`📋 Loaded ${result.data.length} users from database`);
                // Map database users to component format
                const mappedUsers = result.data.map(user => ({
                    id: user._id,
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    isEnrolled: user.isEnrolled
                }));
                setUsers(mappedUsers);
            } else {
                throw new Error('Failed to fetch users from database');
            }
        } catch (error) {
            console.error('❌ Error fetching users:', error);
            setError(`Failed to load users: ${error.message}`);
        }
    };

    // Fetch time series forecast data
    const fetchForecast = async () => {
        try {
            setLoading(true);
            setError(null);

            console.log('📊 Fetching real ML forecast data...');
            
            // Call real ML API endpoint
            const response = await fetch('http://localhost:5000/api/ml/forecast?days=30');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.message || 'Failed to fetch forecast');
            }
            
            console.log('✅ ML forecast data loaded successfully');
            console.log(`📈 Model metrics:`, result.data.model_metrics);
            
            setForecastData({
                actual: result.data.historical || [],
                forecast: result.data.forecast || [],
                prediction: null,
                modelMetrics: result.data.model_metrics
            });
            
        } catch (error) {
            console.error('❌ Error fetching ML forecast:', error);
            setError(`ML Forecast Error: ${error.message}`);
            
            // Fallback to basic data if ML service fails
            console.log('🔄 Using fallback data...');
            setForecastData({
                actual: [],
                forecast: [],
                prediction: null
            });
        } finally {
            setLoading(false);
        }
    };

    // Predict late arrival for specific user and date
    const predictLateArrival = async () => {
        if (!selectedUser || !selectedDate) {
            setError('Please select both a user and date for prediction');
            return;
        }

        // Validate that selected date is not in the past
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const selectedDateObj = new Date(selectedDate);
        
        if (selectedDateObj < today) {
            setError('❌ Past Date Selected: Predictions can only be generated for future dates. Please select today or a future date.');
            return;
        }

        // Check if selected user exists
        const selectedUserData = users.find(u => u.id === selectedUser);
        if (!selectedUserData) {
            setError('❌ Invalid User: Selected user not found. Please refresh and try again.');
            return;
        }

        try {
            setLoading(true);
            setError(null);

            console.log('🎯 Generating real ML prediction for:', selectedUserData.username, selectedDate);
            
            // Call real ML prediction API
            const response = await fetch('http://localhost:5000/api/ml/predict-late', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: selectedUser, date: selectedDate })
            });
            
            if (!response.ok) {
                if (response.status === 400) {
                    const errorResult = await response.json();
                    throw new Error(errorResult.message || 'Invalid request');
                }
                throw new Error(`Server error: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (!result.success) {
                // Handle specific error cases
                if (result.message.includes('no attendance')) {
                    setError(
                        `❌ No Attendance Data: ${selectedUserData.username} has no attendance history. ` +
                        'AI predictions require at least some historical attendance data. ' +
                        'Please select a different user or wait for attendance data to be recorded.'
                    );
                    return;
                } else if (result.message.includes('past date')) {
                    setError('❌ Past Date Error: Predictions can only be made for future dates.');
                    return;
                }
                throw new Error(result.message || 'Failed to generate prediction');
            }
            
            console.log('✅ ML prediction generated successfully');
            console.log(`🎯 Prediction: ${(result.data.probability_late * 100).toFixed(1)}% late probability`);
            
            setForecastData(prev => ({
                ...prev,
                prediction: result.data
            }));
            
        } catch (error) {
            console.error('❌ Error generating ML prediction:', error);
            setError(`ML Prediction Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
        fetchForecast();
    }, []);

    const combinedData = [
        ...forecastData.actual.map(item => ({
            ...item,
            type: 'actual',
            predicted: null,
            lower: null,
            upper: null
        })),
        ...forecastData.forecast.map(item => ({
            ...item,
            type: 'forecast',
            value: null
        }))
    ];

    if (loading && forecastData.actual.length === 0) {
        return (
            <div className="p-6 space-y-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">AI/ML Time Series Forecasting</h1>
                    <p className="text-muted-foreground">Real machine learning models trained on your data</p>
                </div>
                <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                        <p>Training AI/ML models on your attendance data...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 space-y-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">AI/ML Time Series Forecasting</h1>
                    <p className="text-muted-foreground">Real machine learning models</p>
                </div>
                <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                        <strong>ML Model Error:</strong> {error}
                        <div className="mt-2">
                            <Button onClick={fetchForecast} size="sm" variant="outline">
                                <RefreshCcw className="mr-2 h-3 w-3" />
                                Retry ML Training
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
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">AI/ML Time Series Forecasting</h1>
                    <p className="text-muted-foreground">Real machine learning models trained on your attendance data</p>
                    <p className="text-xs text-muted-foreground mt-1">
                        Statistical Forecasting • Random Forest Classification • Live Model Training
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={fetchForecast} variant="outline" disabled={loading}>
                        {loading ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                        ) : (
                            <RefreshCcw className="mr-2 h-4 w-4" />
                        )}
                        Retrain ML Models
                    </Button>
                </div>
            </div>

            {/* All Students Attendance Line Chart */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        All Students Daily Attendance Trends
                    </CardTitle>
                    <CardDescription>Historical attendance patterns across all students over time</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={forecastData.actual}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis 
                                    dataKey="formatted_date" 
                                    angle={-45}
                                    textAnchor="end"
                                    height={80}
                                    fontSize={12}
                                />
                                <YAxis />
                                <Tooltip
                                    labelFormatter={(label) => `Date: ${label}`}
                                    formatter={(value) => [value, 'Total Attendance']}
                                />
                                <Legend />
                                <Line 
                                    type="monotone" 
                                    dataKey="value" 
                                    stroke="#3b82f6" 
                                    strokeWidth={3}
                                    dot={{ r: 4, fill: '#3b82f6' }}
                                    activeDot={{ r: 6, fill: '#1d4ed8' }}
                                    name="Daily Attendance"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Time Series Forecast Chart */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        Attendance Forecast - Next 30 Days (Future Only)
                    </CardTitle>
                    <CardDescription>
                        Historical data (blue line) vs AI predictions for future dates (orange dashed line) with confidence intervals
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-96">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={combinedData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis 
                                    dataKey="formatted_date" 
                                    angle={-45}
                                    textAnchor="end"
                                    height={80}
                                    fontSize={12}
                                />
                                <YAxis />
                                <Tooltip
                                    labelFormatter={(label) => `Date: ${label}`}
                                    formatter={(value, name) => [
                                        value,
                                        name === 'value' ? 'Actual Attendance' :
                                        name === 'predicted' ? 'Predicted' :
                                        name === 'upper' ? 'Upper Bound' : 'Lower Bound'
                                    ]}
                                />
                                <Legend />
                                
                                {/* Confidence Interval */}
                                <Area 
                                    type="monotone" 
                                    dataKey="upper" 
                                    stroke="none"
                                    fill="#e5e7eb"
                                    fillOpacity={0.3}
                                />
                                <Area 
                                    type="monotone" 
                                    dataKey="lower" 
                                    stroke="none"
                                    fill="#ffffff"
                                    fillOpacity={1}
                                />
                                
                                {/* Actual Data */}
                                <Line 
                                    type="monotone" 
                                    dataKey="value" 
                                    stroke="#3b82f6" 
                                    strokeWidth={2}
                                    dot={{ r: 3 }}
                                    name="Actual"
                                />
                                
                                {/* Predicted Data */}
                                <Line 
                                    type="monotone" 
                                    dataKey="predicted" 
                                    stroke="#f59e0b" 
                                    strokeWidth={2}
                                    strokeDasharray="5 5"
                                    dot={{ r: 3 }}
                                    name="Forecast"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Individual Prediction Panel */}
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Prediction Input */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Target className="h-5 w-5" />
                            Individual Late Arrival Prediction
                        </CardTitle>
                        <CardDescription>Predict the likelihood of a specific employee arriving late</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <label className="text-sm font-medium">Select Employee</label>
                                <select 
                                    value={selectedUser} 
                                    onChange={(e) => setSelectedUser(e.target.value)}
                                    className="w-full mt-1 px-3 py-2 border rounded text-sm"
                                >
                                    <option value="">Choose employee...</option>
                                    {users.map(user => (
                                        <option key={user.id} value={user.id}>
                                            {user.username} ({user.role}) {!user.isEnrolled && '- Not Enrolled'}
                                        </option>
                                    ))}
                                </select>
                                {users.length === 0 && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Loading users...
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className="text-sm font-medium">Select Date</label>
                                <input 
                                    type="date" 
                                    value={selectedDate} 
                                    onChange={(e) => {
                                        setSelectedDate(e.target.value);
                                        // Clear any existing error when date changes
                                        if (error && error.includes('Past Date')) {
                                            setError(null);
                                        }
                                    }}
                                    className="w-full mt-1 px-3 py-2 border rounded text-sm"
                                    min={new Date().toISOString().split('T')[0]}
                                    title="Select today or a future date for prediction"
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    Predictions available for today and future dates only
                                </p>
                            </div>
                        </div>
                        <Button 
                            onClick={predictLateArrival} 
                            className="w-full"
                            disabled={!selectedUser || !selectedDate || loading}
                        >
                            {loading ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            ) : (
                                <Activity className="mr-2 h-4 w-4" />
                            )}
                            Generate Prediction
                        </Button>
                    </CardContent>
                </Card>

                {/* Prediction Result */}
                <Card>
                    <CardHeader>
                        <CardTitle>Prediction Result</CardTitle>
                        <CardDescription>AI-powered risk assessment</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {forecastData.prediction ? (
                            <div className="space-y-4">
                                <div className="text-center">
                                    <div className="text-sm text-muted-foreground mb-2">
                                        ML Prediction for: <strong>{forecastData.prediction.username}</strong>
                                    </div>
                                    <div className="text-xs text-muted-foreground mb-3">
                                        Date: {new Date(forecastData.prediction.date).toLocaleDateString()}
                                        {forecastData.prediction.model_confidence && (
                                            <span className="ml-2">• Confidence: {(forecastData.prediction.model_confidence * 100).toFixed(1)}%</span>
                                        )}
                                        {forecastData.prediction.historical_records_count && (
                                            <span className="ml-2">• Data: {forecastData.prediction.historical_records_count} records</span>
                                        )}
                                    </div>
                                    <div className="text-4xl font-bold mb-2">
                                        {(forecastData.prediction.probability_late * 100).toFixed(1)}%
                                    </div>
                                    <p className="text-muted-foreground mb-4">AI-Predicted Late Probability</p>
                                    <Badge 
                                        variant={
                                            forecastData.prediction.risk_level === 'High' ? 'destructive' :
                                            forecastData.prediction.risk_level === 'Medium' ? 'secondary' : 'default'
                                        }
                                        className="text-lg px-4 py-1"
                                    >
                                        {forecastData.prediction.risk_level} Risk
                                    </Badge>
                                </div>
                                
                                <div className="mt-4">
                                    <h4 className="font-medium mb-2">ML Analysis Factors:</h4>
                                    <ul className="text-sm space-y-1 text-muted-foreground">
                                        {forecastData.prediction.factors.map((factor, index) => (
                                            <li key={index} className="flex items-center gap-2">
                                                <div className="w-1 h-1 bg-primary rounded-full"></div>
                                                {factor}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                
                                {forecastData.modelMetrics && (
                                    <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                                        <h5 className="text-xs font-medium mb-2">Model Performance:</h5>
                                        <div className="text-xs text-muted-foreground grid grid-cols-2 gap-2">
                                            <span>Accuracy: {forecastData.modelMetrics.accuracy || 'N/A'}</span>
                                            <span>MAE: {forecastData.modelMetrics.mae || 'N/A'}</span>
                                            <span>RMSE: {forecastData.modelMetrics.rmse || 'N/A'}</span>
                                            <span>Data Points: {forecastData.modelMetrics.dataPoints || 'N/A'}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : error ? (
                            <div className="text-center py-8">
                                <Alert className="mb-4">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertDescription>
                                        <div className="text-left">
                                            <div className="font-medium mb-2">Prediction Error</div>
                                            <div className="text-sm">{error}</div>
                                            {error.includes('Past Date') && (
                                                <div className="mt-2 text-xs text-muted-foreground">
                                                    💡 Tip: Select today's date or a future date for predictions.
                                                </div>
                                            )}
                                            {error.includes('No Attendance Data') && (
                                                <div className="mt-2 text-xs text-muted-foreground">
                                                    💡 Tip: Try selecting a different user who has attendance history.
                                                </div>
                                            )}
                                        </div>
                                    </AlertDescription>
                                </Alert>
                                <Target className="h-12 w-12 mx-auto mb-3 opacity-30" />
                                <p className="text-muted-foreground">Please correct the issue and try again</p>
                            </div>
                        ) : (
                            <div className="text-center py-8 text-muted-foreground">
                                <Target className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                <p>Select an employee and date to generate prediction</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default Forecasting;