'use client';

import { useState, useEffect } from 'react';
import { Plus, X, LogIn } from 'lucide-react';
import IfCondition, { Condition, OperatorType } from './IfCondition';
import { Variable } from './VariableSelector';

// Logical operator type
export type LogicalOperator = 'and' | 'or';

// Condition group interface
export interface ConditionGroupType {
  id: string;
  logicalOperator: LogicalOperator;
  conditions: (Condition | ConditionGroupType)[];
}

interface ConditionGroupProps {
  group: ConditionGroupType;
  onChange: (group: ConditionGroupType) => void;
  onRemove?: () => void;
  onValidate: (isValid: boolean) => void;
  isNested?: boolean;
  level?: number;
  availableVariables?: Variable[];
  maxNestingLevel?: number;
}

// Generate a unique ID
const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15);
};

// Create a default condition
const createDefaultCondition = (): Condition => {
  return {
    id: generateId(),
    operator: 'equals' as OperatorType,
    variable: {} as Variable,
    value: undefined
  };
};

// Create a default group
const createDefaultGroup = (logicalOperator: LogicalOperator = 'and'): ConditionGroupType => {
  return {
    id: generateId(),
    logicalOperator,
    conditions: [createDefaultCondition()]
  };
};

export default function ConditionGroup({
  group,
  onChange,
  onRemove,
  onValidate,
  isNested = false,
  level = 0,
  availableVariables,
  maxNestingLevel = 2
}: ConditionGroupProps) {
  // Keep track of the validity of each condition
  const [validConditions, setValidConditions] = useState<Record<string, boolean>>({});
  const [showOptions, setShowOptions] = useState<boolean>(false);
  
  // Handle logical operator change
  const handleLogicalOperatorChange = (operator: LogicalOperator) => {
    onChange({
      ...group,
      logicalOperator: operator
    });
  };
  
  // Add a new condition
  const handleAddCondition = () => {
    setShowOptions(false);
    const newCondition = createDefaultCondition();
    
    onChange({
      ...group,
      conditions: [...group.conditions, newCondition]
    });
    
    // Mark the new condition as invalid initially
    setValidConditions(prev => ({
      ...prev,
      [newCondition.id]: false
    }));
  };
  
  // Add a new nested group
  const handleAddGroup = () => {
    setShowOptions(false);
    const newGroup = createDefaultGroup();
    
    onChange({
      ...group,
      conditions: [...group.conditions, newGroup]
    });
    
    // Mark the new group as invalid initially
    setValidConditions(prev => ({
      ...prev,
      [newGroup.id]: false
    }));
  };
  
  // Handle condition change
  const handleConditionChange = (index: number, updatedItem: Condition | ConditionGroupType) => {
    const updatedConditions = [...group.conditions];
    updatedConditions[index] = updatedItem;
    
    onChange({
      ...group,
      conditions: updatedConditions
    });
  };
  
  // Handle condition remove
  const handleConditionRemove = (index: number) => {
    // Don't allow removing the last condition
    if (group.conditions.length <= 1) return;
    
    const updatedConditions = [...group.conditions];
    
    // Remove the validation state for this condition
    const removedId = updatedConditions[index].id;
    const newValidConditions = { ...validConditions };
    delete newValidConditions[removedId];
    
    updatedConditions.splice(index, 1);
    
    onChange({
      ...group,
      conditions: updatedConditions
    });
    
    setValidConditions(newValidConditions);
  };
  
  // Track the validity of child conditions/groups
  const handleChildValidate = (id: string, isValid: boolean) => {
    setValidConditions(prev => ({
      ...prev,
      [id]: isValid
    }));
  };
  
  // Validate the entire group
  useEffect(() => {
    // A group is valid if all its conditions are valid
    const allValid = group.conditions.every(condition => {
      return validConditions[condition.id] === true;
    });
    
    onValidate(allValid);
  }, [validConditions, group.conditions]);
  
  return (
    <div 
      className={`border rounded-lg p-4 ${
        isNested 
          ? 'border-gray-300 bg-gray-50' 
          : 'border-gray-200 bg-white shadow-sm'
      }`}
    >
      {/* Group header with logical operator */}
      <div className="flex items-center mb-4 pb-2 border-b border-gray-200">
        <div className="flex space-x-4 items-center">
          <span className="text-sm font-medium text-gray-700">
            Match
          </span>
          <div className="flex border border-gray-300 rounded-md overflow-hidden">
            <button
              type="button"
              className={`px-3 py-1 text-sm ${
                group.logicalOperator === 'and'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
              onClick={() => handleLogicalOperatorChange('and')}
            >
              ALL
            </button>
            <button
              type="button"
              className={`px-3 py-1 text-sm ${
                group.logicalOperator === 'or'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
              onClick={() => handleLogicalOperatorChange('or')}
            >
              ANY
            </button>
          </div>
          <span className="text-sm text-gray-500">
            {group.logicalOperator === 'and' ? 'of the following conditions (AND)' : 'of the following conditions (OR)'}
          </span>
        </div>
        
        {/* Remove button for nested groups */}
        {isNested && onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="ml-auto inline-flex items-center px-2 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <X className="h-4 w-4 mr-1" />
            Remove Group
          </button>
        )}
      </div>
      
      {/* Conditions list */}
      <div className="space-y-4">
        {group.conditions.map((condition, index) => (
          <div key={condition.id} className="relative">
            {/* Render line connector between conditions */}
            {index > 0 && (
              <div className="absolute -top-3 left-4 h-3 border-l-2 border-gray-300"></div>
            )}
            
            {/* Show appropriate connector text */}
            {index > 0 && (
              <div className="text-sm font-medium text-gray-500 mb-1 pl-8">
                {group.logicalOperator === 'and' ? 'AND' : 'OR'}
              </div>
            )}
            
            {/* Render condition or nested group */}
            {'operator' in condition ? (
              <IfCondition
                condition={condition as Condition}
                onChange={(updatedCondition) => handleConditionChange(index, updatedCondition)}
                onRemove={() => handleConditionRemove(index)}
                onValidate={(isValid) => handleChildValidate(condition.id, isValid)}
                availableVariables={availableVariables}
              />
            ) : (
              <ConditionGroup
                group={condition as ConditionGroupType}
                onChange={(updatedGroup) => handleConditionChange(index, updatedGroup)}
                onRemove={() => handleConditionRemove(index)}
                onValidate={(isValid) => handleChildValidate(condition.id, isValid)}
                isNested={true}
                level={level + 1}
                availableVariables={availableVariables}
                maxNestingLevel={maxNestingLevel}
              />
            )}
          </div>
        ))}
      </div>
      
      {/* Add buttons */}
      <div className="mt-4">
        {showOptions ? (
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={handleAddCondition}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Condition
            </button>
            
            {level < maxNestingLevel && (
              <button
                type="button"
                onClick={handleAddGroup}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <LogIn className="h-4 w-4 mr-1" />
                Add Group
              </button>
            )}
            
            <button
              type="button"
              onClick={() => setShowOptions(false)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <X className="h-4 w-4 mr-1" />
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowOptions(true)}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add {group.logicalOperator === 'and' ? 'AND' : 'OR'} Condition
          </button>
        )}
      </div>
    </div>
  );
}