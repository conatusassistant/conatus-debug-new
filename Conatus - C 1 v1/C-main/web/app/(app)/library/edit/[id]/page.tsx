'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AutomationWorkflowBuilder from '../../../../../components/automation/AutomationWorkflowBuilder';

// Sample automation for demo purposes
const sampleAutomation = {
  id: '123',
  name: 'Daily Weather Alert',
  description: 'Sends a weather notification every morning at 7 AM',
  triggerConfig: {
    type: 'time',
    schedule: '0 7 * * *', // 7 AM daily
    timezone: 'America/New_York'
  },
  conditionalLogic: {
    rootGroup: {
      id: 'group1',
      logicalOperator: 'and',
      conditions: [
        {
          id: 'condition1',
          variable: {
            id: 'weather_condition',
            name: 'Weather Condition',
            path: 'system.weather.condition',
            valueType: 'string',
            source: 'system',
            description: 'Current weather condition',
            category: 'Weather'
          },
          operator: 'contains',
          value: 'rain'
        },
        {
          id: 'condition2',
          variable: {
            id: 'current_day_of_week',
            name: 'Day of Week',
            path: 'system.dayOfWeek',
            valueType: 'number',
            source: 'system',
            description: 'Current day of week (0-6)',
            category: 'System'
          },
          operator: 'lessThan',
          value: 6 // Monday-Friday (not Saturday)
        }
      ]
    }
  },
  actions: [
    {
      id: 'action1',
      type: 'notification',
      title: 'Weather Alert',
      message: 'It might rain today. Remember to take an umbrella!'
    }
  ],
  createdAt: '2025-03-15T12:00:00Z',
  updatedAt: '2025-03-15T12:00:00Z',
  isActive: true
};

export default function EditAutomationPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { id } = params;
  const [automation, setAutomation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // In a real implementation, this would fetch from the backend API
    // For demo purposes, we'll use the sample automation
    setTimeout(() => {
      setAutomation(sampleAutomation);
      setLoading(false);
    }, 500); // Simulate loading
  }, [id]);
  
  const handleSave = (updatedWorkflow: any) => {
    // In a real implementation, this would update via API
    console.log('Updating workflow:', updatedWorkflow);
    
    // Show success alert
    alert('Automation updated successfully!');
    
    // Redirect to the library page
    router.push('/library');
  };
  
  const handleCancel = () => {
    // Redirect back to library page on cancel
    router.push('/library');
  };
  
  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-8">Edit Automation</h1>
      
      <AutomationWorkflowBuilder 
        initialData={automation}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </div>
  );
}
