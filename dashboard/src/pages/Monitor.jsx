import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Video, AlertTriangle, Users } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const Monitor = () => {
    const { mac } = useParams();
    const navigate = useNavigate();
    const [device, setDevice] = useState(null);
    const [stats, setStats] = useState({ faceCount: 0, fps: 0, lastUpdate: 0 });
    const [deviceStatus, setDeviceStatus] = useState('connecting');
    const [alerts, setAlerts] = useState([]);
    const socketRef = useRef(null);
    const frameCountRef = useRef(0);
    const lastFpsTimeRef = useRef(Date.now());

    // Fetch device details to get IP address
    const fetchDevice = async () => {
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`http://localhost:5000/api/cameras/${mac}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setDevice(data.camera);
            }
        } catch (error) {
            console.error('Error fetching camera details:', error);
        }
    };

    useEffect(() => {
        if (mac) {
            fetchDevice();
        }
    }, [mac]);

    useEffect(() => {
        // Connect to Socket.IO for METADATA only (Server processing results)
        const socket = io('http://localhost:5000', {
            transports: ['websocket', 'polling'], // Allow polling fallback
            reconnection: true,
            reconnectionDelay: 1000
        });
        socketRef.current = socket;

        // Log connection attempt for the client-side monitor
        console.log(`Attempting to connect to monitor socket for MAC: ${mac}`);

        socket.on('connect', () => {
            console.log('Connected to monitor socket');
            setDeviceStatus('connected');
        });

        socket.on('disconnect', () => {
            console.log('Disconnected from monitor socket');
            setDeviceStatus('disconnected');
        });

        socket.on('camera:frame', (data) => {
            console.log(`[Monitor] 📡 Received camera:frame - Device: ${data.deviceId}, URL Mac: ${mac}, faceCount: ${data.faceCount}`);

            if (!data.deviceId || !mac) {
                console.warn('[Monitor] ⚠️ Missing deviceId or mac in frame data');
                return;
            }

            if (data.deviceId.replace(/:/g, '').toLowerCase() === mac.replace(/:/g, '').toLowerCase()) {
                console.log(`[Monitor] ✅ MAC Match! (${data.deviceId} vs ${mac})`);
                // Increment frame count and update total frames in real-time
                frameCountRef.current++;
                setStats(prev => ({
                    ...prev,
                    faceCount: data.faceCount,
                    totalFrames: (prev.totalFrames || 0) + 1
                }));

                const now = Date.now();
                const delta = now - lastFpsTimeRef.current;

                // Update FPS every second
                if (delta >= 1000) {
                    const currentFps = ((frameCountRef.current * 1000) / delta).toFixed(1);
                    console.log(`[Monitor] 📊 FPS Update: ${currentFps} (Total: ${frameCountRef.current} frames)`);

                    setStats(prev => ({
                        ...prev,
                        fps: currentFps,
                        lastUpdate: now
                    }));

                    frameCountRef.current = 0;
                    lastFpsTimeRef.current = now;
                }
            }
        });

        socket.on('security:alert', (alert) => {
            if (alert.deviceId?.toLowerCase() === mac?.toLowerCase()) {
                const newAlert = {
                    id: Date.now(),
                    message: alert.type === 'TAILGATING' ? `Tailgating Detected! (${alert.faceCount} people)` : 'Security Alert',
                    type: 'destructive'
                };
                setAlerts(prev => [newAlert, ...prev].slice(0, 5));

                // Clear alert after 5s
                setTimeout(() => {
                    setAlerts(prev => prev.filter(a => a.id !== newAlert.id));
                }, 5000);
            }
        });

        // Listen for Automatic IP Updates from Camera Registration
        socket.on('camera-ip-update', (data) => {
            if (data.deviceMAC?.toLowerCase() === mac?.toLowerCase()) {
                console.log(`[Monitor] 🔄 Camera IP Auto-Updated: ${data.ipAddress}`);
                // Refresh local device data
                setDevice(prev => prev ? ({
                    ...prev,
                    ipAddress: data.ipAddress,
                    streamURL: data.streamURL
                }) : prev);
            }
        });

        return () => {
            if (socketRef.current) socketRef.current.disconnect();
        };
    }, [mac]);

    const streamUrl = device?.ipAddress ? `http://${device.ipAddress}:81/stream` : null;

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={() => navigate('/devices')}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <h1 className="text-3xl font-bold tracking-tight">Live Monitor</h1>
                <div className={`px-3 py-1 rounded-full text-sm ${deviceStatus === 'connected' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                    {deviceStatus === 'connected' ? 'Server Connected' : 'Disconnected'}
                </div>
            </div>

            <div className="flex flex-col lg:flex-row items-start gap-6">
                {/* Camera Stream Column */}
                <Card className="w-fit overflow-hidden border-slate-200 dark:border-slate-800 shadow-sm">
                    <CardHeader className="p-4 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
                        <CardTitle className="flex items-center gap-2 text-base font-semibold">
                            <Video className="h-4 w-4 text-indigo-500" />
                            Live Feed: {mac?.slice(-5)}
                        </CardTitle>
                    </CardHeader>
                    {/* Tightened container to fit QVGA 320x240 exactly */}
                    <CardContent className="p-0 flex flex-col items-center justify-center bg-black overflow-hidden relative group">
                        {streamUrl ? (
                            <img
                                src={streamUrl}
                                alt="Live Stream"
                                className="h-[240px] min-w-[320px] object-contain" // QVGA Standard
                                onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src = ''; // Clear source to show fallback
                                    console.error('Stream failed to load');
                                }}
                            />
                        ) : (
                            <div className="h-[240px] min-w-[320px] text-slate-400 dark:text-slate-500 flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-900">
                                <Video className="h-12 w-12 mb-2 opacity-50" />
                                <p className="text-sm">Waiting for device IP...</p>
                            </div>
                        )}

                        {stats.faceCount > 0 && (
                            <div className="absolute top-2 right-2 bg-yellow-500 text-black px-3 py-1 rounded-md flex items-center gap-2 font-bold text-xs ring-2 ring-yellow-400 animate-pulse">
                                <Users className="h-3 w-3" />
                                <span>{stats.faceCount} DETECTED</span>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Stats & Alerts - Right Column (Stretches to match height) */}
                <div className="flex-1 self-stretch flex flex-col gap-6 w-full">
                    <Card className="h-full flex flex-col border-slate-200 dark:border-slate-800 shadow-sm">
                        <CardHeader className="p-4">
                            <CardTitle className="text-base font-semibold">Real-time Stats</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 space-y-3 flex-1 flex flex-col justify-center">
                            <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800">
                                <span className="text-sm text-slate-500 dark:text-slate-400">Faces Detected</span>
                                <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{stats.faceCount}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800">
                                <span className="text-sm text-slate-500 dark:text-slate-400">Total Frames</span>
                                <span className="font-mono text-base text-slate-700 dark:text-slate-200">{stats.totalFrames || 0}</span>
                            </div>

                            <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800">
                                <span className="text-sm text-slate-500 dark:text-slate-400">Processing FPS</span>
                                <span className="font-mono text-base text-emerald-600 dark:text-emerald-400 font-bold">{stats.fps || 0}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800">
                                <span className="text-sm text-slate-500 dark:text-slate-400">Camera IP</span>
                                <span className="font-mono text-xs text-slate-600 dark:text-slate-400">{device?.ipAddress || '--'}</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Alerts shown below stats if present */}
                    {alerts.length > 0 && (
                        <div className="space-y-2">
                            {alerts.map(alert => (
                                <Alert key={alert.id} variant="destructive" className="py-2 border-l-4">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle className="text-xs font-bold leading-tight">TAILGATING ALERT</AlertTitle>
                                    <AlertDescription className="text-xs">{alert.message}</AlertDescription>
                                </Alert>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Monitor;
