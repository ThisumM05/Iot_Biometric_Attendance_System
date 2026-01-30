import React, { useState, useEffect } from 'react';
import { X, User, BookOpen, Fingerprint, CheckCircle, AlertCircle, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import toast from 'react-hot-toast';
import rabbitMQService from '@/services/rabbitMQService';

const studentSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  class: z.string().min(1, 'Class is required'),
  parentNumber: z.string().min(10, 'Parent number must be at least 10 digits').regex(/^[0-9+\-\s()]+$/, 'Invalid phone number format'),
});

const AddStudentModal = ({ isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState('form'); // 'form', 'scanning', 'success', 'error'
  const [scanningProgress, setScanningProgress] = useState(0);
  const [registrationStatus, setRegistrationStatus] = useState('waiting');

  const { register, handleSubmit, formState: { errors }, reset } = useForm({
    resolver: zodResolver(studentSchema)
  });

  useEffect(() => {
    if (isOpen) {
      // Connect to RabbitMQ service when modal opens
      if (!rabbitMQService.getStatus().connected) {
        rabbitMQService.connect();
      }

      // Set up event listeners
      rabbitMQService.on('scan_progress', setScanningProgress);
      rabbitMQService.on('scan_complete', handleScanSuccess);
      rabbitMQService.on('scan_failed', handleScanError);
      rabbitMQService.on('registration_timeout', handleTimeout);

      return () => {
        // Clean up event listeners
        rabbitMQService.off('scan_progress', setScanningProgress);
        rabbitMQService.off('scan_complete', handleScanSuccess);
        rabbitMQService.off('scan_failed', handleScanError);
        rabbitMQService.off('registration_timeout', handleTimeout);
      };
    }
  }, [isOpen]);

  const handleScanSuccess = (studentData) => {
    setCurrentStep('success');
    setRegistrationStatus('complete');
    toast.success('Student registered successfully!');
    setTimeout(() => {
      handleClose();
    }, 2000);
  };

  const handleScanError = (error) => {
    setCurrentStep('error');
    setRegistrationStatus('error');
    toast.error('Fingerprint registration failed. Please try again.');
  };

  const handleTimeout = () => {
    setCurrentStep('error');
    setRegistrationStatus('timeout');
    toast.error('Registration timeout. Please try again.');
  };

  const onSubmit = async (data) => {
    try {
      setCurrentStep('scanning');
      setScanningProgress(0);
      setRegistrationStatus('scanning');

      // Switch to register mode
      rabbitMQService.switchToRegisterMode();

      // Send student data for registration
      const studentData = {
        name: data.name,
        class: data.class,
        parentNumber: data.parentNumber,
        id: `STU-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`
      };

      rabbitMQService.registerStudent(studentData);

      // Start scanning timeout (30 seconds)
      setTimeout(() => {
        if (currentStep === 'scanning') {
          handleTimeout();
        }
      }, 30000);

    } catch (error) {
      console.error('Registration error:', error);
      toast.error('Failed to start registration process');
      setCurrentStep('error');
    }
  };

  const handleClose = () => {
    // Switch back to login mode before closing
    rabbitMQService.switchToLoginMode();
    
    setCurrentStep('form');
    setScanningProgress(0);
    setRegistrationStatus('waiting');
    reset();
    onClose();
  };

  const handleRetry = () => {
    setCurrentStep('form');
    setScanningProgress(0);
    setRegistrationStatus('waiting');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Add New Student
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6">
          {currentStep === 'form' && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Student Name
                </Label>
                <Input
                  id="name"
                  {...register('name')}
                  placeholder="Enter student full name"
                  className={errors.name ? 'border-red-500' : ''}
                />
                {errors.name && (
                  <p className="text-sm text-red-500">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="class" className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Class
                </Label>
                <Input
                  id="class"
                  {...register('class')}
                  placeholder="e.g., 10-A, 11-B"
                  className={errors.class ? 'border-red-500' : ''}
                />
                {errors.class && (
                  <p className="text-sm text-red-500">{errors.class.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="parentNumber" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Parent Phone Number
                </Label>
                <Input
                  id="parentNumber"
                  {...register('parentNumber')}
                  placeholder="e.g., +1234567890, (123) 456-7890"
                  className={errors.parentNumber ? 'border-red-500' : ''}
                />
                {errors.parentNumber && (
                  <p className="text-sm text-red-500">{errors.parentNumber.message}</p>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1">
                  Start Registration
                </Button>
              </div>
            </form>
          )}

          {currentStep === 'scanning' && (
            <div className="text-center space-y-6">
              <div className="relative mx-auto w-32 h-32">
                {/* Animated fingerprint scanning visual */}
                <div className="absolute inset-0 rounded-full bg-blue-100 dark:bg-blue-900/30 animate-pulse"></div>
                <div className="absolute inset-2 rounded-full bg-blue-200 dark:bg-blue-800/50 animate-pulse animation-delay-75"></div>
                <div className="absolute inset-4 rounded-full bg-blue-300 dark:bg-blue-700/70 animate-pulse animation-delay-150"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Fingerprint className="h-16 w-16 text-blue-600 dark:text-blue-400 animate-bounce" />
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Scanning Fingerprint
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Please place your finger on the biometric scanner
                </p>

                {/* Progress bar */}
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${scanningProgress}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {scanningProgress}% Complete
                </p>
              </div>

              <Button
                variant="outline"
                onClick={handleClose}
                className="w-full"
              >
                Cancel Registration
              </Button>
            </div>
          )}

          {currentStep === 'success' && (
            <div className="text-center space-y-6">
              <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Registration Successful!
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Student has been registered successfully
                </p>
              </div>
            </div>
          )}

          {currentStep === 'error' && (
            <div className="text-center space-y-6">
              <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Registration Failed
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {registrationStatus === 'timeout' 
                    ? 'Registration timed out. Please try again.'
                    : 'Failed to register fingerprint. Please try again.'
                  }
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1"
                >
                  Close
                </Button>
                <Button
                  onClick={handleRetry}
                  className="flex-1"
                >
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddStudentModal;