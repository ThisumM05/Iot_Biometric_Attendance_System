import React, { useState, useEffect } from 'react';
import { Bell, MessageCircle, Mail, Settings, Send, Phone, CheckCircle2, Clock, AlertTriangle, RefreshCcw } from 'lucide-react';
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
  const [notifications, setNotifications] = useState([]);
  const [students, setStudents] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [messageTemplate, setMessageTemplate] = useState('absent');

  const messageTemplates = {
    absent: 'Dear Parent, your child {studentName} was marked absent today ({time}). Please contact the school if this is an error.',
    late: 'Dear Parent, your child {studentName} from class {class} arrived late today at {time}. Please ensure they arrive on time tomorrow.',
    early_dismissal: 'Dear Parent, your child {studentName} from class {class} was dismissed early today at {time}.',
    anomaly: 'Attendance Alert: Unusual pattern detected for {studentName} at {time}. Please verify with your child.',
    custom: ''
  };

  // Fetch users with WhatsApp numbers
  useEffect(() => {
    fetchStudents();
    fetchAnomalies();
  }, []);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5000/api/users');
      const data = await response.json();
      
      if (data.success) {
        // Filter students with WhatsApp numbers
        const studentsWithWhatsApp = data.data
          .filter(user => user.parentWhatsapp)
          .map(user => ({
            id: user._id,
            name: user.username,
            parentPhone: user.parentWhatsapp,
            class: user.class || 'N/A',
            email: user.email
          }));
        setStudents(studentsWithWhatsApp);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnomalies = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/attendance/anomalies?limit=20');
      const data = await response.json();
      
      if (data.success) {
        // Convert anomalies to notification format
        const anomalyNotifications = data.data.anomalies.map((anomaly, index) => ({
          id: `anomaly-${anomaly._id}`,
          type: 'whatsapp',
          recipient: `${anomaly.user_name}'s Parent`,
          message: `Anomaly Detected: ${anomaly.reason || anomaly.anomaly_types?.join(', ')}`,
          status: anomaly.severity === 'high' || anomaly.severity === 'critical' ? 'sent' : 'pending',
          timestamp: new Date(anomaly.detected_at).toLocaleString(),
          studentName: anomaly.user_name,
          severity: anomaly.severity,
          anomalyTypes: anomaly.anomaly_types || []
        }));
        setAnomalies(anomalyNotifications);
        setNotifications(anomalyNotifications);
      }
    } catch (error) {
      console.error('Error fetching anomalies:', error);
    }
  };

  // Auto-update message when recipients change
  const updateMessageTemplate = () => {
    if (selectedRecipients.length === 0) {
      setNewMessage(messageTemplates[messageTemplate] || '');
      return;
    }
    
    const selectedStudents = students.filter(s => selectedRecipients.includes(s.id));
    const currentTime = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    
    let updatedMessage = messageTemplates[messageTemplate] || newMessage;
    
    // For single student, replace with specific name
    if (selectedStudents.length === 1) {
      updatedMessage = updatedMessage
        .replace(/{studentName}/g, selectedStudents[0].name)
        .replace(/{time}/g, currentTime)
        .replace(/{class}/g, selectedStudents[0].class);
    } else {
      // For multiple students, keep placeholders
      updatedMessage = updatedMessage
        .replace(/{time}/g, currentTime);
    }
    
    setNewMessage(updatedMessage);
  };
  
  // Update message when recipients or template change
  useEffect(() => {
    updateMessageTemplate();
  }, [selectedRecipients, messageTemplate, students]);

  const [settings, setSettings] = useState({
    whatsappEnabled: true,
    emailEnabled: true,
    autoNotifyAbsent: true,
    autoNotifyLate: true,
    dailyReports: false
  });

  const sendWhatsAppMessage = async (recipients, message) => {
    try {
      const results = await Promise.all(
        recipients.map(async (recipient) => {
          const currentTime = new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          });
          
          const personalizedMessage = message
            .replace(/{studentName}/g, recipient.name)
            .replace(/{time}/g, currentTime)
            .replace(/{class}/g, recipient.class);
          
          // Call actual backend API to send WhatsApp message
          const response = await fetch('http://localhost:5000/api/notifications/whatsapp', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              studentName: recipient.name,
              parentWhatsapp: recipient.parentPhone,
              message: personalizedMessage,
              type: 'manual_notification'
            })
          });
          
          const result = await response.json();
          
          if (result.success) {
            console.log(`✅ WhatsApp sent to ${recipient.parentPhone}:`, personalizedMessage);
            return {
              success: true,
              recipient: recipient.name,
              phone: recipient.parentPhone,
              messageId: result.messageId
            };
          } else {
            console.error(`❌ Failed to send to ${recipient.parentPhone}:`, result.error);
            return {
              success: false,
              recipient: recipient.name,
              phone: recipient.parentPhone,
              error: result.error
            };
          }
        })
      );

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      if (successful > 0) {
        toast.success(`✅ Successfully sent ${successful} WhatsApp message(s)`);
      }
      if (failed > 0) {
        toast.error(`❌ Failed to send ${failed} message(s)`);
      }
      
      // Add to notification history
      const newNotifications = recipients.map((recipient, index) => ({
        id: Date.now() + index,
        type: 'whatsapp',
        recipient: `${recipient.name}'s Parent (${recipient.parentPhone})`,
        message: message
          .replace(/{studentName}/g, recipient.name)
          .replace(/{time}/g, new Date().toLocaleTimeString())
          .replace(/{class}/g, recipient.class),
        status: results[index].success ? 'sent' : 'failed',
        timestamp: new Date().toLocaleString(),
        studentName: recipient.name,
        studentId: recipient.id
      }));

      setNotifications(prev => [...newNotifications, ...prev]);
      
      return results;
    } catch (error) {
      console.error('Error sending WhatsApp:', error);
      toast.error('Failed to send WhatsApp messages: ' + error.message);
      return [];
    }
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
            Send alerts and manage communication with parents ({students.length} students with WhatsApp)
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { fetchStudents(); fetchAnomalies(); }}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button>
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
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
                      // Auto-update message when template changes
                      setTimeout(() => updateMessageTemplate(), 100);
                    }}
                  >
                    <option value="absent">Absent Alert</option>
                    <option value="late">Late Arrival</option>
                    <option value="early_dismissal">Early Dismissal</option>
                    <option value="anomaly">Anomaly Alert</option>
                    <option value="custom">Custom Message</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Recipients ({selectedRecipients.length} selected)
                    {selectedRecipients.length > 0 && (
                      <button 
                        onClick={() => setSelectedRecipients([])}
                        className="ml-2 text-xs text-red-500 hover:text-red-700"
                      >
                        Clear all
                      </button>
                    )}
                  </label>
                  {loading ? (
                    <div className="text-sm text-muted-foreground">Loading students...</div>
                  ) : students.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      No students with WhatsApp numbers found. Add parent WhatsApp numbers in User Management.
                    </div>
                  ) : (
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-muted-foreground">Select students:</span>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => setSelectedRecipients(students.map(s => s.id))}
                            className="text-xs text-blue-500 hover:text-blue-700"
                          >
                            Select All
                          </button>
                          <button 
                            onClick={() => setSelectedRecipients([])}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            Clear All
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-2">
                        {students.map((student) => (
                          <div key={student.id} className="flex items-center space-x-2 hover:bg-muted/50 p-1 rounded">
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
                            <label htmlFor={student.id} className="text-sm flex-1 cursor-pointer">
                              <span className="font-medium">{student.name}</span>
                              <span className="text-muted-foreground ml-2">({student.class})</span>
                              <br />
                              <span className="text-xs text-muted-foreground">{student.parentPhone}</span>
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Message History</CardTitle>
                  <CardDescription>
                    Recent notifications and delivery status ({notifications.length} total)
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={fetchAnomalies}>
                  <RefreshCcw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading notifications...
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No notifications found. Anomalies and sent messages will appear here.
                </div>
              ) : (
                <div className="space-y-4">
                  {notifications.map((notification) => (
                    <div key={notification.id} className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/30 transition-colors">
                      <div className="flex items-center space-x-2">
                        {getTypeIcon(notification.type)}
                        {getStatusIcon(notification.status)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium">{notification.recipient}</p>
                          <div className="flex gap-2">
                            {notification.severity && (
                              <Badge 
                                variant={
                                  notification.severity === 'critical' ? 'destructive' : 
                                  notification.severity === 'high' ? 'default' : 
                                  'secondary'
                                }
                              >
                                {notification.severity}
                              </Badge>
                            )}
                            <Badge variant={
                              notification.status === 'sent' || notification.status === 'delivered' ? 'default' : 
                              notification.status === 'pending' ? 'secondary' : 
                              'destructive'
                            }>
                              {notification.status}
                            </Badge>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <p className="text-xs text-muted-foreground">
                            {new Date(notification.timestamp).toLocaleString()} • {notification.studentName}
                          </p>
                          {notification.anomalyTypes && (
                            <Badge variant="outline" className="text-xs">
                              {notification.anomalyTypes}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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