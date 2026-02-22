import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Activity, Shield, LogIn, LogOut, Clock, RefreshCw } from 'lucide-react';
import io from 'socket.io-client';

const OccupancyMonitor = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLogs = useCallback(async () => {
    try {
      const response = await fetch('/api/occupancy/logs?limit=200');
      const data = await response.json();
      if (data.success) {
        setLogs(data.data?.logs || []);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    }
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchLogs();
    setRefreshing(false);
  };

  const handleResetAll = async () => {
    if (window.confirm('Are you sure you want to reset all occupancy counts to 0? This will clear all current status.')) {
      try {
        const response = await fetch('/api/occupancy/reset-all', { method: 'POST' });
        const data = await response.json();
        if (data.success) {
          await fetchLogs();
          alert('All occupancy counts have been reset.');
        }
      } catch (error) {
        console.error('Error resetting occupancy:', error);
      }
    }
  };

  useEffect(() => {
    const newSocket = io('http://localhost:5000', {
      transports: ['websocket'],
      reconnection: true
    });

    newSocket.on('connect', () => newSocket.emit('join:occupancy'));
    newSocket.on('occupancy:update', fetchLogs);
    newSocket.on('occupancy:alert', fetchLogs);
    newSocket.on('occupancy:alert:resolved', fetchLogs);
    newSocket.on('occupancy:reset-all', fetchLogs);

    return () => newSocket.disconnect();
  }, [fetchLogs]);

  useEffect(() => {
    fetchLogs().then(() => setLoading(false));
  }, [fetchLogs]);

  // --- Derived stats from logs ---
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayLogs = logs.filter(l => new Date(l.timestamp) >= today);
  const todayEntry = todayLogs.filter(l => l.eventType === 'ENTRY').length;
  const todayExit = todayLogs.filter(l => l.eventType === 'EXIT').length;
  const lastEvent = logs[0]; // already sorted desc

  // Current occupancy: use the most recent personCount per location
  // logs is sorted desc, so the first entry per location is the most recent one
  const locationLatest = {};
  logs.forEach(l => {
    if (l.location && locationLatest[l.location] === undefined) {
      locationLatest[l.location] = l.personCount ?? 0;
    }
  });
  const totalOccupancy = Object.values(locationLatest).reduce((sum, v) => sum + v, 0);

  const getEventBadge = (eventType) => {
    switch (eventType) {
      case 'ENTRY': return <Badge className="bg-green-600 text-white">ENTRY</Badge>;
      case 'EXIT': return <Badge className="bg-blue-600 text-white">EXIT</Badge>;
      case 'NO_CHANGE': return <Badge variant="outline">NO CHANGE</Badge>;
      default: return <Badge variant="secondary">{eventType || '—'}</Badge>;
    }
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
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Occupancy Log</h1>
        <div className="flex gap-2">
          <Button variant="destructive" size="sm" onClick={handleResetAll}>
            <Shield className="w-4 h-4 mr-2" />
            Reset All
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Current Occupancy */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Current Occupancy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-4xl font-bold ${totalOccupancy > 0 ? 'text-green-600' : 'text-gray-400'}`}>
              {totalOccupancy}
            </div>
            <p className="text-xs text-muted-foreground mt-1">persons currently inside</p>
          </CardContent>
        </Card>

        {/* Card 2: Today's Entries */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <LogIn className="w-4 h-4 text-green-600" /> Today's Entries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-green-600">{todayEntry}</div>
            <p className="text-xs text-muted-foreground mt-1">beam crossings IN today</p>
          </CardContent>
        </Card>

        {/* Card 3: Today's Exits */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <LogOut className="w-4 h-4 text-blue-600" /> Today's Exits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-blue-600">{todayExit}</div>
            <p className="text-xs text-muted-foreground mt-1">beam crossings OUT today</p>
          </CardContent>
        </Card>

        {/* Card 4: Last Event */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Clock className="w-4 h-4" /> Last Event
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lastEvent ? (
              <>
                <div className="flex items-center gap-2 mb-1">
                  {getEventBadge(lastEvent.eventType)}
                  <span className="font-bold text-lg">{lastEvent.personCount}</span>
                  <span className="text-xs text-muted-foreground">persons</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{lastEvent.location || '—'}</p>
                <p className="text-xs text-muted-foreground">{new Date(lastEvent.timestamp).toLocaleTimeString()}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No events yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Event Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            All Events ({logs.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Shield className="w-12 h-12 mx-auto mb-4 opacity-40" />
              <p className="text-lg font-medium">No events recorded yet</p>
              <p className="text-sm mt-1">Events will appear here as IR sensors detect movement.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left">
                    <th className="px-4 py-3 font-semibold">Time</th>
                    <th className="px-4 py-3 font-semibold">Event</th>
                    <th className="px-4 py-3 font-semibold">Device</th>
                    <th className="px-4 py-3 font-semibold">Location</th>
                    <th className="px-4 py-3 font-semibold text-center">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log._id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">{getEventBadge(log.eventType)}</td>
                      <td className="px-4 py-3 font-mono text-xs">{log.deviceId || '—'}</td>
                      <td className="px-4 py-3">{log.location || '—'}</td>
                      <td className="px-4 py-3 text-center font-bold text-lg">{log.personCount ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OccupancyMonitor;
