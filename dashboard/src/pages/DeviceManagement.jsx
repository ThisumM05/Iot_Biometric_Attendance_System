import React, { useState, useEffect } from 'react';
import {
    Server,
    Wifi,
    WifiOff,
    Shield,
    Clock,
    CheckCircle,
    XCircle,
    AlertTriangle,
    Unlock,
    Camera,
    Fingerprint,
    Activity,
    Plus,
    Lock,
    LockOpen,
    Cpu,
    MemoryStick,
    Radio,
    Zap,
    Timer,
    Trash2,
    Video,
    Eye,
    EyeOff
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import io from 'socket.io-client';
import DeviceCardSkeleton from '@/components/DeviceCardSkeleton';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';
const SOCKET_URL = 'http://localhost:5000';

const DeviceManagement = () => {
    const [loading, setLoading] = useState(true);
    const [clusters, setClusters] = useState([]);
    const [pendingDevices, setPendingDevices] = useState([]);
    const [healthSummary, setHealthSummary] = useState({
        total: 0,
        active: 0,
        offline: 0,
        pending: 0,
        healthPercentage: 0
    });
    const [socket, setSocket] = useState(null);
    const [approvalDialog, setApprovalDialog] = useState({ open: false, device: null });
    const [unlockDialog, setUnlockDialog] = useState({ open: false, cluster: null });
    const [createClusterDialog, setCreateClusterDialog] = useState(false);
    const [clearTemplatesDialog, setClearTemplatesDialog] = useState({ open: false, device: null });
    const [syncVerificationStatus, setSyncVerificationStatus] = useState({
        lastRun: null,
        isRunning: false,
        devicesInSync: 0,
        devicesOutOfSync: 0,
        totalDevices: 0,
        issues: []
    });
    // Object detection state per camera device (deviceMAC -> boolean, true = enabled)
    const [objectDetectionStates, setObjectDetectionStates] = useState({});

    // Socket.io connection
    useEffect(() => {
        const newSocket = io(SOCKET_URL);
        setSocket(newSocket);

        newSocket.on('connect', () => {
            console.log('[DeviceMgmt] Socket connected');
        });

        // Real-time device heartbeat updates
        newSocket.on('device-heartbeat', (data) => {
            console.log('[DeviceMgmt] Device heartbeat:', data);

            // Update device status in clusters
            setClusters(prev => prev.map(cluster => {
                // Update cluster door lock state if this is the door control device
                let updatedCluster = { ...cluster };
                if (data.payload && data.payload.doorLockState &&
                    cluster.doorControlDevice === data.deviceMAC) {
                    updatedCluster.doorLockState = data.payload.doorLockState;
                }

                // Update device data
                if (cluster.clusterID === data.clusterID ||
                    cluster.deviceDetails?.some(d => d.deviceMAC === data.deviceMAC)) {

                    updatedCluster.deviceDetails = cluster.deviceDetails?.map(device =>
                        device.deviceMAC === data.deviceMAC
                            ? {
                                ...device,
                                status: data.status || 'ACTIVE',
                                isOnline: true,
                                heartbeatData: data.payload, // Store complete payload
                                healthMetrics: data.healthMetrics // Keep old format for compatibility
                            }
                            : device
                    );
                }

                return updatedCluster;
            }));

            fetchHealthSummary();
        });

        // Cluster status updates
        newSocket.on('cluster-status-update', (data) => {
            console.log('[DeviceMgmt] Cluster status update:', data);
            setClusters(prev => prev.map(cluster =>
                cluster.clusterID === data.clusterID
                    ? { ...cluster, status: data.status }
                    : cluster
            ));
        });

        // New pending device
        newSocket.on('device-pending-approval', (data) => {
            console.log('[DeviceMgmt] New pending device:', data);
            fetchPendingDevices();
        });

        // Device approved
        newSocket.on('device-approved', (data) => {
            console.log('[DeviceMgmt] Device approved:', data);
            fetchClusters();
            fetchPendingDevices();
            fetchHealthSummary();
        });

        // Devices marked offline
        newSocket.on('devices-offline', (data) => {
            console.log('[DeviceMgmt] Devices offline:', data);
            fetchClusters();
            fetchHealthSummary();
        });

        // Device templates cleared
        newSocket.on('device-templates-cleared', (data) => {
            console.log('[DeviceMgmt] Device templates cleared:', data);
            alert(`Templates cleared successfully on ${data.deviceMAC || 'device'}`);
            // Optionally refresh data
            fetchClusters();
        });

        // Sync verification results
        newSocket.on('sync-verification-result', (data) => {
            console.log('[DeviceMgmt] Sync verification result:', data);
            setSyncVerificationStatus({
                lastRun: data.timestamp,
                isRunning: false,
                devicesInSync: data.devicesInSync,
                devicesOutOfSync: data.syncIssues.length,
                totalDevices: data.totalDevices,
                issues: data.syncIssues
            });
        });

        return () => {
            newSocket.disconnect();
        };
    }, []);

    // Initial data fetch
    useEffect(() => {
        fetchAllData();
    }, []);

    const fetchAllData = async () => {
        setLoading(true);
        await Promise.all([
            fetchClusters(),
            fetchPendingDevices(),
            fetchHealthSummary()
        ]);
        setLoading(false);
    };

    const fetchClusters = async () => {
        try {
            const response = await fetch(`${API_BASE}/devices/clusters`);
            const data = await response.json();
            setClusters(data);
        } catch (error) {
            console.error('[DeviceMgmt] Error fetching clusters:', error);
        }
    };

    const fetchPendingDevices = async () => {
        try {
            const response = await fetch(`${API_BASE}/devices/pending`);
            const data = await response.json();
            setPendingDevices(data);
        } catch (error) {
            console.error('[DeviceMgmt] Error fetching pending devices:', error);
        }
    };

    const fetchHealthSummary = async () => {
        try {
            const response = await fetch(`${API_BASE}/devices/health/summary`);
            const data = await response.json();
            setHealthSummary(data);
        } catch (error) {
            console.error('[DeviceMgmt] Error fetching health summary:', error);
        }
    };

    const handleApproveDevice = async (formData) => {
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`${API_BASE}/devices/approve/${approvalDialog.device.deviceMAC}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                setApprovalDialog({ open: false, device: null });
                fetchAllData();
            }
        } catch (error) {
            console.error('[DeviceMgmt] Error approving device:', error);
        }
    };

    const handleRejectDevice = async (deviceMAC) => {
        try {
            const token = localStorage.getItem('authToken');
            await fetch(`${API_BASE}/devices/reject/${deviceMAC}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            fetchPendingDevices();
        } catch (error) {
            console.error('[DeviceMgmt] Error rejecting device:', error);
        }
    };

    const handleUnlockDoor = async (clusterID, duration = 5000) => {
        try {
            const token = localStorage.getItem('authToken');
            await fetch(`${API_BASE}/devices/unlock/${clusterID}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ duration })
            });
            setUnlockDialog({ open: false, cluster: null });
        } catch (error) {
            console.error('[DeviceMgmt] Error unlocking door:', error);
        }
    };

    // Trigger manual sync verification
    const triggerSyncVerification = async () => {
        try {
            setSyncVerificationStatus(prev => ({ ...prev, isRunning: true }));

            const response = await fetch(`${API_BASE}/sync/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) {
                throw new Error('Failed to trigger sync verification');
            }

            console.log('[DeviceMgmt] Sync verification triggered manually');
        } catch (error) {
            console.error('[DeviceMgmt] Error triggering sync verification:', error);
            setSyncVerificationStatus(prev => ({ ...prev, isRunning: false }));
            alert(`Error: ${error.message}`);
        }
    };

    const handleCreateCluster = async (formData) => {
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`${API_BASE}/devices/clusters`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                setCreateClusterDialog(false);
                fetchClusters();
            } else {
                const error = await response.json();
                console.error('[DeviceMgmt] Error creating cluster:', error);
                alert(error.error || 'Failed to create cluster');
            }
        } catch (error) {
            console.error('[DeviceMgmt] Error creating cluster:', error);
            alert('Failed to create cluster');
        }
    };

    const handleClearTemplates = async () => {
        try {
            const { device } = clearTemplatesDialog;
            if (!device) return;

            const token = localStorage.getItem('authToken');
            const response = await fetch(`${API_BASE}/sync/device/${device.deviceMAC}/clear`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                console.log(`[DeviceMgmt] Clear templates request sent for device ${device.deviceMAC}`);
                alert(`Template clear request sent to ${device.deviceRole || device.scannerID}. The device will clear all templates.`);
            } else {
                const error = await response.json();
                console.error('[DeviceMgmt] Error clearing templates:', error);
                alert(error.error || 'Failed to send clear templates request');
            }
        } catch (error) {
            console.error('[DeviceMgmt] Error clearing templates:', error);
            alert('Failed to clear templates');
        } finally {
            setClearTemplatesDialog({ open: false, device: null });
        }
    };

    const handleObjectDetectionToggle = async (device) => {
        const currentEnabled = objectDetectionStates[device.deviceMAC] !== false; // default true
        const newEnabled = !currentEnabled;

        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`${API_BASE}/cameras/${device.deviceMAC}/object-detection`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ enabled: newEnabled })
            });

            if (response.ok) {
                setObjectDetectionStates(prev => ({
                    ...prev,
                    [device.deviceMAC]: newEnabled
                }));
                console.log(`[DeviceMgmt] Object detection ${newEnabled ? 'enabled' : 'disabled'} for ${device.deviceMAC}`);
            } else {
                const err = await response.json();
                alert(err.message || 'Failed to toggle object detection');
            }
        } catch (error) {
            console.error('[DeviceMgmt] Error toggling object detection:', error);
            alert('Failed to send command to device');
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'ACTIVE':
            case 'OPERATIONAL':
                return 'bg-green-500/10 text-green-600 dark:text-green-400';
            case 'OFFLINE':
                return 'bg-red-500/10 text-red-600 dark:text-red-400';
            case 'DEGRADED':
                return 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400';
            case 'PENDING':
                return 'bg-blue-500/10 text-blue-600 dark:text-blue-400';
            case 'MAINTENANCE':
                return 'bg-gray-500/10 text-gray-600 dark:text-gray-400';
            default:
                return 'bg-gray-500/10 text-gray-600 dark:text-gray-400';
        }
    };

    const getDeviceIcon = (capabilities) => {
        if (capabilities?.includes('camera')) return Camera;
        if (capabilities?.includes('fingerprint')) return Fingerprint;
        return Server;
    };

    // Loading state is now handled within the render method to show skeletons
    // instead of a full page spinner


    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Device Management</h1>
                    <p className="text-muted-foreground mt-1">Manage ESP32 devices and clusters</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => setCreateClusterDialog(true)} variant="default">
                        <Plus className="h-4 w-4 mr-2" />
                        Create Cluster
                    </Button>
                    <Button onClick={fetchAllData} variant="outline">
                        <Activity className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Health Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-center">
                            <Server className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                            <p className="text-2xl font-bold">{healthSummary.total}</p>
                            <p className="text-sm text-muted-foreground">Total Devices</p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="text-center">
                            <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                            <p className="text-2xl font-bold">{healthSummary.active}</p>
                            <p className="text-sm text-muted-foreground">Active</p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="text-center">
                            <WifiOff className="h-8 w-8 mx-auto mb-2 text-red-500" />
                            <p className="text-2xl font-bold">{healthSummary.offline}</p>
                            <p className="text-sm text-muted-foreground">Offline</p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="text-center">
                            <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                            <p className="text-2xl font-bold">{healthSummary.pending}</p>
                            <p className="text-sm text-muted-foreground">Pending</p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="text-center">
                            <Activity className="h-8 w-8 mx-auto mb-2 text-purple-500" />
                            <p className="text-2xl font-bold">{healthSummary.healthPercentage}%</p>
                            <p className="text-sm text-muted-foreground">Health</p>
                        </div>
                    </CardContent>
                </Card>

                {/* Sync Status Card */}
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-center">
                            <Fingerprint className={`h-8 w-8 mx-auto mb-2 ${syncVerificationStatus.devicesOutOfSync === 0 ? 'text-green-500' : 'text-red-500'
                                }`} />
                            <p className="text-2xl font-bold">
                                {syncVerificationStatus.devicesInSync}/{syncVerificationStatus.totalDevices}
                            </p>
                            <p className="text-sm text-muted-foreground">FP Synced</p>
                            {syncVerificationStatus.lastRun && (
                                <p className="text-xs text-muted-foreground mt-1">
                                    {new Date(syncVerificationStatus.lastRun).toLocaleTimeString()}
                                </p>
                            )}
                            <Button
                                size="sm"
                                variant="outline"
                                className="mt-2"
                                onClick={triggerSyncVerification}
                                disabled={syncVerificationStatus.isRunning}
                            >
                                {syncVerificationStatus.isRunning ? 'Verifying...' : 'Verify Sync'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="clusters" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="clusters">Clusters</TabsTrigger>
                    <TabsTrigger value="pending">
                        Pending Approval
                        {pendingDevices.length > 0 && (
                            <Badge className="ml-2" variant="destructive">{pendingDevices.length}</Badge>
                        )}
                    </TabsTrigger>
                </TabsList>

                {/* Clusters Tab */}
                <TabsContent value="clusters" className="space-y-4">
                    {loading ? (
                        // Skeleton Loading State
                        <div className="space-y-4">
                            {[1, 2, 3].map((i) => (
                                <DeviceCardSkeleton key={i} />
                            ))}
                        </div>
                    ) : clusters.length === 0 ? (
                        <Card>
                            <CardContent className="pt-6">
                                <p className="text-center text-muted-foreground">No clusters found</p>
                            </CardContent>
                        </Card>
                    ) : (
                        clusters.map(cluster => (
                            <Card key={cluster.clusterID}>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle className="flex items-center gap-2">
                                                <Shield className="h-5 w-5" />
                                                {cluster.clusterName}
                                                {cluster.doorLockState && (
                                                    cluster.doorLockState === 'LOCKED' ? (
                                                        <Lock className="h-4 w-4 text-red-500" />
                                                    ) : (
                                                        <LockOpen className="h-4 w-4 text-green-500" />
                                                    )
                                                )}
                                            </CardTitle>
                                            <p className="text-sm text-muted-foreground mt-1">
                                                {cluster.location} • {cluster.clusterID}
                                                {cluster.doorLockState && (
                                                    <span className={`ml-2 px-2 py-1 rounded-full text-xs ${cluster.doorLockState === 'LOCKED'
                                                        ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                                                        : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                                                        }`}>
                                                        {cluster.doorLockState}
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge className={getStatusColor(cluster.status)}>
                                                {cluster.status}
                                            </Badge>
                                            <Button
                                                size="sm"
                                                onClick={() => setUnlockDialog({ open: true, cluster })}
                                                disabled={cluster.status !== 'OPERATIONAL'}
                                            >
                                                <Unlock className="h-4 w-4 mr-2" />
                                                Unlock
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {cluster.deviceDetails?.map(device => {
                                            const DeviceIcon = getDeviceIcon(device.capabilities);
                                            return (
                                                <div
                                                    key={device.deviceMAC}
                                                    className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                                                >
                                                    <div className="flex items-start justify-between mb-3 relative">
                                                        <div className="flex items-center gap-2">
                                                            <DeviceIcon className="h-5 w-5 text-primary" />
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <p className="font-medium">{device.deviceRole}</p>
                                                                    {!device.heartbeatData && (
                                                                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                                                                    )}
                                                                </div>
                                                                <p className="text-xs text-muted-foreground">{device.deviceType}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <Badge className={getStatusColor(device.status)}>
                                                                {device.isOnline ? (
                                                                    <Wifi className="h-3 w-3 mr-1" />
                                                                ) : (
                                                                    <WifiOff className="h-3 w-3 mr-1" />
                                                                )}
                                                                {device.status}
                                                            </Badge>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2 text-sm">
                                                        <div className="flex justify-between">
                                                            <span className="text-muted-foreground">Scanner ID:</span>
                                                            <span className="font-mono">{device.scannerID}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-muted-foreground">MAC:</span>
                                                            <span className="font-mono text-xs">{device.deviceMAC}</span>
                                                        </div>

                                                        {/* Enhanced Heartbeat Data */}
                                                        {device.heartbeatData && (
                                                            <>
                                                                <div className="flex justify-between items-center">
                                                                    <span className="text-muted-foreground flex items-center gap-1">
                                                                        <Timer className="h-3 w-3" />
                                                                        Uptime:
                                                                    </span>
                                                                    <span>{Math.floor(device.heartbeatData.uptime / 60000)} min</span>
                                                                </div>

                                                                <div className="flex justify-between items-center">
                                                                    <span className="text-muted-foreground flex items-center gap-1">
                                                                        <Wifi className="h-3 w-3" />
                                                                        WiFi:
                                                                    </span>
                                                                    <span className={`${device.heartbeatData.wifiSignal > -50 ? 'text-green-600' :
                                                                        device.heartbeatData.wifiSignal > -70 ? 'text-yellow-600' : 'text-red-600'
                                                                        }`}>
                                                                        {device.heartbeatData.wifiSignal} dBm
                                                                    </span>
                                                                </div>

                                                                <div className="flex justify-between items-center">
                                                                    <span className="text-muted-foreground flex items-center gap-1">
                                                                        <MemoryStick className="h-3 w-3" />
                                                                        Free Heap:
                                                                    </span>
                                                                    <span>{Math.round(device.heartbeatData.freeHeap / 1024)} KB</span>
                                                                </div>

                                                                <div className="flex justify-between items-center">
                                                                    <span className="text-muted-foreground flex items-center gap-1">
                                                                        <Fingerprint className="h-3 w-3" />
                                                                        FP Sensor:
                                                                    </span>
                                                                    <span className={`${device.heartbeatData.fpSensorStatus === 'OK' ? 'text-green-600' : 'text-red-600'
                                                                        }`}>
                                                                        {device.heartbeatData.fpSensorStatus}
                                                                    </span>
                                                                </div>

                                                                {/* Fingerprint Count - Show for fingerprint-capable devices */}
                                                                {device.capabilities?.includes('fingerprint') && device.heartbeatData.fingerprintCount !== undefined && (
                                                                    <div className="flex justify-between items-center">
                                                                        <span className="text-muted-foreground flex items-center gap-1">
                                                                            <Fingerprint className="h-3 w-3" />
                                                                            Fingerprints:
                                                                        </span>
                                                                        <Badge
                                                                            variant={device.heartbeatData.fingerprintCount > 0 ? "default" : "secondary"}
                                                                            className="text-xs"
                                                                        >
                                                                            {device.heartbeatData.fingerprintCount} stored
                                                                        </Badge>
                                                                    </div>
                                                                )}

                                                                {/* Camera Status - Only for ESP32-CAM */}
                                                                {device.deviceType === 'ESP32-CAM' && device.heartbeatData.cameraStatus && (
                                                                    <div className="flex justify-between items-center">
                                                                        <span className="text-muted-foreground flex items-center gap-1">
                                                                            <Camera className="h-3 w-3" />
                                                                            Camera:
                                                                        </span>
                                                                        <span className={`${device.heartbeatData.cameraStatus === 'OK' ? 'text-green-600' : 'text-red-600'
                                                                            }`}>
                                                                            {device.heartbeatData.cameraStatus}
                                                                        </span>
                                                                    </div>
                                                                )}

                                                                {/* Relay Status - Only for ESP32 (EXIT nodes) */}
                                                                {device.deviceType === 'ESP32' && device.heartbeatData.relayStatus && (
                                                                    <div className="flex justify-between items-center">
                                                                        <span className="text-muted-foreground flex items-center gap-1">
                                                                            <Zap className="h-3 w-3" />
                                                                            Relay:
                                                                        </span>
                                                                        <span className={`${device.heartbeatData.relayStatus === 'OK' ? 'text-green-600' : 'text-red-600'
                                                                            }`}>
                                                                            {device.heartbeatData.relayStatus}
                                                                        </span>
                                                                    </div>
                                                                )}

                                                                {device.heartbeatData.lastScanTime > 0 && (
                                                                    <div className="flex justify-between items-center">
                                                                        <span className="text-muted-foreground">Last Scan:</span>
                                                                        <span>{Math.floor((Date.now() - device.heartbeatData.lastScanTime) / 60000)} min ago</span>
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}

                                                        {/* Fallback to Skeletons if heartbeatData not available */}
                                                        {!device.heartbeatData && (
                                                            <div className="space-y-3 animate-pulse">
                                                                <div className="flex justify-between items-center">
                                                                    <div className="flex items-center gap-2">
                                                                        <Timer className="h-3 w-3 text-muted-foreground/50" />
                                                                        <Skeleton className="h-3 w-12" />
                                                                    </div>
                                                                    <Skeleton className="h-3 w-16" />
                                                                </div>
                                                                <div className="flex justify-between items-center">
                                                                    <div className="flex items-center gap-2">
                                                                        <Wifi className="h-3 w-3 text-muted-foreground/50" />
                                                                        <Skeleton className="h-3 w-8" />
                                                                    </div>
                                                                    <Skeleton className="h-3 w-20" />
                                                                </div>
                                                                <div className="flex justify-between items-center">
                                                                    <div className="flex items-center gap-2">
                                                                        <MemoryStick className="h-3 w-3 text-muted-foreground/50" />
                                                                        <Skeleton className="h-3 w-16" />
                                                                    </div>
                                                                    <Skeleton className="h-3 w-14" />
                                                                </div>
                                                                <div className="flex justify-between items-center">
                                                                    <div className="flex items-center gap-2">
                                                                        <Fingerprint className="h-3 w-3 text-muted-foreground/50" />
                                                                        <Skeleton className="h-3 w-16" />
                                                                    </div>
                                                                    <Skeleton className="h-3 w-12" />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Capabilities */}
                                                    <div className="flex gap-1 mt-3">
                                                        {device.capabilities?.map(cap => (
                                                            <Badge key={cap} variant="outline" className="text-xs">
                                                                {cap}
                                                            </Badge>
                                                        ))}
                                                    </div>

                                                    {/* Monitor Button for Camera Devices */}
                                                    {device.capabilities?.includes('camera') && (
                                                        <div className="mt-3 space-y-2">
                                                            <Button
                                                                variant="secondary"
                                                                size="sm"
                                                                className="w-full"
                                                                onClick={() => window.location.href = `/devices/${device.deviceMAC}/monitor`}
                                                            >
                                                                <Video className="h-4 w-4 mr-2" />
                                                                Monitor Feed
                                                            </Button>

                                                            {/* Object Detection Toggle */}
                                                            {(() => {
                                                                const detectionEnabled = objectDetectionStates[device.deviceMAC] !== false;
                                                                return (
                                                                    <Button
                                                                        variant={detectionEnabled ? 'outline' : 'default'}
                                                                        size="sm"
                                                                        className={`w-full ${detectionEnabled
                                                                                ? 'border-red-400 text-red-600 hover:bg-red-50 dark:hover:bg-red-950'
                                                                                : 'bg-green-600 hover:bg-green-700 text-white'
                                                                            }`}
                                                                        onClick={() => handleObjectDetectionToggle(device)}
                                                                    >
                                                                        {detectionEnabled ? (
                                                                            <><EyeOff className="h-4 w-4 mr-2" />Disable Detection</>
                                                                        ) : (
                                                                            <><Eye className="h-4 w-4 mr-2" />Enable Detection</>
                                                                        )}
                                                                    </Button>
                                                                );
                                                            })()}
                                                        </div>
                                                    )}

                                                    {/* Clear Templates Button for Fingerprint Devices */}
                                                    {device.capabilities?.includes('fingerprint') && (
                                                        <div className="mt-2">
                                                            <Button
                                                                variant="destructive"
                                                                size="sm"
                                                                className="w-full"
                                                                onClick={() => setClearTemplatesDialog({ open: true, device })}
                                                            >
                                                                <Trash2 className="h-4 w-4 mr-2" />
                                                                Clear All Templates
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </TabsContent>

                {/* Pending Approval Tab */}
                <TabsContent value="pending" className="space-y-4">
                    {pendingDevices.length === 0 ? (
                        <Card>
                            <CardContent className="pt-6">
                                <p className="text-center text-muted-foreground">No pending devices</p>
                            </CardContent>
                        </Card>
                    ) : (
                        pendingDevices.map(device => (
                            <Card key={device.deviceMAC}>
                                <CardContent className="pt-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-medium">{device.deviceType}</p>
                                            <p className="text-sm text-muted-foreground font-mono">{device.deviceMAC}</p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Registered: {new Date(device.registeredAt).toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                onClick={() => setApprovalDialog({ open: true, device })}
                                            >
                                                <CheckCircle className="h-4 w-4 mr-2" />
                                                Approve
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                onClick={() => handleRejectDevice(device.deviceMAC)}
                                            >
                                                <XCircle className="h-4 w-4 mr-2" />
                                                Reject
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </TabsContent>
            </Tabs>

            {/* Approval Dialog */}
            {approvalDialog.open && (
                <ApprovalDialog
                    device={approvalDialog.device}
                    clusters={clusters}
                    onClose={() => setApprovalDialog({ open: false, device: null })}
                    onApprove={handleApproveDevice}
                />
            )}

            {/* Unlock Dialog */}
            {unlockDialog.open && (
                <UnlockDialog
                    cluster={unlockDialog.cluster}
                    onClose={() => setUnlockDialog({ open: false, cluster: null })}
                    onUnlock={handleUnlockDoor}
                />
            )}

            {/* Create Cluster Dialog */}
            {createClusterDialog && (
                <CreateClusterDialog
                    onClose={() => setCreateClusterDialog(false)}
                    onCreate={handleCreateCluster}
                />
            )}

            {/* Clear Templates Confirmation Dialog */}
            {clearTemplatesDialog.open && (
                <ClearTemplatesDialog
                    device={clearTemplatesDialog.device}
                    onClose={() => setClearTemplatesDialog({ open: false, device: null })}
                    onConfirm={handleClearTemplates}
                />
            )}
        </div>
    );
};

// Approval Dialog Component
const ApprovalDialog = ({ device, clusters, onClose, onApprove }) => {
    const [formData, setFormData] = useState({
        clusterID: '',
        deviceRole: '',
        scannerID: '',
        location: ''
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        onApprove(formData);
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Approve Device</DialogTitle>
                    <DialogDescription>
                        Configure and approve device: {device.deviceMAC}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <Label htmlFor="clusterID">Cluster *</Label>
                        <select
                            id="clusterID"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={formData.clusterID}
                            onChange={(e) => setFormData({ ...formData, clusterID: e.target.value })}
                            required
                        >
                            <option value="" className="bg-background text-muted-foreground">Select a cluster...</option>
                            {clusters.map(c => (
                                <option key={c.clusterID} value={c.clusterID} className="bg-background">
                                    {c.clusterName} - {c.clusterID}
                                </option>
                            ))}
                        </select>
                        {clusters.length === 0 && (
                            <p className="text-xs text-amber-500 mt-1">⚠️ No clusters available. Create a cluster first.</p>
                        )}
                    </div>

                    <div>
                        <Label htmlFor="deviceRole">Device Role *</Label>
                        <select
                            id="deviceRole"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={formData.deviceRole}
                            onChange={(e) => setFormData({ ...formData, deviceRole: e.target.value })}
                            required
                        >
                            <option value="" className="bg-background text-muted-foreground">Select device role...</option>
                            <option value="ENTRY" className="bg-background">ENTRY - ESP32-CAM with buzzer & camera</option>
                            <option value="EXIT" className="bg-background">EXIT - ESP32 with relay to unlock door</option>
                        </select>
                    </div>

                    <div>
                        <Label htmlFor="scannerID">Scanner ID *</Label>
                        <Input
                            id="scannerID"
                            placeholder="e.g., SCANNER-IN or SCANNER-OUT"
                            value={formData.scannerID}
                            onChange={(e) => setFormData({ ...formData, scannerID: e.target.value })}
                            required
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            Unique identifier for this fingerprint scanner
                        </p>
                    </div>

                    <div>
                        <Label htmlFor="location">Location (optional)</Label>
                        <Input
                            id="location"
                            placeholder="e.g., Main Entrance"
                            value={formData.location}
                            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        />
                    </div>

                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit">
                            Approve Device
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};

// Unlock Dialog Component
const UnlockDialog = ({ cluster, onClose, onUnlock }) => {
    const [duration, setDuration] = useState(5000);

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Unlock Door</DialogTitle>
                    <DialogDescription>
                        Manually unlock door for: {cluster.clusterName}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div>
                        <Label htmlFor="duration">Unlock Duration (ms)</Label>
                        <Input
                            id="duration"
                            type="number"
                            value={duration}
                            onChange={(e) => setDuration(parseInt(e.target.value))}
                            min={1000}
                            max={30000}
                            step={1000}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            {duration / 1000} seconds
                        </p>
                    </div>

                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button onClick={() => onUnlock(cluster.clusterID, duration)}>
                            <Unlock className="h-4 w-4 mr-2" />
                            Unlock Door
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

// Clear Templates Confirmation Dialog Component
const ClearTemplatesDialog = ({ device, onClose, onConfirm }) => {
    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Clear All Templates</DialogTitle>
                    <DialogDescription>
                        Are you sure you want to clear all fingerprint templates from this device?
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                        <div className="flex gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-amber-600">
                                    Warning: This action cannot be undone
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    All enrolled fingerprint templates will be permanently removed from the device.
                                    Users will need to re-enroll their fingerprints.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Device Role:</span>
                            <span className="font-medium">{device?.deviceRole || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Scanner ID:</span>
                            <span className="font-mono text-xs">{device?.scannerID || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">MAC Address:</span>
                            <span className="font-mono text-xs">{device?.deviceMAC || 'N/A'}</span>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="destructive" onClick={onConfirm}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Clear All Templates
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

// Create Cluster Dialog Component
const CreateClusterDialog = ({ onClose, onCreate }) => {
    const [formData, setFormData] = useState({
        clusterID: '',
        clusterName: '',
        location: '',
        unlockDuration: 5000
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.clusterID.trim() || !formData.clusterName.trim()) {
            alert('Cluster ID and Name are required');
            return;
        }
        onCreate(formData);
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create New Cluster</DialogTitle>
                    <DialogDescription>
                        Create a new door/location cluster for device grouping
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <Label htmlFor="clusterID">Cluster ID *</Label>
                        <Input
                            id="clusterID"
                            placeholder="e.g., DOOR_01, ENTRANCE_A"
                            value={formData.clusterID}
                            onChange={(e) => setFormData({ ...formData, clusterID: e.target.value })}
                            required
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            Unique identifier (uppercase recommended)
                        </p>
                    </div>

                    <div>
                        <Label htmlFor="clusterName">Cluster Name *</Label>
                        <Input
                            id="clusterName"
                            placeholder="e.g., Main Entrance, Back Door"
                            value={formData.clusterName}
                            onChange={(e) => setFormData({ ...formData, clusterName: e.target.value })}
                            required
                        />
                    </div>

                    <div>
                        <Label htmlFor="location">Location</Label>
                        <Input
                            id="location"
                            placeholder="e.g., Building A - Floor 1"
                            value={formData.location}
                            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        />
                    </div>

                    <div>
                        <Label htmlFor="unlockDuration">Default Unlock Duration (ms)</Label>
                        <Input
                            id="unlockDuration"
                            type="number"
                            value={formData.unlockDuration}
                            onChange={(e) => setFormData({ ...formData, unlockDuration: parseInt(e.target.value) })}
                            min={1000}
                            max={30000}
                            step={1000}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            {formData.unlockDuration / 1000} seconds
                        </p>
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit">
                            <Plus className="h-4 w-4 mr-2" />
                            Create Cluster
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default DeviceManagement;
