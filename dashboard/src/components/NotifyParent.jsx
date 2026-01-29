import React, { useState } from 'react';
import { X, Send, MessageCircle, Mail, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import toast from 'react-hot-toast';

const NotifyParent = ({ student, isOpen, onClose }) => {
  const [message, setMessage] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('whatsapp');
  const [messageTemplate, setMessageTemplate] = useState('custom');
  const [isLoading, setIsLoading] = useState(false);

  const templates = {
    absent: `Dear ${student?.guardianName || 'Parent'},

Your child ${student?.name} was marked absent today. If this is an error, please contact the school immediately.

Best regards,
BioTrack IoT School`,
    
    late: `Dear ${student?.guardianName || 'Parent'},

Your child ${student?.name} arrived late to school today. Please ensure they arrive on time tomorrow.

Best regards,
BioTrack IoT School`,
    
    custom: '',
    
    general: `Dear ${student?.guardianName || 'Parent'},

We wanted to update you about ${student?.name}'s school activities. Please contact us if you have any questions.

Best regards,
BioTrack IoT School`
  };

  const handleTemplateChange = (template) => {
    setMessageTemplate(template);
    setMessage(templates[template]);
  };

  const handleSendMessage = async () => {
    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }

    setIsLoading(true);
    try {
      // Simulate sending message
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const methodNames = {
        whatsapp: 'WhatsApp',
        email: 'Email',
        sms: 'SMS'
      };

      toast.success(`${methodNames[selectedMethod]} sent successfully to ${student.guardianName}`);
      onClose();
      setMessage('');
    } catch (error) {
      toast.error('Failed to send message. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Notify Parent</CardTitle>
              <CardDescription>
                Send a message to {student?.name}'s parent/guardian
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Student Info */}
          <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg">
            <div>
              <p className="font-medium">{student?.name}</p>
              <p className="text-sm text-muted-foreground">
                Class: {student?.class} | Guardian: {student?.guardianName} ({student?.guardianRelation})
              </p>
              <p className="text-sm text-muted-foreground">
                Contact: {student?.parentContact} | Email: {student?.parentEmail}
              </p>
            </div>
          </div>

          <Tabs value={selectedMethod} onValueChange={setSelectedMethod}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="whatsapp" className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </TabsTrigger>
              <TabsTrigger value="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email
              </TabsTrigger>
              <TabsTrigger value="sms" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                SMS
              </TabsTrigger>
            </TabsList>

            <TabsContent value="whatsapp" className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Message Template</label>
                <select 
                  className="w-full p-2 border rounded-md bg-background"
                  value={messageTemplate}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                >
                  <option value="absent">Absence Alert</option>
                  <option value="late">Late Arrival</option>
                  <option value="general">General Update</option>
                  <option value="custom">Custom Message</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">WhatsApp Message</label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Enter your WhatsApp message..."
                  rows={6}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Will be sent to: {student?.parentContact}
                </p>
              </div>
            </TabsContent>

            <TabsContent value="email" className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Message Template</label>
                <select 
                  className="w-full p-2 border rounded-md bg-background"
                  value={messageTemplate}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                >
                  <option value="absent">Absence Alert</option>
                  <option value="late">Late Arrival</option>
                  <option value="general">General Update</option>
                  <option value="custom">Custom Message</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Email Message</label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Enter your email message..."
                  rows={6}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Will be sent to: {student?.parentEmail}
                </p>
              </div>
            </TabsContent>

            <TabsContent value="sms" className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Message Template</label>
                <select 
                  className="w-full p-2 border rounded-md bg-background"
                  value={messageTemplate}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                >
                  <option value="absent">Absence Alert</option>
                  <option value="late">Late Arrival</option>
                  <option value="general">General Update</option>
                  <option value="custom">Custom Message</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">SMS Message</label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Enter your SMS message..."
                  rows={4}
                  maxLength={160}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {message.length}/160 characters • Will be sent to: {student?.parentContact}
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button 
              onClick={handleSendMessage} 
              disabled={isLoading || !message.trim()}
              className="flex-1"
            >
              <Send className="h-4 w-4 mr-2" />
              {isLoading ? 'Sending...' : `Send ${selectedMethod === 'whatsapp' ? 'WhatsApp' : selectedMethod === 'email' ? 'Email' : 'SMS'}`}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotifyParent;