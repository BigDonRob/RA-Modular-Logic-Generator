// ============================================================================
// INPUT VALIDATION AND NORMALIZATION
// ============================================================================

import { MEMORY_TYPES } from './core-constants.js';

/**
 * Normalizes hex/decimal input based on type
 * @param {string} value - Input value to normalize
 * @param {boolean} isMemoryType - Whether this is a memory type (needs hex format)
 * @returns {string} Normalized value
 */
export function normalizeHexInput(value, isMemoryType) {
  value = value.trim();
  if (!value) return isMemoryType ? '0x0' : '0';

  if (isMemoryType) {
    // Memory types: convert to 0xHEX
    if (value.match(/^0x[0-9A-Fa-f]+$/)) return value; // Already correct format
    if (value.match(/^h[0-9A-Fa-f]+$/i))
      return '0x' + value.slice(1).toUpperCase();
    if (value.match(/^x[0-9A-Fa-f]+$/i))
      return '0x' + value.slice(1).toUpperCase();
    if (value.match(/^[0-9A-Fa-f]+$/)) return '0x' + value.toUpperCase(); // Assume hex

    // Convert decimal to hex
    const num = parseInt(value, 10);
    if (!isNaN(num)) return '0x' + num.toString(16).toUpperCase();

    return '0x0';
  } else {
    // Value types: convert to decimal
    if (value.match(/^-?\d+$/)) return value; // Already decimal
    if (value.match(/^0x[0-9A-Fa-f]+$/i)) return parseInt(value, 16).toString();
    if (value.match(/^h[0-9A-Fa-f]+$/i))
      return parseInt(value.slice(1), 16).toString();
    if (value.match(/^[0-9A-Fa-f]+$/i)) {
      // Ambiguous - could be hex or decimal
      // Try as hex first if it contains A-F
      if (value.match(/[A-Fa-f]/)) return parseInt(value, 16).toString();
      return value; // Treat as decimal
    }

    return '0';
  }
}

/**
 * Validates and normalizes a field value for a condition
 * @param {Object} condition - The condition object
 * @param {string} field - The field being updated
 * @param {string} value - The new value
 * @returns {string} Normalized value
 */
export function validateAndNormalizeConditionField(condition, field, value) {
  if (field === 'memory') {
    const isMemoryType = MEMORY_TYPES.includes(condition.type);
    return normalizeHexInput(value, isMemoryType);
  } else if (field === 'value') {
    const isMemoryType = MEMORY_TYPES.includes(condition.compareType);
    return normalizeHexInput(value, isMemoryType);
  }
  
  return value;
}

/**
 * Validates if a type change is allowed for a given flag
 * @param {string} flag - The condition flag
 * @param {string} newType - The new type being set
 * @returns {boolean} Whether the type change is valid
 */
export function validateTypeChange(flag, newType) {
  if (flag === 'I:') {
    // Add Address flag - only allow Mem, Prior, Value, and Recall
    return ['Mem', 'Prior', 'Value', 'Recall'].includes(newType);
  }
  return true; // All other flags allow all types
}

/**
 * Checks if a condition can be expanded
 * @param {Object} condition - The condition to check
 * @returns {boolean} Whether the condition can be expanded
 */
export function canExpand(condition) {
  const hasMemory = condition.memory && condition.memory.trim().length > 0;

  // Only disable expansion for Value=Value and Recall=Recall combinations
  const leftIsValue = condition.type === 'Value';
  const leftIsRecall = condition.type === 'Recall';
  const rightIsValue = condition.compareType === 'Value';
  const rightIsRecall = condition.compareType === 'Recall';

  // Disable if both sides are Value or both sides are Recall
  const shouldDisable =
    (leftIsValue && rightIsValue) || (leftIsRecall && rightIsRecall);

  return hasMemory && !shouldDisable;
}
