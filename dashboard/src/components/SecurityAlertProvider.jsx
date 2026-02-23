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
    const audioCtxRef = useRef(null);
    const [activeAlarm, setActiveAlarm] = useState(null);
    const [isAudioEnabled, setIsAudioEnabled] = useState(true); // Default to on, but needs click

    // Web Audio Alarm Logic
    useEffect(() => {
        let interval;
        if (activeAlarm && isAudioEnabled) {
            console.log('[SecurityAlert] 🔊 Starting audio alarm pulse');

            if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
                audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
            }

            if (audioCtxRef.current.state === 'suspended') {
                audioCtxRef.current.resume();
            }

            const playPulse = () => {
                try {
                    const ctx = audioCtxRef.current;
                    if (!ctx || ctx.state !== 'running') return;

                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();

                    osc.type = 'square';
                    osc.frequency.setValueAtTime(950, ctx.currentTime);

                    gain.gain.setValueAtTime(0, ctx.currentTime);
                    gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.05);
                    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

                    osc.connect(gain);
                    gain.connect(ctx.destination);

                    osc.start();
                    osc.stop(ctx.currentTime + 0.4);
                } catch (e) {
                    console.error('[SecurityAlert] Audio Error:', e);
                }
            };

            playPulse();
            interval = setInterval(playPulse, 700);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [activeAlarm, isAudioEnabled]);

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

    const toggleAudio = (e) => {
        e.stopPropagation();
        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtxRef.current.state === 'suspended') {
            audioCtxRef.current.resume();
        }
        setIsAudioEnabled(!isAudioEnabled);
    };

    if (!activeAlarm) return null;

    const isTailgating = activeAlarm.type === 'TAILGATING';
    const title = isTailgating ? 'TAILGATING DETECTED' : 'UNAUTHORIZED ENTRY!';
    const message = activeAlarm.reason || 'Security breach detected';

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-red-950/90 backdrop-blur-md animate-in fade-in duration-300">
            <div className="relative w-[90vw] h-[85vh] bg-red-600 rounded-[3rem] shadow-[0_0_150px_rgba(220,38,38,1)] border-[6px] border-red-400 flex flex-col items-center justify-center text-center p-12 overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Flashing background effect */}
                <div className="absolute inset-0 bg-red-500 opacity-20 animate-pulse" />

                <div className="relative z-10 flex flex-col items-center gap-6 text-white w-full max-w-4xl">
                    <div className="animate-bounce mb-4">
                        {isTailgating ? (
                            <AlertTriangle className="w-56 h-56 text-yellow-300 drop-shadow-[0_0_30px_rgba(253,224,71,0.8)]" />
                        ) : (
                            <ShieldAlert className="w-56 h-56 text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.6)]" />
                        )}
                    </div>

                    <h1 className="text-7xl font-black uppercase tracking-tighter leading-none mb-2">
                        {title}
                    </h1>

                    <div className="text-3xl font-bold bg-black/40 px-10 py-5 rounded-2xl border border-white/10 backdrop-blur-md text-red-100">
                        {message}
                    </div>

                    {activeAlarm.tailgaters && (
                        <div className="text-4xl text-yellow-300 font-extrabold tracking-tight mt-4 drop-shadow-sm">
                            {activeAlarm.tailgaters} UNAUTHORIZED PEOPLE DETECTED
                        </div>
                    )}

                    <div className="flex gap-4 mt-8">
                        <button
                            onClick={() => setActiveAlarm(null)}
                            className="px-16 py-8 rounded-2xl bg-white text-red-700 text-4xl font-black uppercase tracking-widest hover:bg-zinc-100 transition-all shadow-2xl active:scale-95"
                        >
                            ACKNOWLEDGE
                        </button>

                        <button
                            onClick={toggleAudio}
                            className={`px-8 py-8 rounded-2xl border-4 text-3xl font-black transition-all ${isAudioEnabled
                                    ? 'bg-green-600 border-green-400 text-white'
                                    : 'bg-zinc-800 border-zinc-600 text-zinc-400 animate-bounce'
                                } shadow-2xl active:scale-95`}
                        >
                            {isAudioEnabled ? "🔊 SOUND ON" : "🔇 SOUND OFF"}
                        </button>
                    </div>

                    <div className="mt-12 opacity-50 font-mono text-xl tracking-[0.2em]">
                        SECURE ZONE • CLUSTER: {activeAlarm.clusterId || 'UNKNOWN'} • {new Date(activeAlarm.timestamp || Date.now()).toLocaleTimeString()}
                    </div>
                </div>

                {/* Top Right Close Button */}
                <button
                    onClick={() => setActiveAlarm(null)}
                    className="absolute top-10 right-10 z-50 p-4 text-white/30 hover:text-white hover:bg-white/10 rounded-full transition-all active:scale-90"
                >
                    <X className="w-12 h-12" />
                </button>

                {/* Warning stripes */}
                <div className="absolute top-0 inset-x-0 h-10 bg-[repeating-linear-gradient(45deg,transparent,transparent_20px,rgba(0,0,0,0.3)_20px,rgba(0,0,0,0.3)_40px)]" />
                <div className="absolute bottom-0 inset-x-0 h-10 bg-[repeating-linear-gradient(45deg,transparent,transparent_20px,rgba(0,0,0,0.3)_20px,rgba(0,0,0,0.3)_40px)]" />
            </div>
        </div>
    );
}
