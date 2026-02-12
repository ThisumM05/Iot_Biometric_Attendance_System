import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Users, Activity, Settings, Bell, BellOff, CheckCircle2 } from 'lucide-react';
import io from 'socket.io-client';

const OccupancyMonitor = () => {
  const [currentStates, setCurrentStates] = useState([]);
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [socket, setSocket] = useState(null);

  // Initialize Socket.io connection
  useEffect(() => {
    const newSocket = io('http://localhost:5000', {
      transports: ['websocket'],
      reconnection: true
    });

    newSocket.on('connect', () => {
      console.log('Connected to occupancy monitoring');
      newSocket.emit('join:occupancy');
    });

    // Listen for occupancy updates
    newSocket.on('occupancy:update', (data) => {
      console.log('Occupancy update:', data);
      fetchCurrentStates();
    });

    // Listen for alerts
    newSocket.on('occupancy:alert', (data) => {
      console.log('Occupancy alert:', data);
      if (soundEnabled) {
        playAlertSound(data.severity);
      }
      fetchActiveAlerts();
      fetchStatistics();
    });

    // Listen for alert resolutions
    newSocket.on('occupancy:alert:resolved', (data) => {
      console.log('Alert resolved:', data);
      fetchActiveAlerts();
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [soundEnabled]);

  // Fetch initial data
  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchCurrentStates(),
      fetchActiveAlerts(),
      fetchStatistics(),
      fetchConfig()
    ]);
    setLoading(false);
  };

  const fetchCurrentStates = async () => {
    try {
      const response = await fetch('/api/occupancy/current-state');
      const data = await response.json();
      if (data.success) {
        setCurrentStates(data.states || []);
      }
    } catch (error) {
      console.error('Error fetching current states:', error);
    }
  };

  const fetchActiveAlerts = async () => {
    try {
      const response = await fetch('/api/occupancy/alerts/active');
      const data = await response.json();
      if (data.success) {
        setActiveAlerts(data.alerts);
      }
    } catch (error) {
      console.error('Error fetching active alerts:', error);
    }
  };

  const fetchStatistics = async () => {
    try {
      const response = await fetch('/api/occupancy/statistics');
      const data = await response.json();
      if (data.success) {
        setStatistics(data.data);
      }
    } catch (error) {
      console.error('Error fetching statistics:', error);
    }
  };

  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/occupancy/config');
      const data = await response.json();
      if (data.success) {
        setConfig(data.config);
      }
    } catch (error) {
      console.error('Error fetching config:', error);
    }
  };

  const handleResolveAlert = async (alertId) => {
    try {
      const response = await fetch(`/api/occupancy/alerts/${alertId}/resolve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resolvedBy: 'admin', // Replace with actual user ID
          notes: 'Resolved from dashboard'
        })
      });

      if (response.ok) {
        fetchActiveAlerts();
        fetchStatistics();
      }
    } catch (error) {
      console.error('Error resolving alert:', error);
    }
  };

  const handleResetDevice = async (deviceId) => {
    try {
      const response = await fetch('/api/occupancy/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId })
      });

      if (response.ok) {
        fetchCurrentStates();
      }
    } catch (error) {
      console.error('Error resetting device:', error);
    }
  };

  const playAlertSound = (severity) => {
    const audio = new Audio(severity === 'CRITICAL' ? '/sounds/critical-alert.mp3' : '/sounds/warning-alert.mp3');
    audio.play().catch(err => console.log('Audio play failed:', err));
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'CRITICAL':
        return 'destructive';
      case 'WARNING':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const getOccupancyColor = (count, maxAllowed) => {
    if (count === 0) return 'text-gray-500';
    if (count <= maxAllowed) return 'text-green-600';
    if (count === maxAllowed + 1) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Activity className="w-12 h-12 animate-spin mx-auto mb-4" />
          <p>Loading occupancy data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Occupancy Monitoring</h1>
        <div className="flex gap-2">
          <Button
            variant={soundEnabled ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSoundEnabled(!soundEnabled)}
          >
            {soundEnabled ? <Bell className="w-4 h-4 mr-2" /> : <BellOff className="w-4 h-4 mr-2" />}
            Alerts {soundEnabled ? 'On' : 'Off'}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchAllData}>
            <Activity className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Configuration Card */}
      {config && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Max Allowed Persons</p>
                <p className="text-2xl font-bold">{config.MAX_ALLOWED_PERSONS}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Alert Cooldown</p>
                <p className="text-2xl font-bold">{config.COOLDOWN_PERIOD_SECONDS}s</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">
                {statistics.alerts.unresolved}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {statistics.alerts.total} total alerts
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Peak Occupancy</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{statistics.occupancy.peak}</div>
              <p className="text-xs text-muted-foreground mt-1">persons</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Entry Events</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {statistics.events.entries}
              </div>
              <p className="text-xs text-muted-foreground mt-1">total entries</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Exit Events</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">
                {statistics.events.exits}
              </div>
              <p className="text-xs text-muted-foreground mt-1">total exits</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Active Alerts */}
      {activeAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Active Alerts ({activeAlerts.length})
            </CardTitle>
            <CardDescription>Unresolved occupancy violations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeAlerts.map((alert) => (
                <Alert key={alert._id} variant={alert.alertSeverity === 'CRITICAL' ? 'destructive' : 'default'}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={getSeverityColor(alert.alertSeverity)}>
                          {alert.alertSeverity}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {new Date(alert.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <AlertDescription className="font-medium">
                        {alert.alertMessage}
                      </AlertDescription>
                      <div className="mt-2 text-sm text-muted-foreground">
                        Device: {alert.deviceId} | Location: {alert.location} | Count: {alert.personCount}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleResolveAlert(alert._id)}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      Resolve
                    </Button>
                  </div>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current Device States */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Current Occupancy Status
          </CardTitle>
          <CardDescription>Real-time occupancy for all devices</CardDescription>
        </CardHeader>
        <CardContent>
          {currentStates.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No devices reporting</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {currentStates.map((state) => (
                <div key={state.deviceId} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold">{state.deviceId}</h3>
                      <p className="text-sm text-muted-foreground">{state.location}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleResetDevice(state.deviceId)}
                    >
                      Reset
                    </Button>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <Users
                      className={`w-8 h-8 ${getOccupancyColor(
                        state.personCount,
                        config?.MAX_ALLOWED_PERSONS || 1
                      )}`}
                    />
                    <span
                      className={`text-4xl font-bold ${getOccupancyColor(
                        state.personCount,
                        config?.MAX_ALLOWED_PERSONS || 1
                      )}`}
                    >
                      {state.personCount}
                    </span>
                    <span className="text-muted-foreground">
                      / {config?.MAX_ALLOWED_PERSONS || 1}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Last update: {new Date(state.lastUpdate).toLocaleTimeString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OccupancyMonitor;
