// Student Behavior Analytics Page
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { 
  Users, 
  TrendingUp, 
  AlertTriangle, 
  Calendar, 
  Award, 
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';

const StudentBehavior = () => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userAnalysis, setUserAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  // Fetch all users
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/users');
      const data = await response.json();
      
      if (data.success) {
        setUsers(data.data);
      } else {
        toast.error('Failed to load users');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Error loading users');
    } finally {
      setLoading(false);
    }
  };

  // Fetch detailed analysis for selected user
  const fetchUserAnalysis = async (userId) => {
    try {
      setAnalysisLoading(true);
      
      // Helper function to safely parse JSON responses
      const safeJsonParse = async (response) => {
        if (!response.ok) {
          console.warn(`API returned ${response.status}: ${response.url}`);
          return { success: false, data: null };
        }
        try {
          return await response.json();
        } catch (e) {
          console.error('JSON parse error:', e);
          return { success: false, data: null };
        }
      };

      // Fetch multiple data sources in parallel with error handling
      const [clusterRes, anomalyRes, predictionRes, attendanceRes] = await Promise.allSettled([
        fetch('/api/attendance/clusters').then(safeJsonParse),
        fetch(`/api/attendance/anomalies?user_id=${userId}`).then(safeJsonParse),
        fetch('/api/ml/predict-late', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] // Tomorrow
          })
        }).then(safeJsonParse),
        fetch(`/api/attendance/user/${userId}/stats`).then(safeJsonParse)
      ]);

      // Extract data with fallbacks
      const clusterData = clusterRes.status === 'fulfilled' ? clusterRes.value : { success: false };
      const anomalyData = anomalyRes.status === 'fulfilled' ? anomalyRes.value : { success: false };
      const predictionData = predictionRes.status === 'fulfilled' ? predictionRes.value : { success: false };
      const attendanceData = attendanceRes.status === 'fulfilled' ? attendanceRes.value : { success: false };

      // Find user's cluster
      let userCluster = null;
      if (clusterData.success && clusterData.data?.clusters) {
        for (const cluster of clusterData.data.clusters) {
          if (cluster.members && cluster.members.some(m => m.user_id === userId)) {
            userCluster = cluster;
            break;
          }
        }
      }

      setUserAnalysis({
        cluster: userCluster,
        anomalies: anomalyData.success && anomalyData.data?.anomalies ? anomalyData.data.anomalies : [],
        prediction: predictionData.success ? predictionData.data : null,
        stats: attendanceData.success ? attendanceData.data : null
      });

    } catch (error) {
      console.error('Error fetching user analysis:', error);
      toast.error('Error loading analysis');
    } finally {
      setAnalysisLoading(false);
    }
  };

  const handleUserClick = (user) => {
    setSelectedUser(user);
    setUserAnalysis(null);
    fetchUserAnalysis(user._id);
  };

  const getRiskColor = (level) => {
    switch (level?.toLowerCase()) {
      case 'low': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'medium': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'high': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'low': return 'bg-blue-500/10 text-blue-500';
      case 'medium': return 'bg-yellow-500/10 text-yellow-500';
      case 'high': return 'bg-orange-500/10 text-orange-500';
      case 'critical': return 'bg-red-500/10 text-red-500';
      default: return 'bg-gray-500/10 text-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8" />
            Student Behavior Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            Analyze individual student attendance patterns and behaviors
          </p>
        </div>
        <Button onClick={fetchUsers} variant="outline">
          <Activity className="h-4 w-4 mr-2" />
          Refresh Data
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Students ({users.length})</CardTitle>
            <CardDescription>Click on a student to view detailed analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {users.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No students found</p>
              ) : (
                users.map((user) => (
                  <div
                    key={user._id}
                    onClick={() => handleUserClick(user)}
                    className={`p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                      selectedUser?._id === user._id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold">{user.username}</h3>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                      <Badge variant="outline" className="ml-2">
                        {user.role || 'Student'}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Detailed Analysis */}
        <div className="space-y-4">
          {!selectedUser ? (
            <Card className="h-full flex items-center justify-center min-h-[400px]">
              <CardContent className="text-center py-12">
                <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-lg">
                  Select a student to view their behavior analysis
                </p>
              </CardContent>
            </Card>
          ) : analysisLoading ? (
            <Card className="h-full flex items-center justify-center min-h-[400px]">
              <CardContent className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading analysis...</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Student Info Header */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5" />
                    {selectedUser.username}
                  </CardTitle>
                  <CardDescription>{selectedUser.email}</CardDescription>
                </CardHeader>
              </Card>

              {/* Cluster Assignment */}
              {userAnalysis?.cluster && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <TrendingUp className="h-5 w-5" />
                      Behavior Cluster
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Cluster Type</p>
                      <Badge variant="outline" className="text-base px-3 py-1">
                        {userAnalysis.cluster.behavior_type}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div>
                        <p className="text-sm text-muted-foreground">Avg Arrival Time</p>
                        <p className="text-lg font-semibold">
                          {new Date(userAnalysis.cluster.characteristics.avg_arrival_time * 60 * 1000).toISOString().substr(11, 5)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Late %</p>
                        <p className="text-lg font-semibold">
                          {userAnalysis.cluster.characteristics.avg_late_percentage.toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Absence %</p>
                        <p className="text-lg font-semibold">
                          {userAnalysis.cluster.characteristics.avg_absence_percentage.toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Cluster Size</p>
                        <p className="text-lg font-semibold">{userAnalysis.cluster.size} students</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Late Arrival Prediction */}
              {userAnalysis?.prediction && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Clock className="h-5 w-5" />
                      Late Arrival Prediction
                    </CardTitle>
                    <CardDescription>Tomorrow's forecast</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Risk Level</span>
                      <Badge className={getRiskColor(userAnalysis.prediction.risk_level)}>
                        {userAnalysis.prediction.risk_level}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Probability</span>
                      <span className="text-lg font-semibold">
                        {(userAnalysis.prediction.probability_late * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Confidence</span>
                      <span className="text-lg font-semibold">
                        {(userAnalysis.prediction.model_confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    {userAnalysis.prediction.factors && (
                      <div className="pt-2 border-t">
                        <p className="text-sm font-medium mb-2">Key Factors:</p>
                        <ul className="space-y-1">
                          {userAnalysis.prediction.factors.slice(0, 3).map((factor, idx) => (
                            <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                              <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                              {factor}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Anomalies Detected */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <AlertTriangle className="h-5 w-5" />
                    Anomalies Detected
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {userAnalysis?.anomalies && userAnalysis.anomalies.length > 0 ? (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {userAnalysis.anomalies.slice(0, 5).map((anomaly, idx) => (
                        <div key={idx} className="p-3 rounded-lg border border-border bg-card/50">
                          <div className="flex items-center justify-between mb-2">
                            <Badge className={getSeverityColor(anomaly.severity)}>
                              {anomaly.severity}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(anomaly.date).toLocaleDateString()}
                            </span>
                          </div>
                          {anomaly.anomalyTypes && anomaly.anomalyTypes.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {anomaly.anomalyTypes.map((type, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {type}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                      {userAnalysis.anomalies.length > 5 && (
                        <p className="text-sm text-muted-foreground text-center pt-2">
                          +{userAnalysis.anomalies.length - 5} more anomalies
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-2" />
                      <p className="text-muted-foreground">No anomalies detected</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Attendance Stats */}
              {userAnalysis?.stats && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Calendar className="h-5 w-5" />
                      Attendance Statistics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 rounded-lg bg-primary/5">
                        <p className="text-sm text-muted-foreground">Total Days</p>
                        <p className="text-2xl font-bold">{userAnalysis.stats.total_days || 0}</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-green-500/5">
                        <p className="text-sm text-muted-foreground">Present</p>
                        <p className="text-2xl font-bold text-green-500">{userAnalysis.stats.present_days || 0}</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-red-500/5">
                        <p className="text-sm text-muted-foreground">Absent</p>
                        <p className="text-2xl font-bold text-red-500">{userAnalysis.stats.absent_days || 0}</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-yellow-500/5">
                        <p className="text-sm text-muted-foreground">Late Arrivals</p>
                        <p className="text-2xl font-bold text-yellow-500">{userAnalysis.stats.late_arrivals || 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentBehavior;