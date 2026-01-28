import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, ChartBar, Settings, Database, Bell, Search } from 'lucide-react';
import { ModeToggle } from '@/components/mode-toggle';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const Sidebar = () => {
    const location = useLocation();

    const navItems = [
        { href: "/", label: "Dashboard", icon: LayoutDashboard },
        { href: "/users", label: "Users", icon: Users },
        { href: "/analytics", label: "Analytics", icon: ChartBar },
        { href: "/settings", label: "Settings", icon: Settings },
    ];

    return (
        <div className="w-64 h-screen border-r bg-card text-card-foreground flex flex-col fixed left-0 top-0 bottom-0 z-20">
            <div className="p-6 border-b flex items-center gap-2 h-16">
                <Database className="h-6 w-6 text-primary" />
                <h2 className="font-bold text-lg tracking-tight">IoT Biometrics</h2>
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
                                    isActive && "font-semibold"
                                )}
                            >
                                <Icon className="h-4 w-4" />
                                {item.label}
                            </Button>
                        </Link>
                    )
                })}
            </nav>
        </div>
    );
};

const TopBar = () => {
    return (
        <div className="h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-between px-6 sticky top-0 z-10 w-full">
            <div className="flex items-center gap-4 text-muted-foreground">
                {/* Breadcrumbs or Search could go here */}
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                        type="search"
                        placeholder="Search..."
                        className="pl-8 h-9 w-64 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    />
                </div>
            </div>

            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" className="text-muted-foreground">
                    <Bell className="h-5 w-5" />
                </Button>
                <ModeToggle />
                <div className="h-8 w-8 rounded-full bg-primary/10 overflow-hidden border">
                    <img
                        src="https://github.com/shadcn.png"
                        alt="Profile"
                        className="h-full w-full object-cover"
                    />
                </div>
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
