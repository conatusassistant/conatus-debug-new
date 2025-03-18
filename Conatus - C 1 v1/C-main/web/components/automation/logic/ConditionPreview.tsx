'use client';

import { useState } from 'react';
import { Eye, Code, Info } from 'lucide-react';
import { ConditionGroupType, LogicalOperator } from './ConditionGroup';
import { Condition, OperatorType } from './IfCondition';
import { Variable, ValueType } from './VariableSelector';

interface ConditionPreviewProps {
  expression: ConditionGroupType;
  className?: string;
}

// Function to get human-readable operator label
const getOperatorLabel = (operator: OperatorType): string => {
  const operatorLabels: Record<OperatorType, string> = {
    'equals': 'equals',
    'notEquals': 'does not equal',
    'contains': 'contains',
    'notContains': 'does not contain',
    'greaterThan': 'is greater than',
    'lessThan': 'is less than',
    'greaterThanOrEqual': 'is greater than or equal to',
    'lessThanOrEqual': 'is less than or equal to',
    'startsWith': 'starts with',
    'endsWith': 'ends with',
    'exists': 'exists',
    'notExists': 'does not exist',
    'between': 'is between'
  };
  
  return operatorLabels[operator] || operator;
};

// Format the value based on type
const formatValue = (value: any, valueType?: ValueType): string => {
  if (value === undefined || value === null) {
    return '';
  }
  
  if (valueType === 'boolean') {
    return value ? 'true' : 'false';
  }
  
  if (valueType === 'date' || valueType === 'dateTime') {
    try {
      const date = new Date(value);
      return date.toLocaleDateString();
    } catch {
      return String(value);
    }
  }
  
  return String(value);
};

// Get logical operator text
const getLogicalOperatorText = (operator: LogicalOperator): string => {
  return operator === 'and' ? 'AND' : 'OR';
};

