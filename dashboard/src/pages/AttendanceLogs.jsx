import React, { useState } from 'react';
import { Search, Filter, Download, Calendar, ChevronLeft, ChevronRight, MoreVertical } from 'lucide-react';
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

// Mock data for attendance logs
const attendanceData = [
  {
    id: 'STU-8821',
    name: 'John Doe',
    entryTime: 'Oct 31, 08:00 AM',
    exitTime: 'Oct 31, 04:15 PM',
    duration: '8h 15m',
    status: 'PRESENT',
    avatar: 'JD'
  },
  {
    id: 'STU-4102',
    name: 'Alice Smith',
    entryTime: 'Oct 31, 08:45 AM',
    exitTime: 'Oct 31, 04:00 PM',
    duration: '7h 15m',
    status: 'LATE',
    avatar: 'AS'
  },
  {
    id: 'STU-2883',
    name: 'Michael Jordan',
    entryTime: 'Oct 31, 07:55 AM',
    exitTime: 'Oct 31, 03:30 PM',
    duration: '7h 35m',
    status: 'PRESENT',
    avatar: 'MJ'
  },
  {
    id: 'STU-7591',
    name: 'Sarah Williams',
    entryTime: '---',
    exitTime: '---',
    duration: '---',
    status: 'ABSENT',
    avatar: 'SW'
  },
  {
    id: 'STU-4416',
    name: 'Robert Lee',
    entryTime: 'Oct 31, 08:02 AM',
    exitTime: 'Oct 31, 04:30 PM',
    duration: '8h 28m',
    status: 'PRESENT',
    avatar: 'RL'
  }
];

const AttendanceLogs = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [dateRange, setDateRange] = useState('Oct 24, 2023 - Oct 31, 2023');

  const filteredData = attendanceData.filter(student =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = 12; // Mock pagination
  const startResult = (currentPage - 1) * 5 + 1;
  const endResult = Math.min(currentPage * 5, 124);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PRESENT':
        return <Badge variant="present" className="font-medium">PRESENT</Badge>;
      case 'LATE':
        return <Badge variant="warning" className="font-medium">LATE</Badge>;
      case 'ABSENT':
        return <Badge variant="absent" className="font-medium">ABSENT</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const renderPageNumbers = () => {
    const pages = [];
    
    // Always show page 1
    pages.push(
      <Button
        key={1}
        variant={currentPage === 1 ? "default" : "ghost"}
        size="sm"
        onClick={() => setCurrentPage(1)}
        className="w-8 h-8 p-0"
      >
        1
      </Button>
    );

    // Show current page and surrounding pages
    if (currentPage > 3) {
      pages.push(<span key="ellipsis1" className="px-2">...</span>);
    }

    for (let i = Math.max(2, currentPage - 1); i <= Math.min(currentPage + 1, totalPages - 1); i++) {
      if (i !== 1 && i !== totalPages) {
        pages.push(
          <Button
            key={i}
            variant={currentPage === i ? "default" : "ghost"}
            size="sm"
            onClick={() => setCurrentPage(i)}
            className="w-8 h-8 p-0"
          >
            {i}
          </Button>
        );
      }
    }

    // Show ellipsis and last page
    if (currentPage < totalPages - 2) {
      pages.push(<span key="ellipsis2" className="px-2">...</span>);
    }

    if (totalPages > 1) {
      pages.push(
        <Button
          key={totalPages}
          variant={currentPage === totalPages ? "default" : "ghost"}
          size="sm"
          onClick={() => setCurrentPage(totalPages)}
          className="w-8 h-8 p-0"
        >
          {totalPages}
        </Button>
      );
    }

    return pages;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Attendance Logs</h1>
        <p className="text-muted-foreground">Real-time biometric sync data for student entries and exits.</p>
      </div>

      {/* Filters and Search */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by Student Name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-background"
            />
          </div>

          {/* Date Range */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={dateRange}
              readOnly
              className="pl-10 w-64 bg-background cursor-pointer"
            />
          </div>
        </div>

        {/* Apply Filters Button */}
        <Button className="bg-primary hover:bg-primary/90">
          <Filter className="h-4 w-4 mr-2" />
          Apply Filters
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="p-6">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b">
                <TableHead className="font-semibold">STUDENT NAME</TableHead>
                <TableHead className="font-semibold">ENTRY TIME</TableHead>
                <TableHead className="font-semibold">EXIT TIME</TableHead>
                <TableHead className="font-semibold">DURATION</TableHead>
                <TableHead className="font-semibold">STATUS</TableHead>
                <TableHead className="font-semibold text-center">ACTIONS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((student, index) => (
                <TableRow key={student.id} className="hover:bg-muted/50 transition-colors">
                  <TableCell className="py-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={`/placeholder-student-${index + 1}.jpg`} />
                        <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                          {student.avatar}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{student.name}</p>
                        <p className="text-sm text-muted-foreground">ID: {student.id}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{student.entryTime}</TableCell>
                  <TableCell className="font-medium">{student.exitTime}</TableCell>
                  <TableCell className="font-medium">{student.duration}</TableCell>
                  <TableCell>{getStatusBadge(student.status)}</TableCell>
                  <TableCell className="text-center">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/20">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Last synced: Just now</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Showing {startResult} to {endResult} of 124 results
            </span>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <div className="flex items-center gap-1">
                {renderPageNumbers()}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            Displaying results for all classrooms
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendanceLogs;