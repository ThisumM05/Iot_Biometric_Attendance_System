// Student Behavior Analytics Page
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

const StudentBehavior = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Student Behavior Analytics</h1>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Analytics Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Student behavior analytics and forecasting features will be added here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentBehavior;