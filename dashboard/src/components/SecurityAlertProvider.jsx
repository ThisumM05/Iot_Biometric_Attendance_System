import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import toast from 'react-hot-toast';
import { AlertTriangle, ShieldAlert, X } from 'lucide-react';

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

/**
 * Global security alert listener.
 * Connects to Socket.IO and shows toast notifications for security:alarm events.
 */
export default function SecurityAlertProvider() {
    const socketRef = useRef(null);

    const [activeAlarm, setActiveAlarm] = useState(null);

    useEffect(() => {
        const socket = io(SOCKET_URL, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 3000,
        });
        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('[SecurityAlert] Connected to server');
        });

        // Listen for security alarm events
        socket.on('security:alarm', (data) => {
            console.log('[SecurityAlert] 🚨 ALARM:', data);
            setActiveAlarm(data);

            const isTailgating = data.type === 'TAILGATING';
            const title = isTailgating ? '🚨 Tailgating Detected!' : '🚨 Unauthorized Entry!';
            const message = data.reason || 'Security breach detected';

            // Play browser notification sound if available
            try {
                if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification(title, { body: message, icon: '/favicon.ico' });
                }
            } catch (e) {
                // Ignore notification errors
            }
        });

        // Listen for alarm stop to dismiss popup automatically
        socket.on('security:alarm_stop', (data) => {
            console.log('[SecurityAlert] 🛑 ALARM STOPPED:', data);
            setActiveAlarm(null);
        });

        // Also listen for IR crossing events (informational)
        socket.on('security:ir-crossing', (data) => {
            console.log(`[SecurityAlert] IR Crossing: ${data.direction} from ${data.deviceRole}`);
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    if (!activeAlarm) return null;

    const isTailgating = activeAlarm.type === 'TAILGATING';
    const title = isTailgating ? 'TAILGATING DETECTED' : 'UNAUTHORIZED ENTRY!';
    const message = activeAlarm.reason || 'Security breach detected';

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-red-950/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="relative w-[80vw] h-[80vh] bg-red-600 rounded-3xl shadow-[0_0_100px_rgba(220,38,38,0.8)] border-4 border-red-400 flex flex-col items-center justify-center text-center p-12 overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Flashing background effect */}
                <div className="absolute inset-0 bg-red-500 opacity-0 animate-[pulse_1s_ease-in-out_infinite]" />

                <div className="relative z-10 flex flex-col items-center gap-8 text-white">
                    <div className="animate-bounce">
                        {isTailgating ? (
                            <AlertTriangle className="w-48 h-48 text-yellow-300 drop-shadow-[0_0_20px_rgba(253,224,71,0.8)]" />
                        ) : (
                            <ShieldAlert className="w-48 h-48 text-red-200 drop-shadow-[0_0_20px_rgba(254,202,202,0.8)]" />
                        )}
                    </div>

                    <h1 className="text-6xl font-black uppercase tracking-widest drop-shadow-md">
                        {title}
                    </h1>

                    <div className="text-3xl font-medium tracking-wide bg-black/30 px-8 py-4 rounded-xl backdrop-blur-md">
                        {message}
                    </div>

                    {activeAlarm.tailgaters && (
                        <div className="text-2xl text-red-200 font-bold tracking-wider uppercase mt-4">
                            {activeAlarm.tailgaters} unauthorized person(s) detected
                        </div>
                    )}

                    {(activeAlarm.clusterId || activeAlarm.deviceId) && (
                        <div className="flex gap-6 mt-4 opacity-90">
                            {activeAlarm.clusterId && (
                                <div className="bg-white/10 px-6 py-3 rounded-lg border border-white/20">
                                    <span className="text-red-300 text-sm uppercase tracking-widest block mb-1">Cluster</span>
                                    <span className="text-2xl font-semibold">{activeAlarm.clusterId}</span>
                                </div>
                            )}
                            {activeAlarm.deviceId && (
                                <div className="bg-white/10 px-6 py-3 rounded-lg border border-white/20">
                                    <span className="text-red-300 text-sm uppercase tracking-widest block mb-1">Device</span>
                                    <span className="text-2xl font-mono">{activeAlarm.deviceId}</span>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="text-5xl font-mono font-bold tracking-widest mt-8 bg-black/50 px-12 py-6 rounded-2xl shadow-inner tabular-nums">
                        {new Date(activeAlarm.timestamp || Date.now()).toLocaleTimeString()}
                    </div>

                    <button
                        onClick={() => setActiveAlarm(null)}
                        className="mt-12 group relative px-12 py-6 overflow-hidden rounded-2xl bg-white text-red-700 text-3xl font-black uppercase tracking-widest hover:bg-red-50 transition-colors shadow-2xl hover:shadow-[0_0_40px_rgba(255,255,255,0.6)] active:scale-95"
                    >
                        <span className="relative z-10">Acknowledge</span>
                        <div className="absolute inset-0 bg-red-100 opacity-0 group-hover:opacity-10 transition-opacity" />
                    </button>
                </div>

                {/* Top Right Close Button */}
                <button
                    onClick={() => setActiveAlarm(null)}
                    className="absolute top-8 right-8 z-50 p-2 text-white/50 hover:text-white hover:bg-white/20 rounded-full transition-all active:scale-90 flex items-center justify-center"
                    title="Close"
                >
                    <X className="w-10 h-10" />
                </button>

                {/* Warning stripes decoration */}
                <div className="absolute top-0 inset-x-0 h-8 bg-[repeating-linear-gradient(45deg,transparent,transparent_20px,rgba(0,0,0,0.2)_20px,rgba(0,0,0,0.2)_40px)]" />
                <div className="absolute bottom-0 inset-x-0 h-8 bg-[repeating-linear-gradient(45deg,transparent,transparent_20px,rgba(0,0,0,0.2)_20px,rgba(0,0,0,0.2)_40px)]" />
                <div className="absolute left-0 inset-y-0 w-8 bg-[repeating-linear-gradient(45deg,transparent,transparent_20px,rgba(0,0,0,0.2)_20px,rgba(0,0,0,0.2)_40px)]" />
                <div className="absolute right-0 inset-y-0 w-8 bg-[repeating-linear-gradient(45deg,transparent,transparent_20px,rgba(0,0,0,0.2)_20px,rgba(0,0,0,0.2)_40px)]" />
            </div>
        </div>
    );
}
