'use client';

import { useState, useEffect } from 'react';
import { Info } from 'lucide-react';
import ConditionGroup, { ConditionGroupType } from './ConditionGroup';
import ConditionPreview from './ConditionPreview';
import { Variable } from './VariableSelector';

// Root condition type for the entire expression
export interface ConditionalExpressionType {
  rootGroup: ConditionGroupType;
}

interface ConditionalExpressionProps {
  value: ConditionalExpressionType;
  onChange: (value: ConditionalExpressionType) => void;
  onValidate: (isValid: boolean) => void;
  availableVariables?: Variable[];
  maxNestingLevel?: number;
  showPreview?: boolean;
}

// Generate a unique ID
const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15);
};

// Create a default expression
const createDefaultExpression = (): ConditionalExpressionType => {
  return {
    rootGroup: {
      id: generateId(),
      logicalOperator: 'and',
      conditions: []
    }
  };
};

export default function ConditionalExpression({
  value,
  onChange,
  onValidate,
  availableVariables,
  maxNestingLevel = 2,
  showPreview = true
}: ConditionalExpressionProps) {
  // If no value is provided, create a default one
  const [expression, setExpression] = useState<ConditionalExpressionType>(
    value || createDefaultExpression()
  );
  
  // Update local state when prop changes
  useEffect(() => {
    if (value) {
      setExpression(value);
    }
  }, [value]);
  
  // Handle root group change
  const handleRootGroupChange = (updatedGroup: ConditionGroupType) => {
    const updatedExpression = {
      ...expression,
      rootGroup: updatedGroup
    };
    
    setExpression(updatedExpression);
    onChange(updatedExpression);
  };
  
  // Check if expression has any conditions
  const hasConditions = expression.rootGroup.conditions.length > 0;
  
  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Conditional Logic</h3>
          <p className="mt-1 text-sm text-gray-500">
            Define the conditions that determine when this automation will run.
          </p>
        </div>
        
        <div className="p-4">
          {hasConditions ? (
            <ConditionGroup
              group={expression.rootGroup}
              onChange={handleRootGroupChange}
              onValidate={onValidate}
              availableVariables={availableVariables}
              maxNestingLevel={maxNestingLevel}
            />
          ) : (
            <div className="text-center py-8">
              <Info className="h-8 w-8 mx-auto text-blue-500 mb-2" />
              <h3 className="text-base font-medium text-gray-900">No conditions defined</h3>
              <p className="mt-1 text-sm text-gray-500">
                Add conditions to control when this automation runs.
              </p>
              <button
                type="button"
                onClick={() => {
                  // Create a default group with an initial condition
                  const updatedGroup = {
                    ...expression.rootGroup,
                    conditions: [{
                      id: generateId(),
                      operator: 'equals',
                      variable: {} as Variable,
                      value: undefined
                    }]
                  };
                  
                  handleRootGroupChange(updatedGroup);
                }}
                className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Add First Condition
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Condition Preview */}
      {showPreview && hasConditions && (
        <ConditionPreview expression={expression.rootGroup} />
      )}
    </div>
  );
}