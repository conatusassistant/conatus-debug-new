'use client';

import { useRouter } from 'next/navigation';
import AutomationWorkflowBuilder from '../../../../components/automation/AutomationWorkflowBuilder';

export default function CreateAutomationPage() {
  const router = useRouter();
  
  const handleSave = (workflow: any) => {
    // In a real implementation, this would save to the backend via API
    console.log('Saving workflow:', workflow);
    
    // Show success alert
    alert('Automation created successfully!');
    
    // Redirect to the library page
    router.push('/library');
  };
  
  const handleCancel = () => {
    // Redirect back to library page on cancel
    router.push('/library');
  };
  
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-8">Create New Automation</h1>
      
      <AutomationWorkflowBuilder 
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </div>
  );
}