export default function ConditionPreview({ expression, className = '' }: ConditionPreviewProps) {
  const [viewMode, setViewMode] = useState<'visual' | 'code'>('visual');
  
  // Recursively generate a human-readable description of a condition or group
  const generateConditionDescription = (
    item: Condition | ConditionGroupType, 
    level: number = 0, 
    isLast: boolean = true
  ): JSX.Element => {
    const indent = level * 20; // 20px indentation per level
    
    // Handle condition
    if ('operator' in item) {
      const condition = item as Condition;
      
      return (
        <div 
          key={condition.id}
          className="py-1"
          style={{ paddingLeft: `${indent}px` }}
        >
          <div className="flex items-center">
            {level > 0 && (
              <div className="inline-block w-4 h-4 border-l-2 border-b-2 border-gray-300 mr-2"></div>
            )}
            <span className="font-medium">{condition.variable?.name || 'Unknown variable'}</span>
            {' '}
            <span className="text-gray-600">{getOperatorLabel(condition.operator)}</span>
            {' '}
            {condition.operator !== 'exists' && condition.operator !== 'notExists' && (
              <span className="font-medium">
                {formatValue(condition.value, condition.variable?.valueType)}
                {condition.operator === 'between' && condition.secondValue !== undefined && 
                  ` and ${formatValue(condition.secondValue, condition.variable?.valueType)}`
                }
              </span>
            )}
          </div>
        </div>
      );
    }
    
    // Handle group
    const group = item as ConditionGroupType;
    const logicalOperator = getLogicalOperatorText(group.logicalOperator);
    
    return (
      <div 
        key={group.id}
        className="py-1"
      >
        <div 
          className="py-1 font-medium"
          style={{ paddingLeft: `${indent}px` }}
        >
          {level > 0 && (
            <div className="inline-block w-4 h-4 border-l-2 border-b-2 border-gray-300 mr-2"></div>
          )}
          Match {group.logicalOperator === 'and' ? 'ALL' : 'ANY'} of:
        </div>
        <div className="ml-2">
          {group.conditions.map((condition, index) => (
            <div key={condition.id}>
              {generateConditionDescription(
                condition, 
                level + 1, 
                index === group.conditions.length - 1
              )}
              {index < group.conditions.length - 1 && (
                <div 
                  className="py-1 text-gray-500 font-medium"
                  style={{ paddingLeft: `${indent + 24}px` }}
                >
                  {logicalOperator}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };
  
  // Generate condition expression as code
  const generateConditionCode = (item: Condition | ConditionGroupType, level: number = 0): string => {
    // Handle condition
    if ('operator' in item) {
      const condition = item as Condition;
      let codeStr = '';
      
      // Variable path
      codeStr += condition.variable?.path || 'unknown';
      
      // Operator
      switch (condition.operator) {
        case 'equals':
          codeStr += ' === ';
          break;
        case 'notEquals':
          codeStr += ' !== ';
          break;
        case 'contains':
          codeStr += '.includes(';
          break;
        case 'notContains':
          codeStr += '.indexOf(';
          break;
        case 'greaterThan':
          codeStr += ' > ';
          break;
        case 'lessThan':
          codeStr += ' < ';
          break;
        case 'greaterThanOrEqual':
          codeStr += ' >= ';
          break;
        case 'lessThanOrEqual':
          codeStr += ' <= ';
          break;
        case 'startsWith':
          codeStr += '.startsWith(';
          break;
        case 'endsWith':
          codeStr += '.endsWith(';
          break;
        case 'exists':
          return `(${codeStr} !== undefined && ${codeStr} !== null)`;
        case 'notExists':
          return `(${codeStr} === undefined || ${codeStr} === null)`;
        case 'between':
          return `(${codeStr} >= ${JSON.stringify(condition.value)} && ${codeStr} <= ${JSON.stringify(condition.secondValue)})`;
        default:
          codeStr += ' === ';
      }
      
      // Value
      if (['contains', 'notContains', 'startsWith', 'endsWith'].includes(condition.operator)) {
        codeStr += `${JSON.stringify(condition.value)})`;
        
        // Add extra condition for notContains
        if (condition.operator === 'notContains') {
          codeStr += ' === -1';
        }
      } else if (condition.operator !== 'exists' && condition.operator !== 'notExists' && condition.operator !== 'between') {
        codeStr += JSON.stringify(condition.value);
      }
      
      return codeStr;
    }
    
    // Handle group
    const group = item as ConditionGroupType;
    
    if (group.conditions.length === 0) {
      return 'true'; // Empty group defaults to true
    }
    
    const operator = group.logicalOperator === 'and' ? ' && ' : ' || ';
    const conditions = group.conditions.map(cond => generateConditionCode(cond, level + 1));
    
    return '(' + conditions.join(operator) + ')';
  };
  
  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-sm ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Condition Preview</h3>
        
        {/* View toggle */}
        <div className="flex border border-gray-300 rounded-md overflow-hidden">
          <button
            type="button"
            className={`px-3 py-1 flex items-center text-sm ${
              viewMode === 'visual'
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
            onClick={() => setViewMode('visual')}
          >
            <Eye className="h-4 w-4 mr-1" />
            Visual
          </button>
          <button
            type="button"
            className={`px-3 py-1 flex items-center text-sm ${
              viewMode === 'code'
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
            onClick={() => setViewMode('code')}
          >
            <Code className="h-4 w-4 mr-1" />
            Code
          </button>
        </div>
      </div>
      
      {/* Content */}
      <div className="p-4">
        {expression.conditions.length > 0 ? (
          <>
            {viewMode === 'visual' ? (
              <div className="text-sm">
                {generateConditionDescription(expression)}
              </div>
            ) : (
              <div className="font-mono text-sm bg-gray-50 p-3 rounded-md overflow-x-auto">
                {generateConditionCode(expression)}
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Info className="h-12 w-12 mx-auto text-gray-400 mb-2" />
            <p>No conditions defined yet.</p>
            <p className="text-sm">Add conditions to see a preview.</p>
          </div>
        )}
      </div>
    </div>
  );
}