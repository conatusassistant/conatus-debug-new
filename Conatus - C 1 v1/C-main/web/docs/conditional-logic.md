# Conatus Conditional Logic System

## Overview

The Conditional Logic System allows users to create complex conditions that determine when automations should run. This system provides a powerful way to filter automation runs based on variables from triggers, system context, or previous action results.

## Components

### 1. ConditionalExpression

The main component that integrates all aspects of the conditional logic system.

```tsx
import { ConditionalExpression } from '@/components/automation/logic';

// In your component
<ConditionalExpression
  value={workflow.conditionalLogic}
  onChange={(value) => setWorkflow({...workflow, conditionalLogic: value})}
  onValidate={(isValid) => setIsConditionValid(isValid)}
  availableVariables={getAvailableVariables(workflow.triggerConfig)}
  showPreview={true}
/>
```

Props:
- `value`: The current conditional expression value
- `onChange`: Callback when the value changes
- `onValidate`: Callback that receives the validity state
- `availableVariables`: Array of variables available for conditions
- `maxNestingLevel`: Maximum nesting level for condition groups (default: 2)
- `showPreview`: Whether to show a preview of the conditions (default: true)

### 2. VariableSelector

Allows users to select variables for conditions from different sources.

```tsx
import { VariableSelector } from '@/components/automation/logic';

// In your component
<VariableSelector
  selectedVariable={myVariable}
  onChange={(variable) => setMyVariable(variable)}
  availableVariables={variablesArray}
/>
```

Props:
- `selectedVariable`: The currently selected variable
- `onChange`: Callback when a variable is selected
- `availableVariables`: Array of available variables
- `sourceFilter`: Optional filter for variable sources
- `valueTypeFilter`: Optional filter for variable types

### 3. IfCondition

Represents a single condition with variable, operator, and value(s).

```tsx
import { IfCondition } from '@/components/automation/logic';

// In your component
<IfCondition
  condition={myCondition}
  onChange={(updatedCondition) => setMyCondition(updatedCondition)}
  onValidate={(isValid) => setIsConditionValid(isValid)}
  availableVariables={variablesArray}
/>
```

Props:
- `condition`: The condition object
- `onChange`: Callback when the condition changes
- `onRemove`: Optional callback when the remove button is clicked
- `onValidate`: Callback that receives the validity state
- `showRemoveButton`: Whether to show the remove button (default: true)
- `availableVariables`: Array of available variables

### 4. ConditionGroup

Groups multiple conditions with AND/OR logic.

```tsx
import { ConditionGroup } from '@/components/automation/logic';

// In your component
<ConditionGroup
  group={myGroup}
  onChange={(updatedGroup) => setMyGroup(updatedGroup)}
  onValidate={(isValid) => setIsGroupValid(isValid)}
  availableVariables={variablesArray}
/>
```

Props:
- `group`: The group object
- `onChange`: Callback when the group changes
- `onRemove`: Optional callback when the remove button is clicked
- `onValidate`: Callback that receives the validity state
- `isNested`: Whether this is a nested group (default: false)
- `level`: Current nesting level (default: 0)
- `availableVariables`: Array of available variables
- `maxNestingLevel`: Maximum nesting level for groups (default: 2)

### 5. ConditionPreview

Displays a human-readable preview of the conditions.

```tsx
import { ConditionPreview } from '@/components/automation/logic';

// In your component
<ConditionPreview expression={myGroup} />
```

Props:
- `expression`: The condition group to preview
- `className`: Optional additional CSS classes

## Utility Functions

### 1. getAvailableVariables

Get variables available based on trigger configuration.

```typescript
import { getAvailableVariables } from '@/lib/variableUtils';

const variables = getAvailableVariables(triggerConfig);
```

### 2. evaluateCondition

Evaluate a conditional expression against a context object.

```typescript
import { evaluateCondition } from '@/lib/conditionEvaluator';

// Context object with all variable values
const context = {
  system: {
    currentTime: new Date().toISOString(),
    user: {
      id: 'user123',
      email: 'user@example.com'
    },
    weather: {
      condition: 'sunny',
      temperature: 72
    }
  },
  trigger: {
    scheduledTime: '2025-03-17T07:00:00Z'
  }
};

// Evaluate the condition
const shouldRun = evaluateCondition(workflow.conditionalLogic, context);

if (shouldRun) {
  // Execute the automation actions
}
```

## Data Types

### ConditionalExpressionType

This is the root type for the entire expression system.

```typescript
interface ConditionalExpressionType {
  rootGroup: ConditionGroupType;
}
```

### ConditionGroupType

Represents a group of conditions with a logical operator.

```typescript
interface ConditionGroupType {
  id: string;
  logicalOperator: 'and' | 'or';
  conditions: (Condition | ConditionGroupType)[];
}
```

### Condition

Represents a single condition with a variable, operator, and value(s).

```typescript
interface Condition {
  id: string;
  variable: Variable;
  operator: OperatorType;
  value: any;
  secondValue?: any; // For operators like 'between'
}
```

### Variable

Represents a variable that can be used in conditions.

```typescript
interface Variable {
  id: string;
  name: string;
  path: string; // Dot notation path to access the value
  valueType: ValueType;
  source: 'trigger' | 'action' | 'system';
  description?: string;
  example?: string;
  category?: string; // For grouping related variables
}
```

