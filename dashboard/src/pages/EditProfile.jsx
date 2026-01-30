import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Camera, Phone, Mail, User, MapPin, Calendar, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import toast from 'react-hot-toast';

const EditProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // Mock data - same as StudentProfile
  const studentsDatabase = {
    'STU-2023-001': {
      id: 'STU-2023-001',
      name: 'John Doe',
      class: '10-A',
      rollNumber: '15',
      dateOfBirth: '2008-05-15',
      parentContact: '+1 (555) 123-4567',
      parentEmail: 'john.parent@email.com',
      address: '123 Main Street, Downtown, NY 10001',
      emergencyContact: '+1 (555) 987-6543',
      bloodGroup: 'A+',
      allergies: 'None',
      medicalConditions: 'None',
      attendanceRate: 98.2,
      daysPresent: '19/20',
      biometricStatus: '2 Fingerprints Registered',
      guardianName: 'Robert Doe',
      guardianRelation: 'Father',
      guardianOccupation: 'Software Engineer',
      avatar: null
    }
  };

  const studentData = studentsDatabase[id];
  
  const [formData, setFormData] = useState({
    name: studentData?.name || '',
    class: studentData?.class || '',
    rollNumber: studentData?.rollNumber || '',
    dateOfBirth: studentData?.dateOfBirth || '',
    parentContact: studentData?.parentContact || '',
    parentEmail: studentData?.parentEmail || '',
    address: studentData?.address || '',
    emergencyContact: studentData?.emergencyContact || '',
    bloodGroup: studentData?.bloodGroup || '',
    allergies: studentData?.allergies || '',
    medicalConditions: studentData?.medicalConditions || '',
    guardianName: studentData?.guardianName || '',
    guardianRelation: studentData?.guardianRelation || '',
    guardianOccupation: studentData?.guardianOccupation || ''
  });

  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast.success('Student profile updated successfully!');
      navigate(`/dashboard/students/${id}`);
    } catch (error) {
      toast.error('Failed to update profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!studentData) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-muted-foreground">Student Not Found</h2>
        <p className="text-muted-foreground mt-2">The requested student profile could not be found.</p>
        <Button 
          onClick={() => navigate('/dashboard/students')} 
          className="mt-4"
          variant="outline"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Students
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => navigate(`/dashboard/students/${id}`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Edit Profile</h1>
            <p className="text-muted-foreground">
              Modify student information and details
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={() => navigate(`/dashboard/students/${id}`)}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={isLoading}
          >
            <Save className="h-4 w-4 mr-2" />
            {isLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile Picture and Basic Info */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Profile Picture</CardTitle>
              <CardDescription>
                Update student's profile photo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-center">
                <div className="relative">
                  <Avatar className="h-32 w-32">
                    <AvatarImage src={studentData.avatar} />
                    <AvatarFallback className="text-2xl">
                      {studentData.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <Button 
                    size="icon" 
                    className="absolute bottom-0 right-0 rounded-full"
                    onClick={() => toast.info('Photo upload functionality coming soon')}
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="text-center space-y-2">
                <h3 className="font-semibold">{formData.name}</h3>
                <Badge variant="secondary">{formData.class}</Badge>
                <p className="text-sm text-muted-foreground">
                  Student ID: {studentData.id}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Form Fields */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Full Name</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="Enter full name"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Class</label>
                  <Input
                    value={formData.class}
                    onChange={(e) => handleInputChange('class', e.target.value)}
                    placeholder="Enter class"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Roll Number</label>
                  <Input
                    value={formData.rollNumber}
                    onChange={(e) => handleInputChange('rollNumber', e.target.value)}
                    placeholder="Enter roll number"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Date of Birth</label>
                  <Input
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Address</label>
                <Textarea
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  placeholder="Enter complete address"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Parent/Guardian Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Parent/Guardian Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Guardian Name</label>
                  <Input
                    value={formData.guardianName}
                    onChange={(e) => handleInputChange('guardianName', e.target.value)}
                    placeholder="Enter guardian name"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Relation</label>
                  <Input
                    value={formData.guardianRelation}
                    onChange={(e) => handleInputChange('guardianRelation', e.target.value)}
                    placeholder="e.g., Father, Mother"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Parent Contact</label>
                  <Input
                    value={formData.parentContact}
                    onChange={(e) => handleInputChange('parentContact', e.target.value)}
                    placeholder="Enter phone number"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Parent Email</label>
                  <Input
                    type="email"
                    value={formData.parentEmail}
                    onChange={(e) => handleInputChange('parentEmail', e.target.value)}
                    placeholder="Enter email address"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Emergency Contact</label>
                  <Input
                    value={formData.emergencyContact}
                    onChange={(e) => handleInputChange('emergencyContact', e.target.value)}
                    placeholder="Enter emergency contact"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Guardian Occupation</label>
                  <Input
                    value={formData.guardianOccupation}
                    onChange={(e) => handleInputChange('guardianOccupation', e.target.value)}
                    placeholder="Enter occupation"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Medical Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Medical Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Blood Group</label>
                  <select 
                    className="w-full p-2 border rounded-md bg-background"
                    value={formData.bloodGroup}
                    onChange={(e) => handleInputChange('bloodGroup', e.target.value)}
                  >
                    <option value="">Select Blood Group</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Allergies</label>
                  <Input
                    value={formData.allergies}
                    onChange={(e) => handleInputChange('allergies', e.target.value)}
                    placeholder="Enter any allergies or 'None'"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Medical Conditions</label>
                <Textarea
                  value={formData.medicalConditions}
                  onChange={(e) => handleInputChange('medicalConditions', e.target.value)}
                  placeholder="Enter any medical conditions or 'None'"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default EditProfile;