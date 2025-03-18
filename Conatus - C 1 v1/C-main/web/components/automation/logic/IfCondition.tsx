'use client';

import { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import VariableSelector, { Variable, ValueType } from './VariableSelector';

// Operator types
export type OperatorType = 
  | 'equals' 
  | 'notEquals' 
  | 'contains' 
  | 'notContains' 
  | 'greaterThan' 
  | 'lessThan' 
  | 'greaterThanOrEqual' 
  | 'lessThanOrEqual' 
  | 'startsWith' 
  | 'endsWith' 
  | 'exists' 
  | 'notExists' 
  | 'between';

// Condition object
export interface Condition {
  id: string;
  variable: Variable;
  operator: OperatorType;
  value: any;
  secondValue?: any; // For operators like 'between'
}

interface IfConditionProps {
  condition: Condition;
  onChange: (condition: Condition) => void;
  onRemove?: () => void;
  onValidate: (isValid: boolean) => void;
  showRemoveButton?: boolean;
  availableVariables?: Variable[];
}

interface OperatorOption {
  value: OperatorType;
  label: string;
  requiresValue: boolean;
  requiresSecondValue: boolean;
  applicableTypes: ValueType[];
}

// Define operators with their requirements and applicable types
const operators: OperatorOption[] = [
  { 
    value: 'equals', 
    label: 'equals', 
    requiresValue: true, 
    requiresSecondValue: false,
    applicableTypes: ['string', 'number', 'boolean', 'date', 'time', 'dateTime'] 
  },
  { 
    value: 'notEquals', 
    label: 'does not equal', 
    requiresValue: true, 
    requiresSecondValue: false,
    applicableTypes: ['string', 'number', 'boolean', 'date', 'time', 'dateTime'] 
  },
  { 
    value: 'contains', 
    label: 'contains', 
    requiresValue: true, 
    requiresSecondValue: false,
    applicableTypes: ['string', 'array'] 
  },
  { 
    value: 'notContains', 
    label: 'does not contain', 
    requiresValue: true, 
    requiresSecondValue: false,
    applicableTypes: ['string', 'array'] 
  },
  { 
    value: 'greaterThan', 
    label: 'is greater than', 
    requiresValue: true, 
    requiresSecondValue: false,
    applicableTypes: ['number', 'date', 'time', 'dateTime'] 
  },
  { 
    value: 'lessThan', 
    label: 'is less than', 
    requiresValue: true, 
    requiresSecondValue: false,
    applicableTypes: ['number', 'date', 'time', 'dateTime'] 
  },
  { 
    value: 'greaterThanOrEqual', 
    label: 'is greater than or equal to', 
    requiresValue: true, 
    requiresSecondValue: false,
    applicableTypes: ['number', 'date', 'time', 'dateTime'] 
  },
  { 
    value: 'lessThanOrEqual', 
    label: 'is less than or equal to', 
    requiresValue: true, 
    requiresSecondValue: false,
    applicableTypes: ['number', 'date', 'time', 'dateTime'] 
  },
  { 
    value: 'startsWith', 
    label: 'starts with', 
    requiresValue: true, 
    requiresSecondValue: false,
    applicableTypes: ['string'] 
  },
  { 
    value: 'endsWith', 
    label: 'ends with', 
    requiresValue: true, 
    requiresSecondValue: false,
    applicableTypes: ['string'] 
  },
  { 
    value: 'exists', 
    label: 'exists', 
    requiresValue: false, 
    requiresSecondValue: false,
    applicableTypes: ['string', 'number', 'boolean', 'date', 'time', 'dateTime', 'array', 'object'] 
  },
  { 
    value: 'notExists', 
    label: 'does not exist', 
    requiresValue: false, 
    requiresSecondValue: false,
    applicableTypes: ['string', 'number', 'boolean', 'date', 'time', 'dateTime', 'array', 'object'] 
  },
  { 
    value: 'between', 
    label: 'is between', 
    requiresValue: true, 
    requiresSecondValue: true,
    applicableTypes: ['number', 'date', 'time', 'dateTime'] 
  }
];

export default function IfCondition({
  condition,
  onChange,
  onRemove,
  onValidate,
  showRemoveButton = true,
  availableVariables
}: IfConditionProps) {
  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Get applicable operators for the selected variable's type
  const getApplicableOperators = (valueType: ValueType | undefined): OperatorOption[] => {
    if (!valueType) return operators;
    return operators.filter(op => op.applicableTypes.includes(valueType));
  };
  
  // Handle variable change
  const handleVariableChange = (variable: Variable) => {
    // Get applicable operators for this variable type
    const applicableOperators = getApplicableOperators(variable.valueType);
    
    // Check if current operator is valid for new variable type
    const isOperatorValid = applicableOperators.some(op => op.value === condition.operator);
    
    // If operator is not valid, select the first applicable operator
    const newOperator = isOperatorValid ? condition.operator : applicableOperators[0].value;
    
    // Create updated condition
    const updatedCondition: Condition = {
      ...condition,
      variable,
      operator: newOperator,
      // Reset values when changing variable
      value: undefined,
      secondValue: undefined
    };
    
    onChange(updatedCondition);
    validateCondition(updatedCondition);
  };
  
  // Handle operator change
  const handleOperatorChange = (operator: OperatorType) => {
    const selectedOperator = operators.find(op => op.value === operator);
    
    // Create updated condition
    const updatedCondition: Condition = {
      ...condition,
      operator,
      // Remove values if not required by new operator
      value: selectedOperator?.requiresValue ? condition.value : undefined,
      secondValue: selectedOperator?.requiresSecondValue ? condition.secondValue : undefined
    };
    
    onChange(updatedCondition);
    validateCondition(updatedCondition);
  };
  
  // Handle value change
  const handleValueChange = (value: any) => {
    const updatedCondition: Condition = {
      ...condition,
      value
    };
    
    onChange(updatedCondition);
    validateCondition(updatedCondition);
  };
  
  // Handle second value change (for between operator)
  const handleSecondValueChange = (value: any) => {
    const updatedCondition: Condition = {
      ...condition,
      secondValue: value
    };
    
    onChange(updatedCondition);
    validateCondition(updatedCondition);
  };
  
  // Validate the condition
  const validateCondition = (data: Condition): boolean => {
    const newErrors: Record<string, string> = {};
    
    // Check if variable is selected
    if (!data.variable?.id) {
      newErrors.variable = 'Variable is required';
    }
    
    // Get the selected operator info
    const selectedOperator = operators.find(op => op.value === data.operator);
    
    // Check if value is provided when required
    if (selectedOperator?.requiresValue && (data.value === undefined || data.value === '')) {
      newErrors.value = 'Value is required';
    }
    
    // Check if second value is provided when required
    if (selectedOperator?.requiresSecondValue && 
        (data.secondValue === undefined || data.secondValue === '')) {
      newErrors.secondValue = 'Second value is required';
    }
    
    // For between operator, ensure second value is greater than first value for number, date, time
    if (data.operator === 'between' && 
        data.value !== undefined && 
        data.secondValue !== undefined &&
        ['number', 'date', 'time', 'dateTime'].includes(data.variable?.valueType || '')) {
      
      let isInvalidRange = false;
      
      if (data.variable?.valueType === 'number') {
        isInvalidRange = parseFloat(data.value) >= parseFloat(data.secondValue);
      } else if (['date', 'dateTime'].includes(data.variable?.valueType || '')) {
        isInvalidRange = new Date(data.value) >= new Date(data.secondValue);
      } else if (data.variable?.valueType === 'time') {
        isInvalidRange = data.value >= data.secondValue;
      }
      
      if (isInvalidRange) {
        newErrors.secondValue = 'Second value must be greater than first value';
      }
    }
    
    setErrors(newErrors);
    const isValid = Object.keys(newErrors).length === 0;
    onValidate(isValid);
    
    return isValid;
  };
  
  // Validate on initial render and when condition changes externally
  useEffect(() => {
    validateCondition(condition);
  }, []);
  
  // Get applicable operators for the current variable type
  const applicableOperators = getApplicableOperators(condition.variable?.valueType);
  
  // Get the selected operator
  const selectedOperator = operators.find(op => op.value === condition.operator) || operators[0];
  
  // Render the appropriate value input based on variable type
  const renderValueInput = (valueType: ValueType | undefined, value: any, onChange: (val: any) => void, errorKey: string) => {
    if (!valueType) return null;
    
    switch (valueType) {
      case 'string':
        return (
          <div className="flex-1">
            <input
              type="text"
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              className={`w-full rounded-md shadow-sm border ${
                errors[errorKey] ? 'border-red-500' : 'border-gray-300'
              } focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50`}
              placeholder="Text value"
            />
            {errors[errorKey] && (
              <p className="mt-1 text-sm text-red-600">{errors[errorKey]}</p>
            )}
          </div>
        );
        
      case 'number':
        return (
          <div className="flex-1">
            <input
              type="number"
              value={value || ''}
              onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
              className={`w-full rounded-md shadow-sm border ${
                errors[errorKey] ? 'border-red-500' : 'border-gray-300'
              } focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50`}
              placeholder="Numeric value"
            />
            {errors[errorKey] && (
              <p className="mt-1 text-sm text-red-600">{errors[errorKey]}</p>
            )}
          </div>
        );
        
      case 'boolean':
        return (
          <div className="flex-1">
            <select
              value={value === undefined ? '' : value.toString()}
              onChange={(e) => onChange(e.target.value === 'true')}
              className={`w-full rounded-md shadow-sm border ${
                errors[errorKey] ? 'border-red-500' : 'border-gray-300'
              } focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50`}
            >
              <option value="">Select a value</option>
              <option value="true">True</option>
              <option value="false">False</option>
            </select>
            {errors[errorKey] && (
              <p className="mt-1 text-sm text-red-600">{errors[errorKey]}</p>
            )}
          </div>
        );
        
      case 'date':
        return (
          <div className="flex-1">
            <input
              type="date"
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              className={`w-full rounded-md shadow-sm border ${
                errors[errorKey] ? 'border-red-500' : 'border-gray-300'
              } focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50`}
            />
            {errors[errorKey] && (
              <p className="mt-1 text-sm text-red-600">{errors[errorKey]}</p>
            )}
          </div>
        );
        
      case 'time':
        return (
          <div className="flex-1">
            <input
              type="time"
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              className={`w-full rounded-md shadow-sm border ${
                errors[errorKey] ? 'border-red-500' : 'border-gray-300'
              } focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50`}
            />
            {errors[errorKey] && (
              <p className="mt-1 text-sm text-red-600">{errors[errorKey]}</p>
            )}
          </div>
        );
        
      case 'dateTime':
        return (
          <div className="flex-1">
            <input
              type="datetime-local"
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              className={`w-full rounded-md shadow-sm border ${
                errors[errorKey] ? 'border-red-500' : 'border-gray-300'
              } focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50`}
            />
            {errors[errorKey] && (
              <p className="mt-1 text-sm text-red-600">{errors[errorKey]}</p>
            )}
          </div>
        );
        
      default:
        return (
          <div className="flex-1">
            <input
              type="text"
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              className={`w-full rounded-md shadow-sm border ${
                errors[errorKey] ? 'border-red-500' : 'border-gray-300'
              } focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50`}
              placeholder="Value"
            />
            {errors[errorKey] && (
              <p className="mt-1 text-sm text-red-600">{errors[errorKey]}</p>
            )}
          </div>
        );
    }
  };
  
  return (
    <div className="p-4 bg-white border border-gray-200 rounded-lg">
      <div className="flex flex-col space-y-4">
        {/* Variable selection */}
        <div className="flex flex-col space-y-1">
          <label className="text-sm font-medium text-gray-700">Variable</label>
          <div className={`${errors.variable ? 'border border-red-500 rounded-md p-1' : ''}`}>
            <VariableSelector
              selectedVariable={condition.variable}
              onChange={handleVariableChange}
              availableVariables={availableVariables}
            />
          </div>
          {errors.variable && (
            <p className="mt-1 text-sm text-red-600">{errors.variable}</p>
          )}
        </div>
        
        {/* Operator selection */}
        <div className="flex flex-col space-y-1">
          <label className="text-sm font-medium text-gray-700">Operator</label>
          <select
            value={condition.operator}
            onChange={(e) => handleOperatorChange(e.target.value as OperatorType)}
            className="w-full rounded-md shadow-sm border border-gray-300 focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
            disabled={!condition.variable}
          >
            {applicableOperators.map((op) => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </select>
        </div>
        
        {/* Value fields */}
        {selectedOperator.requiresValue && (
          <div className="flex flex-col space-y-1">
            <label className="text-sm font-medium text-gray-700">Value</label>
            {renderValueInput(
              condition.variable?.valueType, 
              condition.value, 
              handleValueChange, 
              'value'
            )}
          </div>
        )}
        
        {selectedOperator.requiresSecondValue && (
          <div className="flex flex-col space-y-1">
            <label className="text-sm font-medium text-gray-700">Second Value</label>
            {renderValueInput(
              condition.variable?.valueType, 
              condition.secondValue, 
              handleSecondValueChange, 
              'secondValue'
            )}
          </div>
        )}
      </div>
      
      {/* Error message for validation */}
      {Object.keys(errors).length > 0 && (
        <div className="mt-4 p-2 bg-red-50 border border-red-300 rounded-md flex items-start">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2 mt-0.5" />
          <div className="text-sm text-red-700">
            Please fix the errors above to continue
          </div>
        </div>
      )}
      
      {/* Remove button */}
      {showRemoveButton && onRemove && (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <X className="h-4 w-4 mr-1" />
            Remove
          </button>
        </div>
      )}
    </div>
  );
}