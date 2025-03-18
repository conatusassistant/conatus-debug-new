'use client';

import { useState, useEffect } from 'react';
import { FileText, Zap, Filter, Play, CheckCircle } from 'lucide-react';
import { ConditionalExpression, ConditionalExpressionType } from './logic';
import { getAvailableVariables } from '../../lib/variableUtils';

// Workflow step type
type WorkflowStep = 'info' | 'trigger' | 'conditions' | 'actions' | 'review';

// Simplified workflow data structure (for example purposes)
interface AutomationWorkflow {
  id?: string;
  name: string;
  description?: string;
  isActive?: boolean;
  triggerConfig: {
    type: 'time' | 'event' | 'location';
    [key: string]: any;
  };
  conditionalLogic?: ConditionalExpressionType;
  actions: any[];
  createdAt?: string;
  updatedAt?: string;
}

interface AutomationWorkflowBuilderProps {
  initialData?: AutomationWorkflow;
  onSave?: (workflow: AutomationWorkflow) => void;
  onCancel?: () => void;
}

// Create a unique ID
const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15);
};

// Default workflow data
const defaultWorkflow: AutomationWorkflow = {
  name: '',
  triggerConfig: {
    type: 'time'
  },
  actions: []
};

export default function AutomationWorkflowBuilder({
  initialData,
  onSave,
  onCancel
}: AutomationWorkflowBuilderProps) {
  // Workflow data
  const [workflow, setWorkflow] = useState<AutomationWorkflow>(
    initialData || defaultWorkflow
  );
  
  // Current step in the workflow builder
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('info');
  
  // Step validity tracking
  const [stepValidity, setStepValidity] = useState<Record<WorkflowStep, boolean>>({
    info: false,
    trigger: false,
    conditions: true, // Optional step, default to valid
    actions: false,
    review: true // Review is always valid
  });
  
  // Initialize step validity based on initial data
  useEffect(() => {
    if (initialData) {
      setStepValidity({
        ...stepValidity,
        info: Boolean(initialData.name),
        trigger: Boolean(initialData.triggerConfig?.type),
        actions: initialData.actions.length > 0
      });
    }
  }, [initialData]);
  
  // Handle workflow update
  const handleWorkflowUpdate = (field: keyof AutomationWorkflow, value: any) => {
    setWorkflow(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  // Update step validity
  const setStepValid = (step: WorkflowStep, isValid: boolean) => {
    setStepValidity(prev => ({
      ...prev,
      [step]: isValid
    }));
  };
  
  // Check if all required steps are valid
  const canSave = () => {
    return (
      stepValidity.info &&
      stepValidity.trigger &&
      stepValidity.actions
    );
  };
  
  // Save the workflow
  const handleSave = () => {
    if (canSave() && onSave) {
      // Add timestamps and ID if new
      const now = new Date().toISOString();
      const finalWorkflow = {
        ...workflow,
        id: workflow.id || generateId(),
        updatedAt: now,
        createdAt: workflow.createdAt || now
      };
      
      onSave(finalWorkflow);
    }
  };
  
  // Steps configuration
  const steps = [
    { id: 'info', name: 'Basic Info', icon: FileText },
    { id: 'trigger', name: 'Trigger', icon: Zap },
    { id: 'conditions', name: 'Conditions', icon: Filter }, // New conditions step
    { id: 'actions', name: 'Actions', icon: Play },
    { id: 'review', name: 'Review', icon: CheckCircle }
  ];
  
  return (
    <div className="max-w-4xl mx-auto">
      {/* Steps navigation */}
      <div className="mb-8">
        <nav>
          <ol className="flex items-center">
            {steps.map((step, index) => {
              const isActive = step.id === currentStep;
              const isCompleted = index === steps.length - 1 
                ? canSave() 
                : stepValidity[step.id as WorkflowStep];
              
              return (
                <li key={step.id} className="relative flex items-center">
                  {/* Line connector */}
                  {index > 0 && (
                    <div
                      className={`absolute left-0 inset-0 flex items-center`}
                      aria-hidden="true"
                    >
                      <div
                        className={`h-0.5 w-full ${isCompleted ? 'bg-blue-600' : 'bg-gray-200'}`}
                      />
                    </div>
                  )}
                  
                  {/* Step button */}
                  <button
                    type="button"
                    onClick={() => setCurrentStep(step.id as WorkflowStep)}
                    className={`relative flex h-8 w-8 items-center justify-center rounded-full ${isActive
                      ? 'bg-blue-600 text-white'
                      : isCompleted
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border-2 border-gray-300 text-gray-500'
                    }`}
                  >
                    <step.icon className="h-5 w-5" />
                    <span className="sr-only">{step.name}</span>
                  </button>
                  
                  {/* Step label */}
                  <span className="ml-2 text-sm font-medium text-gray-900">
                    {step.name}
                  </span>
                  
                  {/* Spacer */}
                  {index < steps.length - 1 && <div className="flex-grow mx-4" />}
                </li>
              );
            })}
          </ol>
        </nav>
      </div>
      
      {/* Step content */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {/* Basic info step */}
        {currentStep === 'info' && (
          <div className="p-6 space-y-6">
            <h2 className="text-xl font-semibold">Basic Information</h2>
            <p className="text-gray-600">
              Enter a name and optional description for your automation.
            </p>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Name*
                </label>
                <input
                  type="text"
                  id="name"
                  value={workflow.name}
                  onChange={(e) => {
                    handleWorkflowUpdate('name', e.target.value);
                    setStepValid('info', Boolean(e.target.value));
                  }}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="My Automation"
                />
              </div>
              
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                  Description (optional)
                </label>
                <textarea
                  id="description"
                  value={workflow.description || ''}
                  onChange={(e) => handleWorkflowUpdate('description', e.target.value)}
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Describe what this automation does"
                />
              </div>
              
              <div className="flex justify-between pt-4">
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep('trigger')}
                  disabled={!stepValidity.info}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Trigger step - placeholder for this example */}
        {currentStep === 'trigger' && (
          <div className="p-6 space-y-6">
            <h2 className="text-xl font-semibold">Trigger Configuration</h2>
            <p className="text-gray-600">
              Select what will trigger this automation to run.
            </p>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="trigger-type" className="block text-sm font-medium text-gray-700">
                  Trigger Type*
                </label>
                <select
                  id="trigger-type"
                  value={workflow.triggerConfig.type}
                  onChange={(e) => {
                    handleWorkflowUpdate('triggerConfig', {
                      ...workflow.triggerConfig,
                      type: e.target.value
                    });
                    setStepValid('trigger', true);
                  }}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="time">Time-based Trigger</option>
                  <option value="event">Event-based Trigger</option>
                  <option value="location">Location-based Trigger</option>
                </select>
              </div>
              
              {/* Placeholder for trigger configuration UI */}
              <div className="p-4 border border-gray-200 rounded-md bg-gray-50">
                <p className="text-sm text-gray-500">
                  Trigger configuration form would go here based on selected type.
                </p>
              </div>
              
              <div className="flex justify-between pt-4">
                <button
                  type="button"
                  onClick={() => setCurrentStep('info')}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep('conditions')}
                  disabled={!stepValidity.trigger}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Conditions step - our new component integration */}
        {currentStep === 'conditions' && (
          <div className="p-6 space-y-6">
            <h2 className="text-xl font-semibold">Conditions</h2>
            <p className="text-gray-600">
              Define the conditions that must be met for this automation to run. If no conditions are added, the automation will run every time the trigger is activated.
            </p>
            
            <ConditionalExpression
              value={workflow.conditionalLogic || {
                rootGroup: {
                  id: generateId(),
                  logicalOperator: 'and',
                  conditions: []
                }
              }}
              onChange={(value) => handleWorkflowUpdate('conditionalLogic', value)}
              onValidate={(isValid) => setStepValid('conditions', isValid)}
              availableVariables={getAvailableVariables(workflow.triggerConfig)}
              showPreview={true}
            />
            
            <div className="flex justify-between pt-6">
              <button
                type="button"
                onClick={() => setCurrentStep('trigger')}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep('actions')}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Continue
              </button>
            </div>
          </div>
        )}
        
        {/* Actions step - placeholder for this example */}
        {currentStep === 'actions' && (
          <div className="p-6 space-y-6">
            <h2 className="text-xl font-semibold">Actions Configuration</h2>
            <p className="text-gray-600">
              Configure what actions should be performed when this automation runs.
            </p>
            
            <div className="space-y-4">
              {/* Placeholder for action configuration UI */}
              <div className="p-4 border border-gray-200 rounded-md bg-gray-50">
                <p className="text-sm text-gray-500">
                  Action configuration form would go here based on selected actions.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    // Add a sample action for demo purposes
                    handleWorkflowUpdate('actions', [
                      { id: generateId(), type: 'notification', title: 'Sample Action' }
                    ]);
                    setStepValid('actions', true);
                  }}
                  className="mt-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200"
                >
                  Add Sample Action
                </button>
              </div>
              
              <div className="flex justify-between pt-4">
                <button
                  type="button"
                  onClick={() => setCurrentStep('conditions')}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep('review')}
                  disabled={!stepValidity.actions}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Review step */}
        {currentStep === 'review' && (
          <div className="p-6 space-y-6">
            <h2 className="text-xl font-semibold">Review & Save</h2>
            <p className="text-gray-600">
              Review your automation configuration before saving.
            </p>
            
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-md">
                <h3 className="font-medium">Basic Information</h3>
                <p>Name: <span className="font-medium">{workflow.name}</span></p>
                {workflow.description && (
                  <p>Description: {workflow.description}</p>
                )}
              </div>
              
              <div className="bg-gray-50 p-4 rounded-md">
                <h3 className="font-medium">Trigger</h3>
                <p>Type: <span className="font-medium">{workflow.triggerConfig.type}</span></p>
                {/* Display other trigger details here */}
              </div>
              
              <div className="bg-gray-50 p-4 rounded-md">
                <h3 className="font-medium">Conditions</h3>
                {workflow.conditionalLogic && workflow.conditionalLogic.rootGroup.conditions.length > 0 ? (
                  <div className="mt-2">
                    <ConditionPreview expression={workflow.conditionalLogic.rootGroup} />
                  </div>
                ) : (
                  <p className="text-gray-500">No conditions set. This automation will run every time the trigger is activated.</p>
                )}
              </div>
              
              <div className="bg-gray-50 p-4 rounded-md">
                <h3 className="font-medium">Actions</h3>
                <p>Number of actions: <span className="font-medium">{workflow.actions.length}</span></p>
                {/* Display action details here */}
              </div>
              
              <div className="flex justify-between pt-4">
                <button
                  type="button"
                  onClick={() => setCurrentStep('actions')}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!canSave()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save Automation
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}