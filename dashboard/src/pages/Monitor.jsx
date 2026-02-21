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
    useEffect(() => {
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
        fetchDevice();
    }, [mac]);

    useEffect(() => {
        // Connect to Socket.IO for METADATA only (Server processing results)
        const socket = io('http://localhost:5000', {
            transports: ['websocket']
        });
        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('Connected to monitor socket');
            setDeviceStatus('connected');
        });

        socket.on('disconnect', () => {
            console.log('Disconnected from monitor socket');
            setDeviceStatus('disconnected');
        });

        // Listen for METADATA (Face counts, alerts) from Server
        socket.on('camera:frame', (data) => {
            if (data.deviceId === mac) {
                // Calculate "Processing FPS" (how fast server is processing frames)
                frameCountRef.current++;
                const now = Date.now();
                if (now - lastFpsTimeRef.current >= 1000) {
                    setStats(prev => ({
                        ...prev,
                        fps: frameCountRef.current,
                        faceCount: data.faceCount
                    }));
                    frameCountRef.current = 0;
                    lastFpsTimeRef.current = now;
                } else {
                    setStats(prev => ({ ...prev, faceCount: data.faceCount }));
                }
            }
        });

        socket.on('security:alert', (alert) => {
            if (alert.deviceId === mac) {
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
            if (data.deviceMAC === mac) {
                console.log('🔄 Camera IP Auto-Updated:', data.ipAddress);
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Helper Instructions - Left Column */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Video className="h-5 w-5" />
                            Camera Feed ({mac})
                        </CardTitle>
                    </CardHeader>
                    {/* Updated height for low-res feed */}
                    <CardContent className="flex flex-col items-center justify-center min-h-[240px] bg-slate-100 dark:bg-slate-900 rounded-md relative overflow-hidden transition-colors">
                        {streamUrl ? (
                            <img
                                src={streamUrl}
                                alt="Live Stream"
                                className="h-[240px] w-auto object-contain shadow-sm rounded-sm" // Fixed height 240px for QVGA
                                onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src = ''; // Clear source to show fallback
                                    console.error('Stream failed to load');
                                }}
                            />
                        ) : (
                            <div className="text-slate-400 dark:text-slate-500 flex flex-col items-center">
                                <Video className="h-12 w-12 mb-2 opacity-50" />
                                <p>Waiting for device IP...</p>
                            </div>
                        )}

                        {stats.faceCount > 0 && (
                            <div className="absolute top-4 right-4 bg-black/70 text-white px-4 py-2 rounded-full flex items-center gap-2 backdrop-blur-sm animate-pulse border border-yellow-500">
                                <Users className="h-4 w-4 text-yellow-400" />
                                <span className="font-bold">{stats.faceCount} Detected (Server)</span>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Stats & Alerts - Right Column */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Real-time Stats</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900 rounded-lg transition-colors">
                                <span className="text-slate-500 dark:text-slate-400">Faces Detected</span>
                                <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">{stats.faceCount}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900 rounded-lg transition-colors">
                                <span className="text-slate-500 dark:text-slate-400">Processing FPS</span>
                                <span className="font-mono text-lg text-slate-800 dark:text-slate-200">{stats.fps}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900 rounded-lg transition-colors">
                                <span className="text-slate-500 dark:text-slate-400">Camera IP</span>
                                <span className="font-mono text-sm text-slate-800 dark:text-slate-200">{device?.ipAddress || 'Unknown'}</span>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="space-y-2">
                        {alerts.map(alert => (
                            <Alert key={alert.id} variant={alert.type === 'destructive' ? 'destructive' : 'default'} className="animate-in slide-in-from-right">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>Security Alert</AlertTitle>
                                <AlertDescription>{alert.message}</AlertDescription>
                            </Alert>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Monitor;