### ValueType

Supported value types for variables.

```typescript
type ValueType = 
  | 'string' 
  | 'number' 
  | 'boolean' 
  | 'date' 
  | 'time' 
  | 'dateTime' 
  | 'array' 
  | 'object';
```

### OperatorType

Supported operators for conditions.

```typescript
type OperatorType = 
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
```

## Usage Examples

### Basic Condition

```typescript
// Create a simple condition
const condition: Condition = {
  id: 'condition1',
  variable: {
    id: 'current_hour',
    name: 'Current Hour',
    path: 'system.hour',
    valueType: 'number',
    source: 'system',
    description: 'Current hour (0-23)',
    category: 'System'
  },
  operator: 'greaterThanOrEqual',
  value: 9 // 9 AM or later
};
```

### Condition Group with Multiple Conditions

```typescript
// Create a condition group with multiple conditions
const group: ConditionGroupType = {
  id: 'group1',
  logicalOperator: 'and',
  conditions: [
    {
      id: 'condition1',
      variable: {
        id: 'current_hour',
        name: 'Current Hour',
        path: 'system.hour',
        valueType: 'number',
        source: 'system'
      },
      operator: 'greaterThanOrEqual',
      value: 9 // 9 AM or later
    },
    {
      id: 'condition2',
      variable: {
        id: 'current_hour',
        name: 'Current Hour',
        path: 'system.hour',
        valueType: 'number',
        source: 'system'
      },
      operator: 'lessThan',
      value: 17 // Before 5 PM
    }
  ]
};
```

### Complex Nested Condition

```typescript
// Create a complex expression with nested groups
const expression: ConditionalExpressionType = {
  rootGroup: {
    id: 'root',
    logicalOperator: 'or',
    conditions: [
      {
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
              source: 'system'
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
              source: 'system'
            },
            operator: 'lessThan',
            value: 6 // Monday-Friday (not Saturday)
          }
        ]
      },
      {
        id: 'condition3',
        variable: {
          id: 'temperature',
          name: 'Temperature',
          path: 'system.weather.temperature',
          valueType: 'number',
          source: 'system'
        },
        operator: 'lessThan',
        value: 32 // Freezing temperature
      }
    ]
  }
};
```

## Best Practices

1. **Variable Organization**: Group variables by source and category for easier selection.

2. **Error Handling**: Always validate conditions before trying to evaluate them.

3. **Fallbacks**: Provide sensible defaults when a variable doesn't exist in the context.

4. **Performance**: For complex expressions, consider memoizing results when the context hasn't changed.

5. **Limit Nesting**: Deep nesting can become confusing for users. Consider limiting to 2-3 levels.

6. **Clear Labeling**: Use descriptive names for variables to make conditions more readable.

7. **Previews**: Always show users a preview of how their conditions will be evaluated.

## Integration with Automation Workflow

The conditional logic system is designed to be integrated into the automation workflow builder as a step between trigger configuration and action configuration:

```tsx
// In AutomationWorkflowBuilder.tsx
const [currentStep, setCurrentStep] = useState<'info' | 'trigger' | 'conditions' | 'action' | 'review'>('info');

// Then in your JSX:
{currentStep === 'conditions' && (
  <div className="p-6 space-y-6">
    <h2 className="text-xl font-semibold">Conditions</h2>
    <p className="text-gray-600">
      Define the conditions that must be met for this automation to run.
    </p>
    
    <ConditionalExpression
      value={workflow.conditionalLogic}
      onChange={(value) => handleWorkflowUpdate('conditionalLogic', value)}
      onValidate={(isValid) => setStepValid('conditions', isValid)}
      availableVariables={getAvailableVariables(workflow.triggerConfig)}
    />
    
    <div className="flex justify-between pt-6">
      <button onClick={() => setCurrentStep('trigger')}>Back</button>
      <button onClick={() => setCurrentStep('action')}>Continue</button>
    </div>
  </div>
)}
```

## Runtime Evaluation

At runtime, the automation engine evaluates conditions before executing actions:

```typescript
// In backend/functions/automation/handler.ts
import { evaluateCondition } from '../../lib/conditionEvaluator';

export const executeAutomation = async (event) => {
  const { automation, context } = event;
  
  // Check if conditions are met
  const shouldRun = evaluateCondition(automation.conditionalLogic, context);
  
  if (!shouldRun) {
    console.log('Conditions not met, skipping automation execution');
    return {
      statusCode: 200,
      body: JSON.stringify({ executed: false, reason: 'conditions_not_met' })
    };
  }
  
  // Execute actions...
};
```

## Future Enhancements

Potential improvements for the conditional logic system:

1. **Testing Tool**: Add a testing interface to simulate condition evaluation with sample data.

2. **Custom Functions**: Allow users to create custom functions for complex evaluations.

3. **Date/Time Functions**: Built-in functions for advanced date and time operations.

4. **Visual Flow Designer**: Add a flowchart-style visualization for complex logical paths.

5. **Condition Templates**: Create reusable condition templates for common scenarios.

6. **Saved Conditions**: Allow users to save and reuse conditions across automations.

7. **Historical Analysis**: Show how conditions evaluated in past automation runs.