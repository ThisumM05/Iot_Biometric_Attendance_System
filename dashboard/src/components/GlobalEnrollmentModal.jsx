import React, { useState, useEffect } from 'react';
import { Fingerprint, Scan, MapPin, Server, Loader2, CheckCircle, AlertCircle, Globe } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { toast } from "react-hot-toast";

const API_BASE = 'http://localhost:5000/api';

/**
 * Enhanced EnrollmentModal Component with Global Template Sync
 * Now supports enrolling once and syncing to all devices automatically
 * 
 * Usage:
 * <EnrollmentModal 
 *   open={true}
 *   userId="605c72ef5b3e4b1e2c9b1234"
 *   username="john.doe"
 *   onClose={() => {}}
 *   onSuccess={() => {}}
 *   socket={socketInstance}
 * />
 */
const EnrollmentModal = ({
    open,
    userId,
    username,
    onClose,
    onSuccess,
    socket
}) => {
    const [step, setStep] = useState(1); // 1: Mode Selection, 2: Scanner Selection, 3: Enrolling, 4: Syncing
    const [enrollmentMode, setEnrollmentMode] = useState('global'); // 'global' or 'single'
    const [scanners, setScanners] = useState([]);
    const [selectedScanner, setSelectedScanner] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isEnrolling, setIsEnrolling] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [enrollmentMessage, setEnrollmentMessage] = useState('');
    const [enrollmentProgress, setEnrollmentProgress] = useState(0);
    const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0, percentage: 0 });
    const [globalFingerprintId, setGlobalFingerprintId] = useState(null);

    // Fetch available scanners
    useEffect(() => {
        if (open) {
            fetchScanners();
            resetState();
        }
    }, [open]);

    // Socket event listeners
    useEffect(() => {
        if (!socket) return;

        const handleEnrollmentUpdate = (data) => {
            console.log('[Enrollment] 📥 Received enrollment-update:', {
                received_userId: data.userId,
                expected_userId: userId,  // Fixed: was userId_ before
                matches: data.userId === userId,
                step: data.step,
                message: data.message
            });
            if (data.userId === userId) {
                console.log('[Enrollment] Update:', data);
                setEnrollmentMessage(data.message || 'Processing...');
                if (data.step) {
                    // Step 1 = 0% (waiting for finger)
                    // Step 2 = 33% (first image)
                    // Step 3 = 66% (second image)
                    // Success = 100%
                    const progressMap = { 1: 0, 2: 33, 3: 66 };
                    setEnrollmentProgress(progressMap[data.step] || 0);
                }
            } else {
                console.warn('[Enrollment] ⚠️ userId mismatch - event ignored');
            }
        };

        const handleEnrollmentSuccess = (data) => {
            if (data.userId === userId) {
                console.log('[Enrollment] Success:', data);

                // Set enrollment progress to 100%
                setEnrollmentProgress(100);

                if (enrollmentMode === 'global') {
                    // Start syncing phase
                    setStep(4);
                    setIsEnrolling(false);
                    setIsSyncing(true);
                    setEnrollmentMessage('Template enrolled! Syncing to all devices...');
                    setSyncProgress({ current: 0, total: scanners.length - 1, percentage: 0 });
                } else {
                    // Single scanner enrollment complete
                    toast.success(`Enrolled on ${selectedScanner?.scannerID || 'scanner'}!`);
                    setIsEnrolling(false);
                    onSuccess();
                    onClose();
                }
            }
        };

        const handleTemplateSyncUpdate = (data) => {
            if (data.userId === userId) {
                console.log('[TemplateSync] Update:', data);

                // Handle case where no other devices to sync
                if (data.total === 0 || data.complete) {
                    setSyncProgress({ current: 0, total: 0, percentage: 100 });
                    setEnrollmentMessage('Enrollment complete! No other devices to sync.');
                    setTimeout(() => {
                        toast.success('Enrollment complete!');
                        setIsSyncing(false);
                        onSuccess();
                        onClose();
                    }, 1000);
                    return;
                }

                // Update sync progress with data from server
                setSyncProgress({
                    current: data.current || 0,
                    total: data.total || 0,
                    percentage: data.percentage || 0
                });

                const status = data.success ? '✓' : '✗';
                setEnrollmentMessage(`${status} ${data.scannerID || data.deviceMAC} (${data.current}/${data.total})`);

                // Check if sync complete
                if (data.current >= data.total) {
                    setTimeout(() => {
                        toast.success(`Global enrollment complete! Synced to ${data.total} devices.`);
                        setIsSyncing(false);
                        onSuccess();
                        onClose();
                    }, 1000);
                }
            }
        };

        const handleEnrollmentFailed = (data) => {
            if (data.userId === userId) {
                console.error('[Enrollment] Failed:', data);
                toast.error(data.message || 'Enrollment failed');
                setIsEnrolling(false);
                setIsSyncing(false);
                setStep(2); // Back to scanner selection
            }
        };

        socket.on('enrollment-update', handleEnrollmentUpdate);
        socket.on('enrollment-success', handleEnrollmentSuccess);
        socket.on('template-sync-update', handleTemplateSyncUpdate);
        socket.on('enrollment-failed', handleEnrollmentFailed);

        return () => {
            socket.off('enrollment-update', handleEnrollmentUpdate);
            socket.off('enrollment-success', handleEnrollmentSuccess);
            socket.off('template-sync-update', handleTemplateSyncUpdate);
            socket.off('enrollment-failed', handleEnrollmentFailed);
        };
    }, [socket, userId, selectedScanner, enrollmentMode, scanners, syncProgress, onSuccess, onClose]);

    const resetState = () => {
        setStep(1);
        setEnrollmentMode('global');
        setSelectedScanner(null);
        setIsEnrolling(false);
        setIsSyncing(false);
        setEnrollmentMessage('');
        setEnrollmentProgress(0);
        setSyncProgress({ current: 0, total: 0, percentage: 0 });
        setGlobalFingerprintId(null);
    };

    const fetchScanners = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE}/devices/scanners`);
            const data = await response.json();
            setScanners(data);
        } catch (error) {
            console.error('[Enrollment] Error fetching scanners:', error);
            toast.error('Failed to load scanners');
        } finally {
            setLoading(false);
        }
    };

    const startEnrollment = async () => {
        if (!selectedScanner) {
            toast.error('Please select a scanner');
            return;
        }

        setIsEnrolling(true);
        setStep(3);
        setEnrollmentMessage('Initiating enrollment...');

        try {
            const token = localStorage.getItem('authToken');
            const endpoint = enrollmentMode === 'global' ? '/sync/enroll' : '/devices/enroll';

            const response = await fetch(`${API_BASE}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    userId,
                    scannerID: selectedScanner.scannerID,
                    deviceMAC: selectedScanner.deviceMAC
                })
            });

            const data = await response.json();

            if (response.ok) {
                if (enrollmentMode === 'global') {
                    setGlobalFingerprintId(data.data.globalFingerprintId);
                    setEnrollmentMessage('Place your finger on the sensor when prompted...');
                    toast('Global enrollment initiated - will sync to all devices', { icon: 'ℹ️' });
                } else {
                    setEnrollmentMessage('Place your finger on the sensor when prompted...');
                    toast('Single scanner enrollment initiated', { icon: 'ℹ️' });
                }
            } else {
                throw new Error(data.error || 'Failed to start enrollment');
            }
        } catch (error) {
            console.error('[Enrollment] Error starting enrollment:', error);
            toast.error(error.message);
            setIsEnrolling(false);
            setStep(2);
        }
    };

    const handleScannerSelect = (scanner) => {
        setSelectedScanner(scanner);
    };

    const handleModeSelect = (mode) => {
        setEnrollmentMode(mode);
        setStep(2);
    };

    if (!open) return null;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Fingerprint className="h-5 w-5" />
                        Fingerprint Enrollment - {username}
                    </DialogTitle>
                    <DialogDescription>
                        {step === 1 && 'Choose enrollment mode for this user'}
                        {step === 2 && 'Select the scanner for enrollment'}
                        {step === 3 && 'Follow the enrollment instructions'}
                        {step === 4 && 'Syncing template to all devices...'}
                    </DialogDescription>
                </DialogHeader>

                {/* Step 1: Mode Selection */}
                {step === 1 && (
                    <div className="space-y-6">
                        <div className="text-center">
                            <h3 className="text-lg font-semibold mb-2">Choose Enrollment Mode</h3>
                            <p className="text-muted-foreground">
                                How would you like to enroll this user's fingerprint?
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Global Enrollment */}
                            <Card
                                className="cursor-pointer transition-all hover:shadow-lg border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10"
                                onClick={() => handleModeSelect('global')}
                            >
                                <CardContent className="p-6">
                                    <div className="flex items-center gap-3 mb-4">
                                        <Globe className="h-8 w-8 text-primary" />
                                        <div>
                                            <h4 className="font-semibold text-primary">Global Enrollment</h4>
                                            <p className="text-sm text-muted-foreground">Recommended</p>
                                        </div>
                                    </div>
                                    <ul className="space-y-2 text-sm">
                                        <li className="flex items-center gap-2">
                                            <CheckCircle className="h-4 w-4 text-green-500" />
                                            <span>Enroll once on any scanner</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <CheckCircle className="h-4 w-4 text-green-500" />
                                            <span>Automatically sync to ALL devices</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <CheckCircle className="h-4 w-4 text-green-500" />
                                            <span>Access all locations immediately</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <CheckCircle className="h-4 w-4 text-green-500" />
                                            <span>Future devices auto-sync</span>
                                        </li>
                                    </ul>
                                    <Badge className="mt-4">Best Choice</Badge>
                                </CardContent>
                            </Card>

                            {/* Single Scanner Enrollment */}
                            <Card
                                className="cursor-pointer transition-all hover:shadow-md"
                                onClick={() => handleModeSelect('single')}
                            >
                                <CardContent className="p-6">
                                    <div className="flex items-center gap-3 mb-4">
                                        <Scan className="h-8 w-8 text-muted-foreground" />
                                        <div>
                                            <h4 className="font-semibold">Single Scanner</h4>
                                            <p className="text-sm text-muted-foreground">Legacy mode</p>
                                        </div>
                                    </div>
                                    <ul className="space-y-2 text-sm">
                                        <li className="flex items-center gap-2">
                                            <AlertCircle className="h-4 w-4 text-orange-500" />
                                            <span>Only works on selected scanner</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <AlertCircle className="h-4 w-4 text-orange-500" />
                                            <span>Must enroll on each device separately</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <AlertCircle className="h-4 w-4 text-orange-500" />
                                            <span>Limited access control</span>
                                        </li>
                                    </ul>
                                    <Badge variant="outline" className="mt-4">For Testing Only</Badge>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}

                {/* Step 2: Scanner Selection */}
                {step === 2 && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-semibold">Select Enrollment Scanner</h3>
                                <p className="text-sm text-muted-foreground">
                                    {enrollmentMode === 'global'
                                        ? 'Choose any scanner for enrollment - template will sync to all devices'
                                        : 'Choose the specific scanner this user will use'
                                    }
                                </p>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => setStep(1)}>
                                Back to Mode
                            </Button>
                        </div>

                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : scanners.length === 0 ? (
                            <div className="text-center py-8">
                                <AlertCircle className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
                                <p className="text-muted-foreground">No active scanners available</p>
                                <Button variant="outline" className="mt-4" onClick={fetchScanners}>
                                    Refresh
                                </Button>
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                                    {scanners.map((scanner) => (
                                        <Card
                                            key={scanner.deviceMAC}
                                            className={`cursor-pointer transition-all hover:shadow-md ${selectedScanner?.deviceMAC === scanner.deviceMAC
                                                ? 'ring-2 ring-primary bg-accent/50'
                                                : 'hover:bg-accent/30'
                                                }`}
                                            onClick={() => handleScannerSelect(scanner)}
                                        >
                                            <CardContent className="p-4">
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className="flex items-center gap-2">
                                                        <Scan className="h-5 w-5 text-primary" />
                                                        <div>
                                                            <p className="font-medium">{scanner.scannerID}</p>
                                                            <p className="text-xs text-muted-foreground">{scanner.deviceRole}</p>
                                                        </div>
                                                    </div>
                                                    {selectedScanner?.deviceMAC === scanner.deviceMAC && (
                                                        <CheckCircle className="h-5 w-5 text-primary" />
                                                    )}
                                                </div>

                                                <div className="space-y-1 text-sm">
                                                    <div className="flex items-center gap-2">
                                                        <MapPin className="h-3 w-3 text-muted-foreground" />
                                                        <span className="text-muted-foreground">
                                                            {scanner.location || 'No location'} • {scanner.clusterID}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Server className="h-3 w-3 text-muted-foreground" />
                                                        <span className="text-xs font-mono text-muted-foreground">
                                                            {scanner.deviceMAC}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="mt-3 flex gap-2">
                                                    <Badge
                                                        variant={scanner.isOnline ? "default" : "destructive"}
                                                        className="text-xs"
                                                    >
                                                        {scanner.isOnline ? 'Online' : 'Offline'}
                                                    </Badge>
                                                    <Badge variant="outline" className="text-xs">
                                                        {scanner.deviceType}
                                                    </Badge>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>

                                <div className="flex items-center justify-between pt-4 border-t">
                                    <div className="flex items-center gap-2">
                                        <Globe className="h-4 w-4 text-primary" />
                                        <span className="text-sm font-medium">
                                            Mode: {enrollmentMode === 'global' ? 'Global Sync' : 'Single Scanner'}
                                        </span>
                                    </div>
                                    <Button
                                        onClick={startEnrollment}
                                        disabled={!selectedScanner}
                                        className="min-w-32"
                                    >
                                        Start Enrollment
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Step 3: Enrolling */}
                {step === 3 && (
                    <div className="space-y-6 text-center">
                        <div className="flex flex-col items-center gap-4">
                            <div className="relative">
                                <Fingerprint className="h-16 w-16 text-primary animate-pulse" />
                                {enrollmentMode === 'global' && (
                                    <Globe className="h-6 w-6 text-blue-500 absolute -top-2 -right-2" />
                                )}
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold">Enrollment in Progress</h3>
                                <p className="text-muted-foreground mt-1">{enrollmentMessage}</p>
                                {globalFingerprintId && (
                                    <p className="text-sm text-primary mt-2">Global ID: {globalFingerprintId}</p>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>Progress</span>
                                <span>{enrollmentProgress}%</span>
                            </div>
                            <Progress value={enrollmentProgress} className="h-2" />
                        </div>

                        <div className="bg-muted/50 rounded-lg p-4">
                            <p className="text-sm text-muted-foreground">
                                Follow the prompts on the fingerprint sensor. You may need to place your finger multiple times.
                            </p>
                        </div>
                    </div>
                )}

                {/* Step 4: Syncing */}
                {step === 4 && (
                    <div className="space-y-6 text-center">
                        <div className="flex flex-col items-center gap-4">
                            <div className="relative">
                                <Server className="h-16 w-16 text-primary animate-pulse" />
                                <Globe className="h-6 w-6 text-blue-500 absolute -top-2 -right-2 animate-spin" />
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold">Syncing to All Devices</h3>
                                <p className="text-muted-foreground mt-1">{enrollmentMessage}</p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>Devices Synced</span>
                                <span>{syncProgress.current} / {syncProgress.total}</span>
                            </div>
                            <Progress value={syncProgress.percentage} className="h-2" />
                        </div>

                        <div className="bg-blue-50 rounded-lg p-4">
                            <p className="text-sm text-blue-800">
                                Your fingerprint template is being distributed to all active scanners.
                                You'll be able to use any scanner once this completes.
                            </p>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default EnrollmentModal;