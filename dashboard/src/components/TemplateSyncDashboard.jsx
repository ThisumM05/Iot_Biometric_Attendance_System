import React, { useState, useEffect } from 'react';
import { Users, Server, CheckCircle, Clock, AlertTriangle, RotateCcw, Globe, Fingerprint, Zap, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "react-hot-toast";
import io from 'socket.io-client';

const API_BASE = 'http://localhost:5000/api';
const SOCKET_URL = 'http://localhost:5000';

/**
 * Template Sync Dashboard Component
 * Provides overview and management of fingerprint template synchronization across all devices
 */
const TemplateSyncDashboard = () => {
    const [syncOverview, setSyncOverview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [retryingUser, setRetryingUser] = useState(null);
    const [socket, setSocket] = useState(null);
    const [syncingAll, setSyncingAll] = useState(false);
    const [verifyingSync, setVerifyingSync] = useState(false);
    const [deviceStats, setDeviceStats] = useState(null);

    // Socket connection
    useEffect(() => {
        console.log('[TemplateSync] 🔌 Initializing Socket.io connection to', SOCKET_URL);

        const newSocket = io(SOCKET_URL, {
            transports: ['polling'], // Use polling only to avoid WebSocket upgrade errors
            timeout: 20000,
            reconnection: true,
            reconnectionDelay: 2000,
            reconnectionAttempts: 3,
            autoConnect: true,
            upgrade: false // Disable automatic upgrade to WebSocket
        });

        setSocket(newSocket);

        newSocket.on('connect', () => {
            console.log('[TemplateSync] ✅ Socket connected successfully! Socket ID:', newSocket.id);
        });

        newSocket.on('disconnect', (reason) => {
            console.warn('[TemplateSync] ⚠️  Socket disconnected. Reason:', reason);
            if (reason === 'io server disconnect') {
                console.log('[TemplateSync] 🔄 Server closed connection. Reconnecting...');
                newSocket.connect();
            }
        });

        newSocket.on('connect_error', (error) => {
            console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.error('[TemplateSync] ❌ SOCKET CONNECTION ERROR');
            console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.error('Error Type:', error.type || 'Unknown');
            console.error('Error Message:', error.message || 'No message');
            console.error('Server URL:', SOCKET_URL);
            console.error('');
            console.error('🔍 Troubleshooting Steps:');
            console.error('1. Is the server running? Check: http://localhost:5000');
            console.error('2. Run: netstat -ano | findstr :5000');
            console.error('3. Check server terminal for errors');
            console.error('4. Try restarting the server: npm start');
            console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        });

        newSocket.on('reconnect_attempt', (attemptNumber) => {
            console.log(`[TemplateSync] 🔄 Reconnection attempt ${attemptNumber}...`);
        });

        newSocket.on('reconnect_failed', () => {
            console.error('[TemplateSync] ❌ Failed to reconnect after multiple attempts');
        });

        return () => {
            console.log('[TemplateSync] 🔌 Cleaning up socket connection...');
            newSocket.removeAllListeners();
            newSocket.close();
        };
    }, []);

    useEffect(() => {
        fetchSyncOverview();
        fetchDeviceStats();

        // Socket listeners for real-time updates
        if (socket) {
            socket.on('template-sync-update', handleSyncUpdate);
            socket.on('enrollment-success', fetchSyncOverview);
            socket.on('global-sync-update', handleGlobalSyncUpdate);

            return () => {
                socket.off('template-sync-update', handleSyncUpdate);
                socket.off('enrollment-success', fetchSyncOverview);
                socket.off('global-sync-update', handleGlobalSyncUpdate);
            };
        }
    }, [socket]);

    const handleSyncUpdate = (data) => {
        // Refresh overview when sync events occur
        fetchSyncOverview();

        const usernameText = data.username ? ` for ${data.username}` : '';
        const deviceName = data.scannerID || data.deviceMAC;

        if (data.success) {
            toast.success(`Device ${deviceName} synced successfully${usernameText}`);
        } else {
            toast.error(`Device ${deviceName} sync failed${usernameText}`);
        }
    };

    const handleGlobalSyncUpdate = (data) => {
        console.log('[TemplateSync] Global sync update:', data);

        if (data.success) {
            toast.success(`Global sync completed: ${data.successCount} operations successful`);
        } else {
            toast.error('Global sync failed');
        }

        // Refresh data after global sync
        fetchSyncOverview();
        fetchDeviceStats();
        setSyncingAll(false);
    };

    const fetchSyncOverview = async () => {
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`${API_BASE}/sync/overview`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                setSyncOverview(data.data);
            }
        } catch (error) {
            console.error('Error fetching sync overview:', error);
            toast.error('Failed to load sync overview');
        } finally {
            setLoading(false);
        }
    };

    const retryUserSync = async (userId) => {
        setRetryingUser(userId);
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`${API_BASE}/sync/retry/${userId}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                toast.success('Sync retry initiated');
                fetchSyncOverview();
            } else {
                throw new Error('Retry failed');
            }
        } catch (error) {
            toast.error('Failed to retry sync');
        } finally {
            setRetryingUser(null);
        }
    };

    const syncAllTemplates = async () => {
        setSyncingAll(true);
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`${API_BASE}/sync/sync-all`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                toast.success('Global template sync started - all templates will sync to all devices');
                fetchSyncOverview();
                fetchDeviceStats();
            } else {
                throw new Error('Global sync failed');
            }
        } catch (error) {
            toast.error('Failed to start global sync');
            console.error('Global sync error:', error);
        } finally {
            setSyncingAll(false);
        }
    };

    const verifySyncStatus = async () => {
        setVerifyingSync(true);
        try {
            const response = await fetch(`${API_BASE}/sync/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            if (response.ok) {
                toast.success('Sync verification started - checking all devices');
                setTimeout(() => {
                    fetchSyncOverview();
                    fetchDeviceStats();
                }, 3000); // Allow time for verification to complete
            } else {
                throw new Error('Sync verification failed');
            }
        } catch (error) {
            toast.error('Failed to verify sync status');
            console.error('Sync verification error:', error);
        } finally {
            setVerifyingSync(false);
        }
    };

    const fetchDeviceStats = async () => {
        try {
            const response = await fetch(`${API_BASE}/devices/health/summary`);
            if (response.ok) {
                const data = await response.json();
                setDeviceStats(data);
            }
        } catch (error) {
            console.error('Error fetching device stats:', error);
        }
    };

    const getSyncStatusColor = (status) => {
        switch (status) {
            case 'synced': return 'text-green-600 bg-green-100';
            case 'pending': return 'text-yellow-600 bg-yellow-100';
            case 'failed': return 'text-red-600 bg-red-100';
            default: return 'text-gray-600 bg-gray-100';
        }
    };

    const getHealthColor = (health) => {
        if (health >= 90) return 'text-green-600';
        if (health >= 70) return 'text-yellow-600';
        return 'text-red-600';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!syncOverview) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center py-8">
                    <p className="text-muted-foreground">No sync data available</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* System Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="flex items-center p-6">
                        <Users className="h-8 w-8 text-blue-600 mr-3" />
                        <div>
                            <p className="text-2xl font-bold">{syncOverview.totalEnrolledUsers}</p>
                            <p className="text-xs text-muted-foreground">Enrolled Users</p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="flex items-center p-6">
                        <CheckCircle className="h-8 w-8 text-green-600 mr-3" />
                        <div>
                            <p className="text-2xl font-bold">{syncOverview.systemStats.totalSyncedConnections}</p>
                            <p className="text-xs text-muted-foreground">Synced Connections</p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="flex items-center p-6">
                        <Clock className="h-8 w-8 text-yellow-600 mr-3" />
                        <div>
                            <p className="text-2xl font-bold">{syncOverview.systemStats.totalPendingConnections}</p>
                            <p className="text-xs text-muted-foreground">Pending Syncs</p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="flex items-center p-6">
                        <AlertTriangle className="h-8 w-8 text-red-600 mr-3" />
                        <div>
                            <p className="text-2xl font-bold">{syncOverview.systemStats.totalFailedConnections}</p>
                            <p className="text-xs text-muted-foreground">Failed Syncs</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* System Health */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Globe className="h-5 w-5" />
                        System Sync Health
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-4">
                        <div className="flex-1">
                            <div className="flex justify-between text-sm mb-2">
                                <span>Overall Sync Health</span>
                                <span className={`font-semibold ${getHealthColor(syncOverview.systemStats.overallSyncHealth)}`}>
                                    {syncOverview.systemStats.overallSyncHealth}%
                                </span>
                            </div>
                            <Progress
                                value={syncOverview.systemStats.overallSyncHealth}
                                className="h-3"
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button
                                onClick={syncAllTemplates}
                                variant="default"
                                size="sm"
                                disabled={syncingAll}
                            >
                                {syncingAll ? (
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                                ) : (
                                    <Zap className="h-4 w-4 mr-2" />
                                )}
                                {syncingAll ? 'Syncing...' : 'Sync All'}
                            </Button>
                            <Button
                                onClick={verifySyncStatus}
                                variant="outline"
                                size="sm"
                                disabled={verifyingSync}
                            >
                                {verifyingSync ? (
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                                ) : (
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                )}
                                {verifyingSync ? 'Verifying...' : 'Verify Sync'}
                            </Button>
                            <Button onClick={() => { fetchSyncOverview(); fetchDeviceStats(); }} variant="outline" size="sm">
                                <RotateCcw className="h-4 w-4 mr-2" />
                                Refresh
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Device Fingerprint Counts */}
            {deviceStats && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Server className="h-5 w-5" />
                            Device Fingerprint Status
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="text-center p-4 border rounded">
                                <p className="text-2xl font-bold text-blue-600">{deviceStats.active}</p>
                                <p className="text-sm text-muted-foreground">Active Devices</p>
                            </div>
                            <div className="text-center p-4 border rounded">
                                <p className="text-2xl font-bold text-green-600">
                                    {syncOverview?.totalEnrolledUsers || 0}
                                </p>
                                <p className="text-sm text-muted-foreground">Expected Templates</p>
                            </div>
                            <div className="text-center p-4 border rounded">
                                <p className="text-2xl font-bold text-purple-600">
                                    {syncOverview?.systemStats?.totalSyncedConnections || 0}
                                </p>
                                <p className="text-sm text-muted-foreground">Total Synced</p>
                            </div>
                        </div>
                        <div className="mt-4 text-sm text-muted-foreground">
                            <p>• Each active device should have {syncOverview?.totalEnrolledUsers || 0} fingerprint templates</p>
                            <p>• Use "Sync All" to push all existing templates to all devices</p>
                            <p>• Use "Verify Sync" to check and auto-fix any missing templates</p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Users Sync Status Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Fingerprint className="h-5 w-5" />
                        User Synchronization Status
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>User</TableHead>
                                <TableHead>Global FP ID</TableHead>
                                <TableHead>Devices</TableHead>
                                <TableHead>Sync Health</TableHead>
                                <TableHead>Enrolled</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {syncOverview.users.map((user) => (
                                <TableRow key={user.userId}>
                                    <TableCell>
                                        <div className="font-medium">{user.username}</div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="font-mono">
                                            {user.globalFingerprintId || 'N/A'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex gap-2 text-sm">
                                            <span className="text-green-600">✓ {user.syncedDevices}</span>
                                            {user.pendingDevices > 0 && (
                                                <span className="text-yellow-600">⏳ {user.pendingDevices}</span>
                                            )}
                                            {user.failedDevices > 0 && (
                                                <span className="text-red-600">✗ {user.failedDevices}</span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Progress
                                                value={user.syncHealth}
                                                className="h-2 w-16"
                                            />
                                            <span className={`text-sm font-medium ${getHealthColor(user.syncHealth)}`}>
                                                {user.syncHealth}%
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-xs text-muted-foreground">
                                            {user.enrollmentDate ?
                                                new Date(user.enrollmentDate).toLocaleDateString() :
                                                'N/A'
                                            }
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex gap-1">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => retryUserSync(user.userId)}
                                                disabled={retryingUser === user.userId || user.failedDevices === 0}
                                            >
                                                {retryingUser === user.userId ? (
                                                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                                ) : (
                                                    <RotateCcw className="h-3 w-3" />
                                                )}
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
};

export default TemplateSyncDashboard;