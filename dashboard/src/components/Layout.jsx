import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, FileText, LogOut, Bell, Search, Wifi, ChevronDown, ChevronRight, UserCheck, Upload, GraduationCap, BarChart3, TrendingUp, Users2, AlertTriangle, Eye } from 'lucide-react';
import { ModeToggle } from '@/components/mode-toggle';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import toast from 'react-hot-toast';
import { useState } from 'react';
import apiService from '@/utils/apiService';

const Sidebar = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [studentsExpanded, setStudentsExpanded] = useState(true);

    const navItems = [
        { href: "/dashboard", label: "Attendance Dashboard", icon: LayoutDashboard },
        { href: "/analytics", label: "Behavior Analytics", icon: BarChart3 },
        { href: "/forecasting", label: "Time Series Forecasting", icon: TrendingUp },
        { href: "/clusters", label: "Attendance Clustering", icon: Users2 },
        { href: "/anomalies", label: "Anomaly Detection", icon: AlertTriangle },
        { href: "/occupancy", label: "Occupancy Monitor", icon: Eye }
    ];

    const studentsSubMenu = [
        { href: "/users", label: "Manage Students", icon: Users },
        { href: "/student-behavior", label: "Student Behavior", icon: BarChart3 },
    ];

    const handleLogout = async () => {
        try {
            // Call backend logout endpoint
            await apiService.logout();
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            // Clear all auth data regardless of API call result
            apiService.clearAuth();
            toast.success('Logged out successfully');
            navigate('/login');
        }
    };

    return (
        <div className="w-64 h-screen border-r bg-card text-card-foreground flex flex-col fixed left-0 top-0 bottom-0 z-20">
            <div className="p-6 border-b flex items-center gap-3 h-16">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                    <div className="w-4 h-4 bg-white rounded-sm"></div>
                </div>
                <div className="flex flex-col">
                    <h2 className="font-bold text-lg tracking-tight leading-none">IoT Biometric</h2>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Attendance System</p>
                </div>
            </div>

            <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.href;

                    return (
                        <Link key={item.href} to={item.href}>
                            <Button
                                variant={isActive ? "secondary" : "ghost"}
                                className={cn(
                                    "w-full justify-start gap-3 mb-1",
                                    isActive && "bg-primary/10 text-primary font-semibold"
                                )}
                            >
                                <Icon className="h-4 w-4" />
                                {item.label}
                            </Button>
                        </Link>
                    )
                })}

                {/* Students Menu with Dropdown */}
                <div className="space-y-1">
                    <Button
                        onClick={() => setStudentsExpanded(!studentsExpanded)}
                        variant={studentsSubMenu.some(item => location.pathname === item.href) ? "secondary" : "ghost"}
                        className={cn(
                            "w-full justify-start gap-3 mb-1",
                            studentsSubMenu.some(item => location.pathname === item.href) && "bg-primary/10 text-primary font-semibold"
                        )}
                    >
                        <Users className="h-4 w-4" />
                        <span className="flex-1 text-left">Students</span>
                        {studentsExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                        ) : (
                            <ChevronRight className="h-4 w-4" />
                        )}
                    </Button>

                    {studentsExpanded && (
                        <div className="ml-6 space-y-1">
                            {studentsSubMenu.map((subItem) => {
                                const SubIcon = subItem.icon;
                                const isSubActive = location.pathname === subItem.href;

                                return (
                                    <Link key={subItem.href} to={subItem.href}>
                                        <Button
                                            variant="ghost"
                                            className={cn(
                                                "w-full justify-start gap-3 text-sm py-2 h-8",
                                                isSubActive && "bg-primary/5 text-primary font-medium"
                                            )}
                                        >
                                            <SubIcon className="h-4 w-4" />
                                            {subItem.label}
                                        </Button>
                                    </Link>
                                )
                            })}
                        </div>
                    )}
                </div>
            </nav>

            {/* User Profile and Logout */}
            <div className="p-4 border-t">
                <div className="flex items-center gap-3 mb-3">
                    <Avatar className="h-8 w-8">
                        <AvatarImage src="/placeholder-avatar.jpg" />
                        <AvatarFallback className="bg-primary text-primary-foreground text-sm">S</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">Sudeera</p>
                        <p className="text-xs text-muted-foreground truncate">System Admin</p>
                    </div>
                </div>
                <Button
                    onClick={handleLogout}
                    variant="ghost"
                    className="w-full justify-start gap-3 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                >
                    <LogOut className="h-4 w-4" />
                    Logout
                </Button>
            </div>
        </div>
    );
};

const TopBar = () => {
    const navigate = useNavigate();

    const handleNotifications = () => {
        navigate('/notifications');
    };

    const handleWhatsAppAlerts = () => {
        navigate('/notifications');
    };

    return (
        <div className="h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-between px-6 sticky top-0 z-10 w-full">
            <div className="flex items-center gap-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                        type="search"
                        placeholder="Search students by name or ID..."
                        className="pl-10 h-10 w-80 rounded-lg border border-input bg-background/50 px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                </div>
            </div>

            <div className="flex items-center gap-4">
                {/* IoT Device Status */}
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-full">
                    <Wifi className="h-4 w-4 text-green-500" />
                    <span className="text-xs font-medium text-green-600 dark:text-green-400">IOT CONNECTED</span>
                </div>

                {/* Notifications */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="relative text-muted-foreground hover:text-foreground"
                    onClick={handleNotifications}
                >
                    <Bell className="h-5 w-5" />
                    <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center">3</span>
                </Button>

                {/* WhatsApp Alerts */}
                <Button
                    variant="outline"
                    size="sm"
                    className="bg-green-500 hover:bg-green-600 text-white border-green-500 hover:border-green-600"
                    onClick={handleWhatsAppAlerts}
                >
                    WhatsApp Alerts
                </Button>

                <ModeToggle />

                {/* User Profile */}
                <Avatar className="h-8 w-8 border-2 border-primary/20">
                    <AvatarImage src="/placeholder-avatar.jpg" />
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm">S</AvatarFallback>
                </Avatar>
            </div>
        </div>
    )
}

const Layout = () => {
    return (
        <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
            <Sidebar />
            <div className="pl-64 flex flex-col min-h-screen">
                <TopBar />
                <main className="flex-1 p-8 overflow-y-auto">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default Layout;
