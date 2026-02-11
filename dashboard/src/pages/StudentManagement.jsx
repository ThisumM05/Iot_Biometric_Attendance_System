import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Fingerprint, RefreshCcw, Pencil, Trash, CheckCircle, Loader2, ArrowRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { io } from "socket.io-client";
import { toast } from "react-hot-toast";

const StudentManagement = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [enrollLoading, setEnrollLoading] = useState(null);

    // Socket state
    const [socket, setSocket] = useState(null);

    // New User Wizard State
    const [isAddUserOpen, setIsAddUserOpen] = useState(false);
    const [newUser, setNewUser] = useState({ username: '', email: '', role: 'employee' });
    const [wizardStep, setWizardStep] = useState(1); // 1: Details, 2: Enroll
    const [createdUser, setCreatedUser] = useState(null);
    const [isScanning, setIsScanning] = useState(false);
    const [enrollmentMessage, setEnrollmentMessage] = useState('Please place your finger on the sensor. Waiting for confirmation...');
    const [enrollmentStep, setEnrollmentStep] = useState(0); // 1: Scan 1, 2: Lift, 3: Scan 2

    // Edit User State
    const [isEditUserOpen, setIsEditUserOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);

    // Initialize Socket Connection
    useEffect(() => {
        // Prevent multiple connections
        if (socket) return;

        const newSocket = io('http://localhost:5000', {
            withCredentials: true,
            transports: ['websocket', 'polling'] // Force stable transport
        });

        newSocket.on('connect', () => {
            console.log('Connected to WebSocket server');
        });

        newSocket.on('enrollment-success', (data) => {
            console.log('Enrollment Success:', data);
            toast.success('Fingerprint enrolled successfully!', { id: 'enroll-success' }); // Unique ID prevents dups
            setIsScanning(false);
            setWizardStep(1); // Reset
            setIsAddUserOpen(false); // Close dialog
            fetchUsers();
        });

        // Listen for intermediate updates
        newSocket.on('enrollment-update', (data) => {
            console.log('Enrollment Update:', data);
            setEnrollmentMessage(data.message || 'Processing...');
            if (data.step) setEnrollmentStep(data.step);
            // Use toast.loading or similar if you want updates, but standard toast with ID is safer against flashing
            // toast(data.message, { icon: 'ℹ️', id: 'enroll-status' }); // Removed toast to avoid clutter, using UI text instead
        });

        newSocket.on('enrollment-failed', (data) => {
            console.error('Enrollment Failed:', data);
            toast.error(data.message || 'Enrollment failed', { id: 'enroll-error' });
            setIsScanning(false);
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect(); // Ensure disconnect
            setSocket(null);
        };
    }, []);

    const fetchUsers = async () => {
        try {
            const response = await axios.get('http://localhost:5000/api/users');
            setUsers(response.data.data);
        } catch (error) {
            console.error('Error fetching users:', error);
            // Fallback to dummy data when backend not available
            setUsers([
                {
                    _id: 'dummy1',
                    username: 'john.doe',
                    email: 'john.doe@company.com',
                    role: 'employee',
                    fingerprintId: 'FP001',
                    isEnrolled: true,
                    createdAt: '2026-02-10T08:00:00Z',
                    lastSeen: '2026-02-11T08:15:00Z'
                },
                {
                    _id: 'dummy2',
                    username: 'sarah.smith',
                    email: 'sarah.smith@company.com',
                    role: 'manager',
                    fingerprintId: 'FP002',
                    isEnrolled: true,
                    createdAt: '2026-02-09T09:30:00Z',
                    lastSeen: '2026-02-11T08:12:00Z'
                },
                {
                    _id: 'dummy3',
                    username: 'mike.johnson',
                    email: 'mike.johnson@company.com',
                    role: 'employee',
                    fingerprintId: 'FP003',
                    isEnrolled: true,
                    createdAt: '2026-02-08T14:20:00Z',
                    lastSeen: '2026-02-11T08:45:00Z'
                },
                {
                    _id: 'dummy4',
                    username: 'emma.wilson',
                    email: 'emma.wilson@company.com',
                    role: 'employee',
                    fingerprintId: 'FP004',
                    isEnrolled: true,
                    createdAt: '2026-02-07T11:10:00Z',
                    lastSeen: '2026-02-11T08:05:00Z'
                },
                {
                    _id: 'dummy5',
                    username: 'david.lee',
                    email: 'david.lee@company.com',
                    role: 'employee',
                    fingerprintId: null,
                    isEnrolled: false,
                    createdAt: '2026-02-11T10:00:00Z',
                    lastSeen: null
                }
            ]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    // Reset message when scanning stops
    useEffect(() => {
        if (!isScanning) {
            setEnrollmentMessage('Please place your finger on the sensor. Waiting for confirmation...');
        }
    }, [isScanning]);

    const handleCreateUser = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.post('http://localhost:5000/api/users', newUser);
            setCreatedUser(response.data.data);
            setNewUser({ username: '', email: '', role: 'employee' });
            setWizardStep(2); // Move to enrollment step
            // Don't close dialog yet
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error creating user');
        }
    };

    const handleStartEnrollment = async () => {
        if (!createdUser) return;
        setIsScanning(true);
        setEnrollmentStep(0); // Start at 0%
        try {
            await axios.post('http://localhost:5000/api/users/enroll', {
                userId: createdUser._id,
                deviceId: 'DEV-001' // Demo Device ID
            });
            // Now waiting for socket event...
        } catch (error) {
            setIsScanning(false);
            toast.error('Failed to start enrollment command');
        }
    };

    const handleEditUser = async (e) => {
        e.preventDefault();
        try {
            await axios.put(`http://localhost:5000/api/users/${editingUser._id}`, editingUser);
            setIsEditUserOpen(false);
            setEditingUser(null);
            fetchUsers();
            toast.success('User updated');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error updating user');
        }
    };

    const handleDeleteUser = async (userId) => {
        if (!window.confirm('Are you sure you want to delete this user?')) return;
        try {
            await axios.delete(`http://localhost:5000/api/users/${userId}`);
            fetchUsers();
            toast.success('User deleted');
        } catch (error) {
            toast.error('Failed to delete user');
        }
    };

    const openEditDialog = (user) => {
        setEditingUser(user);
        setIsEditUserOpen(true);
    };

    // Keep standalone enroll for existing users
    const handleStandaloneEnroll = (user) => {
        setCreatedUser(user);
        setWizardStep(2); // Jump straight to scanning
        setIsAddUserOpen(true);
    };

    // Reset wizard when dialog closes
    const onAddUserOpenChange = (open) => {
        setIsAddUserOpen(open);
        if (!open) {
            setWizardStep(1);
            setCreatedUser(null);
            setIsScanning(false);
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Student Management</h1>
                    <p className="text-muted-foreground">Manage students and biometric enrollment.</p>
                </div>
                <Dialog open={isAddUserOpen} onOpenChange={onAddUserOpenChange}>
                    <DialogTrigger asChild>
                        <Button><Plus className="mr-2 h-4 w-4" /> Add Student</Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader className="mb-2">
                            <DialogTitle>
                                {wizardStep === 1 ? 'Add New Student' : 'Enroll Fingerprint'}
                            </DialogTitle>
                        </DialogHeader>

                        {wizardStep === 1 ? (
                            <form onSubmit={handleCreateUser} className="space-y-2">
                                <div className="flex flex-col gap-3">
                                    <Label htmlFor="username">Student Name</Label>
                                    <Input id="username" value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} required />
                                </div>
                                <div className="flex flex-col gap-3">
                                    <Label htmlFor="email">Email</Label>
                                    <Input id="email" type="email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} required />
                                </div>
                                <Button type="submit" className="w-full group">
                                    Proceed to Enrollment
                                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                                </Button>
                            </form>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-8 space-y-6">
                                {/* Visual Area */}
                                <div className="relative flex items-center justify-center w-32 h-32">
                                    {/* Animated Ring */}
                                    {isScanning && (
                                        <div className={`absolute inset-0 rounded-full border-4 border-primary/20 ${enrollmentStep === 1 || enrollmentStep === 3 ? 'animate-ping' : ''}`}></div>
                                    )}

                                    <div className={`relative flex items-center justify-center w-28 h-28 rounded-full border-4 bg-background transition-all duration-500
                                        ${isScanning ? 'border-primary shadow-lg shadow-primary/20' : 'border-muted'}
                                    `}>
                                        <Fingerprint
                                            className={`w-14 h-14 transition-all duration-500
                                                ${isScanning && (enrollmentStep === 1 || enrollmentStep === 3) ? 'text-primary scale-110' : 'text-muted-foreground'}
                                                ${isScanning && enrollmentStep === 2 ? 'text-primary/50 translate-y-[-10px] opacity-50' : ''}
                                            `}
                                        />

                                        {/* Step 2 Indicator (Lift Finger) */}
                                        {isScanning && enrollmentStep === 2 && (
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <div className="animate-bounce mt-8 bg-background/80 px-2 py-1 rounded text-xs font-bold text-primary border border-primary/20 shadow-sm">
                                                    LIFT
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Progress & Instructions */}
                                <div className="text-center space-y-4 w-full max-w-xs">
                                    <div className="space-y-1">
                                        <h3 className="font-semibold text-xl tracking-tight">
                                            {isScanning ? (
                                                enrollmentStep === 2 ? 'Lift Finger' : 'Scanning...'
                                            ) : 'Ready to Enroll'}
                                        </h3>
                                        <p className="text-sm text-muted-foreground h-10 flex items-center justify-center">
                                            {isScanning
                                                ? enrollmentMessage
                                                : `Enroll ${createdUser?.username}. Click start below.`}
                                        </p>
                                    </div>

                                    {/* Custom Progress Bar */}
                                    {isScanning && (
                                        <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                                            <div
                                                className="bg-primary h-full transition-all duration-500 ease-in-out"
                                                style={{ width: `${(enrollmentStep / 3) * 100}%` }}
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                {!isScanning && (
                                    <Button onClick={handleStartEnrollment} className="w-full" size="lg">
                                        Start Scanning
                                    </Button>
                                )}

                                {isScanning && (
                                    <Button variant="ghost" onClick={() => setIsScanning(false)} className="text-muted-foreground hover:text-destructive">
                                        Cancel Process
                                    </Button>
                                )}
                            </div>
                        )}
                    </DialogContent>
                </Dialog>

                {/* Edit User Dialog */}
                <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Edit Student</DialogTitle>
                        </DialogHeader>
                        {editingUser && (
                            <form onSubmit={handleEditUser} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="edit-username">Student Name</Label>
                                    <Input id="edit-username" value={editingUser.username} onChange={e => setEditingUser({ ...editingUser, username: e.target.value })} required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit-email">Email</Label>
                                    <Input id="edit-email" type="email" value={editingUser.email} onChange={e => setEditingUser({ ...editingUser, email: e.target.value })} required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit-role">Role</Label>
                                    <select
                                        id="edit-role"
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        value={editingUser.role}
                                        onChange={e => setEditingUser({ ...editingUser, role: e.target.value })}
                                    >
                                        <option value="employee">Student</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </div>
                                <Button type="submit" className="w-full">Update Student</Button>
                            </form>
                        )}
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Registered Students</CardTitle>
                    <CardDescription>
                        List of all students in the system. Use the action buttons to manage biometrics.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border max-h-[500px] overflow-y-auto scrollbar-thin relative">
                        <Table>
                            <TableHeader className="sticky top-0 bg-secondary/90 backdrop-blur-sm z-10 w-full shadow-sm">
                                <TableRow>
                                    <TableHead>Student Name</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Fingerprint ID</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-4">Loading...</TableCell>
                                    </TableRow>
                                ) : users.map((user) => (
                                    <TableRow key={user._id}>
                                        <TableCell className="font-medium">{user.username}</TableCell>
                                        <TableCell>{user.email}</TableCell>
                                        <TableCell>
                                            <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>{user.role === 'employee' ? 'Student' : user.role}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            {user.fingerprintId ? (
                                                <Badge variant="outline" className="gap-1">
                                                    <Fingerprint className="h-3 w-3" /> ID: {user.fingerprintId}
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground text-sm">Not Enrolled</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right gap-2 flex justify-end">
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                onClick={() => openEditDialog(user)}
                                                className="mr-1"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                onClick={() => handleDeleteUser(user._id)}
                                                className="mr-1 text-red-500 hover:text-red-600 hover:bg-red-50"
                                            >
                                                <Trash className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant={user.fingerprintId ? "secondary" : "default"}
                                                // Updated: Pass entire user object for wizard context
                                                onClick={() => handleStandaloneEnroll(user)}
                                                disabled={enrollLoading === user._id}
                                            >
                                                {enrollLoading === user._id ? (
                                                    <RefreshCcw className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <>
                                                        <Fingerprint className="mr-2 h-4 w-4" />
                                                        {user.fingerprintId ? 'Re-enroll' : 'Enroll'}
                                                    </>
                                                )}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default StudentManagement;