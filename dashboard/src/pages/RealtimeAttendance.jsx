import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Clock, User as UserIcon, Fingerprint, MapPin, CheckCircle2, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const RealtimeAttendance = () => {
    const [logs, setLogs] = useState([]);
    const [stats, setStats] = useState({
        total: 0,
        present: 0,
        late: 0,
        lastScan: null
    });
    const socketRef = useRef(null);

    const fetchInitialData = async () => {
        try {
            const response = await axios.get('http://localhost:5000/api/attendance/raw');
            if (response.data.success) {
                setLogs(response.data.data);

                const present = response.data.data.filter(l => l.status === 'PRESENT' || l.status === 'LATE').length;
                const late = response.data.data.filter(l => l.status === 'LATE').length;

                setStats({
                    total: response.data.data.length,
                    present,
                    late,
                    lastScan: response.data.data[0] || null
                });
            }
        } catch (error) {
            console.error('Error fetching initial attendance data:', error);
        }
    };

    useEffect(() => {
        fetchInitialData();

        // Connect to Socket.IO
        const socket = io('http://localhost:5000', {
            transports: ['websocket', 'polling'],
            path: '/socket.io/'
        });
        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('Connected to Attendance WebSocket');
        });

        // Listen for real-time attendance updates
        socket.on('attendance-update', (data) => {
            console.log('New attendance update received:', data);

            // Add new log to the top
            setLogs(prev => [data, ...prev].slice(0, 50));

            // Update stats
            setStats(prev => ({
                ...prev,
                total: prev.total + 1,
                lastScan: data
            }));
        });

        return () => {
            if (socketRef.current) socketRef.current.disconnect();
        };
    }, []);

    const getStatusBadge = (status, type) => {
        if (type === 'CHECK_IN') return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">Checked In</Badge>;
        if (type === 'CHECK_OUT') return <Badge className="bg-slate-500/10 text-slate-500 border-slate-500/20">Checked Out</Badge>;

        switch (status) {
            case 'PRESENT':
                return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20">Present</Badge>;
            case 'LATE':
                return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20">Late Arrival</Badge>;
            case 'ABSENT':
                return <Badge variant="destructive" className="bg-rose-500/10 text-rose-500 border-rose-500/20 hover:bg-rose-500/20">Absent</Badge>;
            default:
                return <Badge variant="outline">{status || 'Unknown'}</Badge>;
        }
    };

    return (
        <div className="p-8 space-y-8 bg-slate-50/50 min-h-screen">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Real-time Attendance</h1>
                    <p className="text-lg text-slate-500 mt-1">Live monitoring of campus check-ins and check-outs.</p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border border-slate-200">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-sm font-medium text-slate-600">Live Traffic Active</span>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Card className="border-none shadow-md bg-white overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 group-hover:w-2 transition-all" />
                    <CardHeader className="pb-2">
                        <CardDescription className="text-slate-500 font-medium uppercase tracking-wider text-xs">Total Records Today</CardDescription>
                        <CardTitle className="text-3xl font-bold flex items-center justify-between">
                            {stats.total}
                            <UserIcon className="h-5 w-5 text-blue-500 opacity-20" />
                        </CardTitle>
                    </CardHeader>
                </Card>

                <Card className="border-none shadow-md bg-white overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 group-hover:w-2 transition-all" />
                    <CardHeader className="pb-2">
                        <CardDescription className="text-slate-500 font-medium uppercase tracking-wider text-xs">Present</CardDescription>
                        <CardTitle className="text-3xl font-bold flex items-center justify-between">
                            {stats.present}
                            <CheckCircle2 className="h-5 w-5 text-emerald-500 opacity-20" />
                        </CardTitle>
                    </CardHeader>
                </Card>

                <Card className="border-none shadow-md bg-white overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-amber-500 group-hover:w-2 transition-all" />
                    <CardHeader className="pb-2">
                        <CardDescription className="text-slate-500 font-medium uppercase tracking-wider text-xs">Late Arrivals</CardDescription>
                        <CardTitle className="text-3xl font-bold flex items-center justify-between">
                            {stats.late}
                            <Clock className="h-5 w-5 text-amber-500 opacity-20" />
                        </CardTitle>
                    </CardHeader>
                </Card>

                <Card className="border-none shadow-md bg-white overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 group-hover:w-2 transition-all" />
                    <CardHeader className="pb-2">
                        <CardDescription className="text-slate-500 font-medium uppercase tracking-wider text-xs">Last Verified User</CardDescription>
                        <CardTitle className="text-lg font-semibold truncate">
                            {stats.lastScan?.username || 'Waiting...'}
                        </CardTitle>
                    </CardHeader>
                </Card>
            </div>

            {/* Activity List */}
            <Card className="border-none shadow-lg bg-white">
                <CardHeader className="border-b border-slate-100 pb-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle className="text-xl font-bold">Recent Scans</CardTitle>
                            <CardDescription>The most recent 50 biometric interactions detected by system nodes.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-slate-50/50">
                                <TableRow>
                                    <TableHead className="w-[180px] font-semibold">TimeStamp</TableHead>
                                    <TableHead className="font-semibold">User Details</TableHead>
                                    <TableHead className="font-semibold text-center">FP ID</TableHead>
                                    <TableHead className="font-semibold">Location / Node</TableHead>
                                    <TableHead className="font-semibold">Direction</TableHead>
                                    <TableHead className="font-semibold text-right">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <AnimatePresence mode="popLayout">
                                    {logs.map((log, index) => (
                                        <motion.tr
                                            key={log._id || `${log.userId}-${log.timestamp}`}
                                            initial={{ opacity: 0, y: -20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, x: 20 }}
                                            transition={{ duration: 0.3, delay: index < 5 ? index * 0.05 : 0 }}
                                            className="group hover:bg-slate-50/80 transition-colors"
                                        >
                                            <TableCell className="font-medium">
                                                <div className="flex flex-col">
                                                    <span className="text-sm text-slate-900 font-bold">
                                                        {new Date(log.timestamp || log.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                    </span>
                                                    <span className="text-xs text-slate-400">
                                                        {new Date(log.timestamp || log.clockIn).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                                        <UserIcon className="h-5 w-5" />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-base font-bold text-slate-800">{log.username || log.user?.username || 'System User'}</span>
                                                        <span className="text-xs text-slate-400">ID: {log.userId || log.user?._id || '---'}</span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center font-mono">
                                                <div className="flex items-center justify-center gap-1.5 px-2 py-1 bg-slate-100 rounded-md text-xs font-bold text-slate-600">
                                                    <Fingerprint className="h-3 w-3" />
                                                    #{log.fingerprintId || log.user?.fingerprintId || 'N/A'}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2 text-slate-600">
                                                    <MapPin className="h-4 w-4 text-slate-400" />
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-medium">{log.clusterID || 'Global'}</span>
                                                        <span className="text-[10px] uppercase tracking-tighter text-slate-400 font-bold">Node: {log.scannerID || log.deviceId || 'Primary'}</span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={`
                                                    ${(log.direction === 'ENTRY' || log.direction === 'IN')
                                                        ? 'border-blue-200 text-blue-600 bg-blue-50/50'
                                                        : 'border-slate-200 text-slate-600 bg-slate-50/50'}
                                                    font-bold rounded-sm px-2 py-0.5 text-[10px]
                                                `}>
                                                    {log.direction || (log.clockOut ? 'EXIT' : 'ENTRY')}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {getStatusBadge(log.status, log.type)}
                                            </TableCell>
                                        </motion.tr>
                                    ))}
                                </AnimatePresence>
                                {logs.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-20 text-slate-400 bg-slate-50/20">
                                            <div className="flex flex-col items-center gap-4">
                                                <div className="h-20 w-20 rounded-full bg-slate-100 flex items-center justify-center">
                                                    <Fingerprint className="h-10 w-10 opacity-20" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-500">No scans detected yet today</p>
                                                    <p className="text-sm">Fingerprint interactions will appear here automatically.</p>
                                                </div>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default RealtimeAttendance;
