import React, { useState, useEffect } from 'react';
import { Search, Filter, Download, Calendar, ChevronLeft, ChevronRight, MoreVertical, Settings } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const AttendanceLogs = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({ shiftStart: '08:00', classEnd: '10:30', lateThreshold: 15 });

  const fetchAttendance = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/attendance');
      if (response.data.success) {
        setAttendanceData(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching attendance:", error);
      toast.error("Failed to load attendance logs");
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/settings');
      if (response.data.success) {
        setSettings({
          shiftStart: response.data.data.SHIFT_START_TIME || '08:00',
          classEnd: response.data.data.CLASS_END_TIME || '10:30',
          lateThreshold: response.data.data.LATE_THRESHOLD || 15
        });
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    }
  };

  useEffect(() => {
    fetchAttendance();
    fetchSettings();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchAttendance, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleSaveSettings = async () => {
    try {
      await axios.put('http://localhost:5000/api/settings', {
        shiftStart: settings.shiftStart,
        classEnd: settings.classEnd,
        lateThreshold: settings.lateThreshold
      });
      toast.success("Settings updated successfully");
      setIsSettingsOpen(false);
      fetchAttendance(); // Refresh to reflect potential status changes if logic was re-run (backend dependent)
    } catch (error) {
      toast.error("Failed to update settings");
    }
  };

  const filteredData = attendanceData.filter(record => {
    const studentName = record.user?.username || 'Unknown';
    const studentId = record.user?.fingerprintId?.toString() || '';
    return studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      studentId.includes(searchTerm);
  });

  // Pagination Logic
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startResult = (currentPage - 1) * itemsPerPage + 1;
  const endResult = Math.min(currentPage * itemsPerPage, filteredData.length);
  const currentData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const formatTime = (dateStr) => {
    if (!dateStr) return '---';
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (minutes) => {
    if (!minutes) return '---';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PRESENT':
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-green-200">PRESENT</Badge>;
      case 'LATE':
        return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border-yellow-200">LATE</Badge>;
      case 'ABSENT':
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-200 border-red-200">ABSENT</Badge>;
      case 'LEFT_EARLY':
        return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-200 border-orange-200">LEFT EARLY</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Attendance Logs</h1>
          <p className="text-muted-foreground">Real-time daily sessions and status.</p>
        </div>
        <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Attendance Settings</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Class Start Time</Label>
                <Input
                  type="time"
                  value={settings.shiftStart}
                  onChange={(e) => setSettings({ ...settings, shiftStart: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Time when the class session begins.</p>
              </div>
              <div className="space-y-2">
                <Label>Class End Time</Label>
                <Input
                  type="time"
                  value={settings.classEnd}
                  onChange={(e) => setSettings({ ...settings, classEnd: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Time when the class session ends. Exiting before this is "Left Early".</p>
              </div>
              <div className="space-y-2">
                <Label>Late Threshold (Minutes)</Label>
                <Input
                  type="number"
                  value={settings.lateThreshold}
                  onChange={(e) => setSettings({ ...settings, lateThreshold: parseInt(e.target.value) })}
                />
                <p className="text-xs text-muted-foreground">Grace period before marking as LATE.</p>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleSaveSettings}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters and Search */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by Name or Fingerprint ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-background"
            />
          </div>
        </div>

        {/* Apply Filters Button */}
        <Button className="bg-primary hover:bg-primary/90">
          <Filter className="h-4 w-4 mr-2" />
          Recursive Refresh
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="p-6">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b">
                <TableHead className="font-semibold">STUDENT NAME</TableHead>
                <TableHead className="font-semibold">DATE</TableHead>
                <TableHead className="font-semibold">ENTRY TIME</TableHead>
                <TableHead className="font-semibold">EXIT TIME</TableHead>
                <TableHead className="font-semibold">DURATION</TableHead>
                <TableHead className="font-semibold">STATUS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading attendance data...</TableCell>
                </TableRow>
              ) : currentData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No attendance records found.</TableCell>
                </TableRow>
              ) : (
                currentData.map((record) => (
                  <TableRow key={record._id} className="hover:bg-muted/50 transition-colors">
                    <TableCell className="py-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                            {record.user?.username?.substring(0, 2).toUpperCase() || 'NA'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{record.user?.username || 'Unknown User'}</p>
                          <p className="text-sm text-muted-foreground">ID: {record.user?.fingerprintId}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{record.date}</TableCell>
                    <TableCell className="font-medium">{formatTime(record.clockIn)}</TableCell>
                    <TableCell className="font-medium">{record.clockOut === record.clockIn ? '---' : formatTime(record.clockOut)}</TableCell>
                    <TableCell className="font-medium">{formatDuration(record.duration)}</TableCell>
                    <TableCell>{getStatusBadge(record.status)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/20">
          <div className="text-sm text-muted-foreground">
            Showing {startResult} to {endResult} of {filteredData.length} results
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">Page {currentPage} of {Math.max(1, totalPages)}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages || totalPages === 0}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendanceLogs;