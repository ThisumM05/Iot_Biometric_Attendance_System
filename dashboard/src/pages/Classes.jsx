import React, { useState } from 'react';
import { Users, Plus, Calendar, Clock, MapPin, MoreHorizontal, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// Class data will be fetched from database
// Currently empty until database connection is established

// Recent activity data will be fetched from database

export default function Classes() {
  const [selectedClass, setSelectedClass] = useState(null);
  const [classes, setClasses] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  const getAttendanceColor = (rate) => {
    if (rate >= 90) return 'text-green-600';
    if (rate >= 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Classes</h1>
          <p className="text-muted-foreground mt-1">
            Manage class sections, schedules, and student assignments
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm">
            <Calendar className="h-4 w-4 mr-2" />
            Schedule View
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add New Class
          </Button>
        </div>
      </div>

      {/* Class Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {classes.map((classItem) => (
          <Card key={classItem.id} className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedClass(classItem)}>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{classItem.id}</CardTitle>
                  <CardDescription className="text-sm">{classItem.name}</CardDescription>
                </div>
                <Badge variant="outline" className="text-xs">
                  {classItem.totalStudents} students
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* Teacher */}
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={classItem.teacherAvatar} />
                    <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                      {classItem.teacher.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-muted-foreground">{classItem.teacher}</span>
                </div>

                {/* Attendance Today */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Today's Attendance</span>
                  <div className="text-right">
                    <div className="text-sm font-semibold">
                      {classItem.presentToday}/{classItem.totalStudents}
                    </div>
                    <div className={`text-xs ${getAttendanceColor(classItem.attendanceRate)}`}>
                      {classItem.attendanceRate}%
                    </div>
                  </div>
                </div>

                {/* Room & Schedule */}
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    <span>{classItem.room}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>{classItem.schedule.split(',')[1]}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Detailed Class List */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Class Details</CardTitle>
              <CardDescription>
                Comprehensive information about all class sections
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Class</TableHead>
                    <TableHead>Teacher</TableHead>
                    <TableHead>Students</TableHead>
                    <TableHead>Attendance Rate</TableHead>
                    <TableHead>Room</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classes.map((classItem) => (
                    <TableRow key={classItem.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{classItem.id}</div>
                          <div className="text-sm text-muted-foreground">{classItem.name}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={classItem.teacherAvatar} />
                            <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                              {classItem.teacher.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{classItem.teacher}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-center">
                          <div className="font-medium">{classItem.totalStudents}</div>
                          <div className="text-xs text-muted-foreground">
                            {classItem.presentToday} present today
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className={`font-semibold ${getAttendanceColor(classItem.attendanceRate)}`}>
                          {classItem.attendanceRate}%
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{classItem.room}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Latest updates and changes to classes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="border-l-2 border-primary/20 pl-4 pb-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{activity.action}</span>
                      <span className="text-xs text-muted-foreground">{activity.time}</span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      <Badge variant="outline" className="text-xs mr-2">{activity.class}</Badge>
                      {activity.student && <span>{activity.student}</span>}
                      {activity.details && <span>{activity.details}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}