import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, UserPlus, Download, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import AddStudentModal from '@/components/AddStudentModal';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// Students data will be fetched from database
// Currently empty until database connection is established

export default function StudentProfileView() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('All');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Fetch students from API when component mounts
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        setLoading(true);
        const response = await fetch('http://localhost:5000/api/users');
        const result = await response.json();
        
        if (result.success) {
          // Filter only students and format the data for display
          const studentData = result.data
            .filter(user => user.role === 'student')
            .map(user => ({
              id: user._id,
              name: user.username,
              class: user.class || 'Not Assigned',
              attendanceRate: Math.floor(Math.random() * 20) + 80, // TODO: Calculate from actual attendance
              daysPresent: `${Math.floor(Math.random() * 5) + 18}/23`, // TODO: Calculate from actual attendance
              lastSeen: user.createdAt ? new Date(user.createdAt).toLocaleString() : 'Never',
              status: user.isEnrolled ? 'Present' : 'Not Enrolled',
              biometricStatus: user.isEnrolled ? `Enrolled - FP${user.fingerprintId}` : 'Not Enrolled',
              avatar: null,
              email: user.email,
              parentWhatsapp: user.parentWhatsapp
            }));
          
          setStudents(studentData);
        } else {
          console.error('Failed to fetch students:', result.message);
        }
      } catch (error) {
        console.error('Error fetching students:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold tracking-tight mb-4">User Profile View</h1>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
            <p>Loading students...</p>
          </div>
        </div>
      </div>
    );
  }

  const handleStudentClick = (studentId) => {
    navigate(`/students/${studentId}`);
  };

  const handleAddStudent = () => {
    setIsAddModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsAddModalOpen(false);
  };

  const filteredStudents = students.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         student.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClass = selectedClass === 'All' || student.class === selectedClass;
    return matchesSearch && matchesClass;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Present':
        return <Badge variant="present">PRESENT</Badge>;
      case 'Late':
        return <Badge variant="late">LATE</Badge>;
      case 'Absent':
        return <Badge variant="absent">ABSENT</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User Profile View</h1>
          <p className="text-muted-foreground mt-1">
            View and manage student profiles with attendance records and biometric enrollment status
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button size="sm" onClick={handleAddStudent}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add New Student
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by Student Name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <select 
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          className="px-3 py-2 border border-input bg-background rounded-md text-sm"
        >
          <option value="All">All Classes</option>
          <option value="10-A">Class 10-A</option>
          <option value="10-B">Class 10-B</option>
          <option value="10-C">Class 10-C</option>
        </select>
        <Button variant="outline" size="sm">
          <Filter className="h-4 w-4 mr-2" />
          Apply Filters
        </Button>
      </div>

      {/* Students Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Student ID</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Attendance Rate</TableHead>
              <TableHead>Days Present</TableHead>
              <TableHead>Last Seen</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStudents.map((student) => (
              <TableRow 
                key={student.id} 
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleStudentClick(student.id)}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={student.avatar} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {student.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{student.name}</div>
                      <div className="text-sm text-muted-foreground">{student.biometricStatus}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-mono text-sm">{student.id}</div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{student.class}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="text-lg font-semibold">{student.attendanceRate}%</div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{student.daysPresent}</div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">{student.lastSeen}</div>
                </TableCell>
                <TableCell>
                  {getStatusBadge(student.status)}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing <span className="font-medium">{filteredStudents.length}</span> of {students.length} students
        </p>
        <div className="text-sm text-muted-foreground">
          Last updated: Just now
        </div>
      </div>

      {/* Add Student Modal */}
      <AddStudentModal 
        isOpen={isAddModalOpen} 
        onClose={handleCloseModal} 
      />
    </div>
  );
}