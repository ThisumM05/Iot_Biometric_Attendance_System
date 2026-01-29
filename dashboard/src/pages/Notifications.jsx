import React, { useState, useEffect } from 'react';
import { Bell, MessageCircle, Mail, Settings, Send, Phone, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import toast from 'react-hot-toast';

const Notifications = () => {
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      type: 'whatsapp',
      recipient: 'John Doe\'s Parent',
      message: 'Your child John was marked absent today.',
      status: 'delivered',
      timestamp: '2 hours ago',
      studentName: 'John Doe',
      studentId: 'STU-2023-001'
    },
    {
      id: 2,
      type: 'email',
      recipient: 'alice.parent@email.com',
      message: 'Daily attendance report for Alice Smith',
      status: 'sent',
      timestamp: '1 hour ago',
      studentName: 'Alice Smith',
      studentId: 'STU-2023-002'
    },
    {
      id: 3,
      type: 'whatsapp',
      recipient: 'Michael Jordan\'s Parent',
      message: 'Your child arrived late today at 08:45 AM',
      status: 'pending',
      timestamp: '30 minutes ago',
      studentName: 'Michael Jordan',
      studentId: 'STU-2023-003'
    }
  ]);

  const [newMessage, setNewMessage] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [messageTemplate, setMessageTemplate] = useState('absent');

  const messageTemplates = {
    absent: 'Dear Parent, your child {studentName} was marked absent today. Please contact the school if this is an error.',
    late: 'Dear Parent, your child {studentName} arrived late today at {time}. Please ensure they arrive on time tomorrow.',
    early_dismissal: 'Dear Parent, your child {studentName} was dismissed early today at {time}.',
    custom: ''
  };

  const students = [
    { id: 'STU-2023-001', name: 'John Doe', parentPhone: '+1234567890' },
    { id: 'STU-2023-002', name: 'Alice Smith', parentPhone: '+1234567891' },
    { id: 'STU-2023-003', name: 'Michael Jordan', parentPhone: '+1234567892' },
    { id: 'STU-2023-004', name: 'Sarah Wilson', parentPhone: '+1234567893' },
  ];

  const [settings, setSettings] = useState({
    whatsappEnabled: true,
    emailEnabled: true,
    autoNotifyAbsent: true,
    autoNotifyLate: true,
    dailyReports: false
  });

  const sendWhatsAppMessage = (recipients, message) => {
    // Simulate WhatsApp API call
    toast.success(`WhatsApp message sent to ${recipients.length} recipient(s)`);
    
    const newNotification = {
      id: Date.now(),
      type: 'whatsapp',
      recipient: recipients.map(r => r.name).join(', '),
      message: message,
      status: 'sent',
      timestamp: 'Just now',
      studentName: recipients.map(r => r.name).join(', '),
      studentId: recipients.map(r => r.id).join(', ')
    };

    setNotifications(prev => [newNotification, ...prev]);
  };

  const sendBulkMessage = () => {
    if (!newMessage.trim() || selectedRecipients.length === 0) {
      toast.error('Please select recipients and enter a message');
      return;
    }

    const selectedStudents = students.filter(s => selectedRecipients.includes(s.id));
    sendWhatsAppMessage(selectedStudents, newMessage);
    setNewMessage('');
    setSelectedRecipients([]);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'delivered':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'sent':
        return <CheckCircle2 className="h-4 w-4 text-blue-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'failed':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'whatsapp':
        return <MessageCircle className="h-4 w-4 text-green-600" />;
      case 'email':
        return <Mail className="h-4 w-4 text-blue-600" />;
      case 'sms':
        return <Phone className="h-4 w-4 text-purple-600" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">
            Send alerts and manage communication with parents
          </p>
        </div>
        <Button>
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </Button>
      </div>

      <Tabs defaultValue="send" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="send">Send Message</TabsTrigger>
          <TabsTrigger value="history">Message History</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="send" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-green-600" />
                  WhatsApp Alerts
                </CardTitle>
                <CardDescription>
                  Send instant messages to parents via WhatsApp
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Message Template</label>
                  <select 
                    className="w-full p-2 border rounded-md bg-background"
                    value={messageTemplate}
                    onChange={(e) => {
                      setMessageTemplate(e.target.value);
                      setNewMessage(messageTemplates[e.target.value]);
                    }}
                  >
                    <option value="absent">Absent Alert</option>
                    <option value="late">Late Arrival</option>
                    <option value="early_dismissal">Early Dismissal</option>
                    <option value="custom">Custom Message</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Recipients</label>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {students.map((student) => (
                      <div key={student.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={student.id}
                          checked={selectedRecipients.includes(student.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedRecipients(prev => [...prev, student.id]);
                            } else {
                              setSelectedRecipients(prev => prev.filter(id => id !== student.id));
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                        <label htmlFor={student.id} className="text-sm">
                          {student.name} ({student.parentPhone})
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Message</label>
                  <Textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Enter your message..."
                    rows={4}
                  />
                </div>

                <Button 
                  onClick={sendBulkMessage}
                  className="w-full"
                  disabled={selectedRecipients.length === 0 || !newMessage.trim()}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send WhatsApp Message
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>
                  Common notification scenarios
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => {
                    setMessageTemplate('absent');
                    setNewMessage(messageTemplates.absent);
                  }}
                >
                  <AlertTriangle className="h-4 w-4 mr-2 text-red-500" />
                  Notify Absent Students
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => {
                    setMessageTemplate('late');
                    setNewMessage(messageTemplates.late);
                  }}
                >
                  <Clock className="h-4 w-4 mr-2 text-yellow-500" />
                  Notify Late Arrivals
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => {
                    toast.success('Daily reports will be sent at 3:00 PM');
                  }}
                >
                  <Mail className="h-4 w-4 mr-2 text-blue-500" />
                  Send Daily Reports
                </Button>

                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => {
                    const absentStudents = students.slice(0, 2); // Simulate absent students
                    sendWhatsAppMessage(absentStudents, messageTemplates.absent);
                  }}
                >
                  <MessageCircle className="h-4 w-4 mr-2 text-green-500" />
                  Bulk Absence Alert
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Message History</CardTitle>
              <CardDescription>
                Recent notifications and delivery status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {notifications.map((notification) => (
                  <div key={notification.id} className="flex items-start space-x-3 p-4 border rounded-lg">
                    <div className="flex items-center space-x-2">
                      {getTypeIcon(notification.type)}
                      {getStatusIcon(notification.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{notification.recipient}</p>
                        <Badge variant={notification.status === 'delivered' ? 'default' : 'secondary'}>
                          {notification.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {notification.timestamp} • {notification.studentName}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>
                Configure automated notifications and alerts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">WhatsApp Notifications</p>
                  <p className="text-sm text-muted-foreground">Enable WhatsApp alerts for parents</p>
                </div>
                <Switch 
                  checked={settings.whatsappEnabled}
                  onCheckedChange={(checked) => 
                    setSettings(prev => ({ ...prev, whatsappEnabled: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Email Notifications</p>
                  <p className="text-sm text-muted-foreground">Send email alerts and reports</p>
                </div>
                <Switch 
                  checked={settings.emailEnabled}
                  onCheckedChange={(checked) => 
                    setSettings(prev => ({ ...prev, emailEnabled: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Auto-notify Absences</p>
                  <p className="text-sm text-muted-foreground">Automatically notify parents of absences</p>
                </div>
                <Switch 
                  checked={settings.autoNotifyAbsent}
                  onCheckedChange={(checked) => 
                    setSettings(prev => ({ ...prev, autoNotifyAbsent: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Auto-notify Late Arrivals</p>
                  <p className="text-sm text-muted-foreground">Automatically notify parents of late arrivals</p>
                </div>
                <Switch 
                  checked={settings.autoNotifyLate}
                  onCheckedChange={(checked) => 
                    setSettings(prev => ({ ...prev, autoNotifyLate: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Daily Reports</p>
                  <p className="text-sm text-muted-foreground">Send daily attendance reports to parents</p>
                </div>
                <Switch 
                  checked={settings.dailyReports}
                  onCheckedChange={(checked) => 
                    setSettings(prev => ({ ...prev, dailyReports: checked }))
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Notifications;