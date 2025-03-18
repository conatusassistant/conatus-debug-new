import { ConditionalExpressionType, ConditionGroupType, Condition } from '../components/automation/logic';

/**
 * Evaluates a conditional expression against a context object
 * @param expression - The conditional expression to evaluate
 * @param context - The context object containing variable values
 * @returns boolean - The result of the evaluation
 */
export const evaluateCondition = (
  expression: ConditionalExpressionType | undefined,
  context: Record<string, any>
): boolean => {
  // If no conditions, return true (automation runs)
  if (!expression || !expression.rootGroup) {
    return true;
  }
  
  // Evaluate the root group
  return evaluateGroup(expression.rootGroup, context);
};

/**
 * Evaluates a condition group against a context object
 * @param group - The condition group to evaluate
 * @param context - The context object containing variable values
 * @returns boolean - The result of the evaluation
 */
const evaluateGroup = (
  group: ConditionGroupType,
  context: Record<string, any>
): boolean => {
  // If no conditions, return true
  if (group.conditions.length === 0) {
    return true;
  }
  
  // Evaluate all conditions in the group
  const results = group.conditions.map(condition => {
    if ('operator' in condition) {
      // Evaluate single condition
      return evaluateSingleCondition(condition as Condition, context);
    } else {
      // Evaluate nested group
      return evaluateGroup(condition as ConditionGroupType, context);
    }
  });
  
  // Apply logical operator
  if (group.logicalOperator === 'and') {
    return results.every(result => result === true);
  } else {
    return results.some(result => result === true);
  }
};

/**
 * Evaluates a single condition against a context object
 * @param condition - The condition to evaluate
 * @param context - The context object containing variable values
 * @returns boolean - The result of the evaluation
 */
const evaluateSingleCondition = (
  condition: Condition,
  context: Record<string, any>
): boolean => {
  // Get the variable value from context using dot notation path
  const path = condition.variable.path.split('.');
  let value = context;
  
  for (const key of path) {
    if (value === undefined || value === null) {
      return false; // Path doesn't exist
    }
    value = value[key];
  }
  
  // Evaluate based on operator
  switch (condition.operator) {
    case 'equals':
      return value === condition.value;
    case 'notEquals':
      return value !== condition.value;
    case 'contains':
      return typeof value === 'string' ? 
        value.includes(condition.value) : 
        Array.isArray(value) && value.includes(condition.value);
    case 'notContains':
      return typeof value === 'string' ? 
        !value.includes(condition.value) : 
        !Array.isArray(value) || !value.includes(condition.value);
    case 'greaterThan':
      return value > condition.value;
    case 'lessThan':
      return value < condition.value;
    case 'greaterThanOrEqual':
      return value >= condition.value;
    case 'lessThanOrEqual':
      return value <= condition.value;
    case 'startsWith':
      return typeof value === 'string' && value.startsWith(condition.value);
    case 'endsWith':
      return typeof value === 'string' && value.endsWith(condition.value);
    case 'exists':
      return value !== undefined && value !== null;
    case 'notExists':
      return value === undefined || value === null;
    case 'between':
      return value >= condition.value && value <= condition.secondValue;
    default:
      return false;
  }
};
