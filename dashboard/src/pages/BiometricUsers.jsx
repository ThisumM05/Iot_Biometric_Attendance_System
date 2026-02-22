import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Fingerprint, RefreshCcw, Pencil, Trash, Search, X, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { io } from "socket.io-client";
import { toast } from "react-hot-toast";
import GlobalEnrollmentModal from '@/components/GlobalEnrollmentModal';

const BiometricUsers = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    // Search functionality
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredUsers, setFilteredUsers] = useState([]);

    // Socket state
    const [socket, setSocket] = useState(null);

    // New User Dialog State
    const [isAddUserOpen, setIsAddUserOpen] = useState(false);
    const [newUser, setNewUser] = useState({ username: '', email: '', parentWhatsapp: '', class: '', role: 'student' });

    // Enrollment Modal State
    const [isEnrollmentModalOpen, setIsEnrollmentModalOpen] = useState(false);
    const [userToEnroll, setUserToEnroll] = useState(null);

    // Edit User State
    const [isEditUserOpen, setIsEditUserOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);

    // Initialize Socket Connection
    useEffect(() => {
        // Prevent multiple connections
        if (socket) return;

        const newSocket = io('http://localhost:5000', {
            withCredentials: true,
            transports: ['polling'], // Use HTTP polling only - more reliable
            upgrade: false, // Don't try to upgrade to websocket
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5,
            forceNew: true // Force new connection each time
        });

        newSocket.on('connect', () => {
            console.log('✓ Connected to WebSocket server');
        });

        newSocket.on('connect_error', (error) => {
            console.error('✗ Socket.io connection error:', error.message);
        });

        newSocket.on('disconnect', (reason) => {
            console.log('✗ Disconnected from WebSocket:', reason);
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
            setFilteredUsers(response.data.data); // Initialize filtered users
        } catch (error) {
            console.error('Error fetching users:', error);
            // Fallback to dummy data when backend not available
            const dummyUsers = [
                {
                    _id: 'dummy1',
                    username: 'john.doe',
                    email: 'john.doe@company.com',
                    role: 'student',
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
                    role: 'student',
                    fingerprintId: 'FP003',
                    isEnrolled: true,
                    createdAt: '2026-02-08T14:20:00Z',
                    lastSeen: '2026-02-11T08:45:00Z'
                },
                {
                    _id: 'dummy4',
                    username: 'emma.wilson',
                    email: 'emma.wilson@company.com',
                    role: 'student',
                    fingerprintId: 'FP004',
                    isEnrolled: true,
                    createdAt: '2026-02-07T11:10:00Z',
                    lastSeen: '2026-02-11T08:05:00Z'
                },
                {
                    _id: 'dummy5',
                    username: 'david.lee',
                    email: 'david.lee@company.com',
                    role: 'student',
                    fingerprintId: null,
                    isEnrolled: false,
                    createdAt: '2026-02-11T10:00:00Z',
                    lastSeen: null
                }
            ];
            setUsers(dummyUsers);
            setFilteredUsers(dummyUsers); // Initialize filtered users
        } finally {
            setLoading(false);
        }
    };

    // Search filtering effect
    useEffect(() => {
        if (!searchQuery.trim()) {
            setFilteredUsers(users);
        } else {
            const filtered = users.filter(user =>
                user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
                user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (user.class && user.class.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (user.fingerprintId && user.fingerprintId.toString().includes(searchQuery))
            );
            setFilteredUsers(filtered);
        }
    }, [searchQuery, users]);

    // Clear search
    const clearSearch = () => {
        setSearchQuery('');
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleCreateUser = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.post('http://localhost:5000/api/users', newUser);
            const createdUser = response.data.data;
            toast.success('User created successfully');
            setNewUser({ username: '', email: '', parentWhatsapp: '', class: '', role: 'student' });
            setIsAddUserOpen(false);
            fetchUsers();

            // Launch enrollment modal
            setUserToEnroll(createdUser);
            setIsEnrollmentModalOpen(true);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error creating user');
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

    // Open enrollment modal for existing users
    const handleEnrollUser = (user) => {
        setUserToEnroll(user);
        setIsEnrollmentModalOpen(true);
    };

    // Handle enrollment success callback
    const handleEnrollmentSuccess = () => {
        fetchUsers();
        toast.success('Enrollment completed successfully!');
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
                    <p className="text-muted-foreground">Manage students and biometric enrollment.</p>
                </div>
                <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
                    <DialogTrigger asChild>
                        <Button><Plus className="mr-2 h-4 w-4" /> Add User</Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Add New User</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleCreateUser} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="username">Username</Label>
                                <Input
                                    id="username"
                                    value={newUser.username}
                                    onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={newUser.email}
                                    onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="parentWhatsapp">WhatsApp Number(s)</Label>
                                <Input
                                    id="parentWhatsapp"
                                    type="tel"
                                    placeholder="+12345, +67890"
                                    value={newUser.parentWhatsapp}
                                    onChange={e => setNewUser({ ...newUser, parentWhatsapp: e.target.value })}
                                />
                                <p className="text-xs text-muted-foreground">Support multiple numbers with commas. Include country code.</p>

                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="class">Class</Label>
                                <Input
                                    id="class"
                                    placeholder="e.g., 11-A, 12-B"
                                    value={newUser.class}
                                    onChange={e => setNewUser({ ...newUser, class: e.target.value })}
                                />
                                <p className="text-xs text-muted-foreground">Student's class (e.g., 11-A)</p>
                            </div>
                            <Button type="submit" className="w-full">
                                Create & Enroll
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>

                {/* Edit User Dialog */}
                <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Edit User</DialogTitle>
                        </DialogHeader>
                        {editingUser && (
                            <form onSubmit={handleEditUser} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="edit-username">Username</Label>
                                    <Input id="edit-username" value={editingUser.username} onChange={e => setEditingUser({ ...editingUser, username: e.target.value })} required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit-email">Email</Label>
                                    <Input id="edit-email" type="email" value={editingUser.email} onChange={e => setEditingUser({ ...editingUser, email: e.target.value })} required />
                                </div>
                                <div className="space-y-2">                                    <Label htmlFor="edit-parentWhatsapp">Parent WhatsApp Number(s)</Label>
                                    <Input
                                        id="edit-parentWhatsapp"
                                        type="tel"
                                        placeholder="+12345, +67890"
                                        value={editingUser?.parentWhatsapp || ''}
                                        onChange={(e) => setEditingUser({ ...editingUser, parentWhatsapp: e.target.value })}
                                    />
                                    <p className="text-xs text-muted-foreground">Support multiple numbers with commas. Include country code.</p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit-class">Class</Label>
                                    <Input
                                        id="edit-class"
                                        placeholder="e.g., 11-A, 12-B"
                                        value={editingUser?.class || ''}
                                        onChange={(e) => setEditingUser({ ...editingUser, class: e.target.value })}
                                    />
                                </div>
                                <Button type="submit" className="w-full">Update User</Button>
                            </form>
                        )}
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Registered Users</CardTitle>
                    <CardDescription>
                        List of all users in the system. Use the action buttons to manage biometrics.
                    </CardDescription>

                    {/* Search Bar */}
                    <div className="flex items-center gap-2 mt-4">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                            <Input
                                type="text"
                                placeholder="Search by name, email, class, or fingerprint ID..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 pr-10"
                            />
                            {searchQuery && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={clearSearch}
                                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 hover:bg-muted"
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                            )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                            {searchQuery ? (
                                `${filteredUsers.length} of ${users.length} users`
                            ) : (
                                `${users.length} users total`
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border max-h-[500px] overflow-y-auto scrollbar-thin relative">
                        <Table>
                            <TableHeader className="sticky top-0 bg-secondary/90 backdrop-blur-sm z-10 w-full shadow-sm">
                                <TableRow>
                                    <TableHead>Username</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Parent WhatsApp</TableHead>
                                    <TableHead>Class</TableHead>
                                    <TableHead>Fingerprint ID</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8">
                                            <div className="flex items-center justify-center gap-2">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Loading users...
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : filteredUsers.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8">
                                            <div className="text-center">
                                                {searchQuery ? (
                                                    <div>
                                                        <Search className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                                                        <p className="text-muted-foreground">No users found for "{searchQuery}"</p>
                                                        <Button variant="link" onClick={clearSearch} className="mt-2">
                                                            Clear search
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <Plus className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                                                        <p className="text-muted-foreground">No users registered yet</p>
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : filteredUsers.map((user) => (
                                    <TableRow key={user._id}>
                                        <TableCell className="font-medium">{user.username}</TableCell>
                                        <TableCell>{user.email}</TableCell>
                                        <TableCell>
                                            {user.parentWhatsapp ? (
                                                <span className="text-sm font-mono">{user.parentWhatsapp}</span>
                                            ) : (
                                                <span className="text-muted-foreground text-sm italic">Not set</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {user.class ? (
                                                <Badge variant="outline" className="font-semibold">{user.class}</Badge>
                                            ) : (
                                                <span className="text-muted-foreground text-sm italic">Not set</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {user.globalFingerprintId || user.fingerprintId ? (
                                                <Badge variant="outline" className="gap-1">
                                                    <Fingerprint className="h-3 w-3" /> ID: {user.globalFingerprintId || user.fingerprintId}
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
                                                variant={user.isEnrolled ? "secondary" : "default"}
                                                onClick={() => handleEnrollUser(user)}
                                            >
                                                <Fingerprint className="mr-2 h-4 w-4" />
                                                {user.isEnrolled ? 'Re-enroll' : 'Enroll'}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Global Enrollment Modal */}
            {userToEnroll && (
                <GlobalEnrollmentModal
                    open={isEnrollmentModalOpen}
                    userId={userToEnroll._id}
                    username={userToEnroll.username}
                    onClose={() => {
                        setIsEnrollmentModalOpen(false);
                        setUserToEnroll(null);
                    }}
                    onSuccess={handleEnrollmentSuccess}
                    socket={socket}
                />
            )}
        </div>
    );
};

export default BiometricUsers;
