import React, { useState, useEffect } from 'react';
import { Fingerprint, Scanner, MapPin, Server, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "react-hot-toast";

const API_BASE = 'http://localhost:5000/api';

/**
 * EnrollmentModal Component
 * Enhanced enrollment flow with scanner selection
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
    const [step, setStep] = useState(1); // 1: Scanner Selection, 2: Scanning
    const [scanners, setScanners] = useState([]);
    const [selectedScanner, setSelectedScanner] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isScanning, setIsScanning] = useState(false);
    const [enrollmentMessage, setEnrollmentMessage] = useState('');
    const [enrollmentProgress, setEnrollmentProgress] = useState(0);

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
            if (data.userId === userId) {
                console.log('[Enrollment] Update:', data);
                setEnrollmentMessage(data.message || 'Processing...');
                if (data.step) {
                    // Map step to progress percentage
                    const progressMap = { 1: 33, 2: 66, 3: 100 };
                    setEnrollmentProgress(progressMap[data.step] || 0);
                }
            }
        };

        const handleEnrollmentSuccess = (data) => {
            if (data.userId === userId) {
                console.log('[Enrollment] Success:', data);
                toast.success(`Enrolled on ${selectedScanner?.scannerID || 'scanner'}!`);
                setIsScanning(false);
                onSuccess();
                onClose();
            }
        };

        const handleEnrollmentFailed = (data) => {
            if (data.userId === userId) {
                console.error('[Enrollment] Failed:', data);
                toast.error(data.message || 'Enrollment failed');
                setIsScanning(false);
                setStep(1); // Back to scanner selection
            }
        };

        socket.on('enrollment-update', handleEnrollmentUpdate);
        socket.on('enrollment-success', handleEnrollmentSuccess);
        socket.on('enrollment-failed', handleEnrollmentFailed);

        return () => {
            socket.off('enrollment-update', handleEnrollmentUpdate);
            socket.off('enrollment-success', handleEnrollmentSuccess);
            socket.off('enrollment-failed', handleEnrollmentFailed);
        };
    }, [socket, userId, selectedScanner, onSuccess, onClose]);

    const resetState = () => {
        setStep(1);
        setSelectedScanner(null);
        setIsScanning(false);
        setEnrollmentMessage('');
        setEnrollmentProgress(0);
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

        setIsScanning(true);
        setStep(2);
        setEnrollmentMessage('Waiting for device to start enrollment...');

        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`${API_BASE}/devices/enroll`, {
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
                setEnrollmentMessage('Place your finger on the sensor when prompted...');
                toast.info('Enrollment initiated', { id: 'enroll-start' });
            } else {
                throw new Error(data.error || 'Failed to start enrollment');
            }
        } catch (error) {
            console.error('[Enrollment] Error starting enrollment:', error);
            toast.error(error.message);
            setIsScanning(false);
            setStep(1);
        }
    };

    const handleScannerSelect = (scanner) => {
        setSelectedScanner(scanner);
    };

    if (!open) return null;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Fingerprint className="h-5 w-5" />
                        Enroll Fingerprint - {username}
                    </DialogTitle>
                    <DialogDescription>
                        {step === 1
                            ? 'Select the scanner where this user will be enrolled'
                            : 'Follow the instructions on the screen'}
                    </DialogDescription>
                </DialogHeader>

                {/* Step 1: Scanner Selection */}
                {step === 1 && (
                    <div className="space-y-4">
                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : scanners.length === 0 ? (
                            <div className="text-center py-8">
                                <AlertCircle className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
                                <p className="text-muted-foreground">No active scanners available</p>
                                <Button
                                    variant="outline"
                                    className="mt-4"
                                    onClick={fetchScanners}
                                >
                                    Refresh
                                </Button>
                            </div>
                        ) : (
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
                                                    <Scanner className="h-5 w-5 text-primary" />
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
                        )}

                        <div className="flex justify-end gap-2 pt-4 border-t">
                            <Button variant="outline" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button
                                onClick={startEnrollment}
                                disabled={!selectedScanner || isScanning}
                            >
                                <Fingerprint className="h-4 w-4 mr-2" />
                                Start Enrollment
                            </Button>
                        </div>
                    </div>
                )}

                {/* Step 2: Scanning */}
                {step === 2 && (
                    <div className="space-y-6">
                        <div className="flex flex-col items-center justify-center py-8">
                            <div className="relative mb-6">
                                <Fingerprint className={`h-24 w-24 ${isScanning ? 'animate-pulse text-primary' : 'text-muted-foreground'}`} />
                                {isScanning && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Loader2 className="h-32 w-32 animate-spin text-primary/30" />
                                    </div>
                                )}
                            </div>

                            <p className="text-lg font-medium text-center mb-2">
                                {enrollmentMessage || 'Scanning...'}
                            </p>

                            {/* Progress Bar */}
                            <div className="w-full max-w-xs mt-4">
                                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-primary transition-all duration-500 ease-out"
                                        style={{ width: `${enrollmentProgress}%` }}
                                    />
                                </div>
                                <p className="text-xs text-center text-muted-foreground mt-2">
                                    {enrollmentProgress}% Complete
                                </p>
                            </div>

                            <div className="mt-6 p-4 bg-accent/50 rounded-lg max-w-md">
                                <p className="text-sm text-center text-muted-foreground">
                                    <strong>Scanner:</strong> {selectedScanner?.scannerID} <br />
                                    <strong>Location:</strong> {selectedScanner?.location || 'Unknown'}
                                </p>
                            </div>
                        </div>

                        <div className="flex justify-center pt-4 border-t">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setIsScanning(false);
                                    setStep(1);
                                }}
                                disabled={isScanning}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default EnrollmentModal;
