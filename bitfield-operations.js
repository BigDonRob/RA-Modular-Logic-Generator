// ============================================================================
// BITFIELD CONDITION CRUD OPERATIONS
// ============================================================================

import { OPERAND_FLAGS } from './core-constants.js';
import { validateAndNormalizeConditionField } from './validation.js';
import { recalculateLineAndGroupIds, getGroupLines } from './groups.js';

/**
 * Creates a new default condition object
 * @returns {Object} Default condition object
 */
function createDefaultCondition() {
  return {
    lineId: 0, // Temporary, will be set by recalculation
    groupId: 0, // Temporary, will be set by recalculation
    flag: '',
    type: 'Mem',
    size: '8-bit',
    memory: '0x0',
    cmp: '=',
    compareType: 'Value',
    compareSize: '8-bit',
    value: '0',
    hits: '0',
    bytes: '',
    expanded: false,
    expandedLines: [],
  };
}

/**
 * Adds a new bitfield condition to the array
 * @param {Array} bitfieldConditions - Array of conditions (modified in place)
 */
export function addBitfieldCondition(bitfieldConditions) {
  const newCondition = createDefaultCondition();
  bitfieldConditions.push(newCondition);
  recalculateLineAndGroupIds(bitfieldConditions);
}

/**
 * Removes a condition and its entire group
 * @param {Array} bitfieldConditions - Array of conditions (modified in place)
 * @param {Map} bitfieldExpansions - Expansion map (modified in place)
 * @param {Map} linkGroupColors - Group colors map (modified in place)
 * @param {number} lineId - The line ID to remove
 */
export function removeBitfieldCondition(bitfieldConditions, bitfieldExpansions, linkGroupColors, lineId) {
  const condition = bitfieldConditions.find((c) => c.lineId === lineId);
  if (!condition) return;

  // Get all lines in the group
  const groupLines = getGroupLines(bitfieldConditions, condition.groupId);
  const lineIds = groupLines.map((c) => c.lineId);

  // Remove all conditions in the group
  const filteredConditions = bitfieldConditions.filter(
    (c) => !lineIds.includes(c.lineId),
  );
  bitfieldConditions.length = 0;
  bitfieldConditions.push(...filteredConditions);

  // Clean up expansions
  lineIds.forEach((id) => bitfieldExpansions.delete(id));

  // Clean up link group color
  linkGroupColors.delete(condition.groupId);

  recalculateLineAndGroupIds(bitfieldConditions);
}

/**
 * Adds a new condition at a specific index
 * @param {Array} bitfieldConditions - Array of conditions (modified in place)
 * @param {number} index - The index to insert at
 */
export function addConditionAtIndex(bitfieldConditions, index) {
  const newCondition = createDefaultCondition();

  // Insert the new condition
  bitfieldConditions.splice(index + 1, 0, newCondition);

  // Recalculate all Line IDs and Group IDs
  recalculateLineAndGroupIds(bitfieldConditions);
}

/**
 * Copies a condition group to after the original group
 * @param {Array} bitfieldConditions - Array of conditions (modified in place)
 * @param {number} lineId - The line ID to copy
 */
export function copyCondition(bitfieldConditions, lineId) {
  const condition = bitfieldConditions.find((c) => c.lineId === lineId);
  if (!condition) return;

  // Get all lines in the group
  const groupLines = getGroupLines(bitfieldConditions, condition.groupId);

  // Find where the group ends in the main array
  const lastGroupLine = groupLines.reduce((max, line) =>
    line.lineId > max.lineId ? line : max,
  );
  const insertIndex =
    bitfieldConditions.findIndex((c) => c.lineId === lastGroupLine.lineId) + 1;

  // Create copies of all conditions in the group
  const copiedConditions = groupLines.map((groupCondition) => ({
    ...groupCondition,
    lineId: 0, // Temporary, will be recalculated
    groupId: 0, // Temporary, will be recalculated
    expanded: false,
    expandedLines: [],
  }));

  // Insert all copied conditions after the original group
  bitfieldConditions.splice(insertIndex, 0, ...copiedConditions);

  // Recalculate all Line IDs and Group IDs
  recalculateLineAndGroupIds(bitfieldConditions);
}

/**
 * Clears all bitfield conditions
 * @param {Array} bitfieldConditions - Array of conditions (modified in place)
 * @param {Map} bitfieldExpansions - Expansion map (modified in place)
 */
export function clearBitfieldConditions(bitfieldConditions, bitfieldExpansions) {
  bitfieldConditions.length = 0;
  bitfieldExpansions.clear();
}

/**
 * Updates a specific field on a condition
 * @param {Array} bitfieldConditions - Array of conditions (modified in place)
 * @param {Map} bitfieldExpansions - Expansion map
 * @param {number} lineId - The line ID to update
 * @param {string} field - The field to update
 * @param {string} value - The new value
 * @param {Function} recomputeExpandState - Function to recompute expand state
 * @param {Function} expandCondition - Function to expand condition
 */
export function updateBitfieldCondition(
  bitfieldConditions,
  bitfieldExpansions,
  lineId,
  field,
  value,
  recomputeExpandState,
  expandCondition
) {
  const condition = bitfieldConditions.find((c) => c.lineId === lineId);
  if (!condition) return;

  // Validate and normalize inputs
  value = validateAndNormalizeConditionField(condition, field, value);

  condition[field] = value;

  // If flag changed to operand flag (A:, B:, I:, K:), clear comparison
  if (field === 'flag' && OPERAND_FLAGS.includes(value)) {
    condition.cmp = '';
  }

  // If any dropdown changed that affects expansion validation, refresh expansion panel
  const expansionAffectingFields = [
    'flag',
    'type',
    'size',
    'cmp',
    'compareType',
    'compareSize',
  ];
  if (
    expansionAffectingFields.includes(field) &&
    bitfieldExpansions[lineId] &&
    bitfieldExpansions[lineId].html
  ) {
    // Expansion panel is open, refresh it
    expandCondition(lineId);
  }
}

/**
 * Syncs bitfield conditions from parsed text
 * @param {Array} bitfieldConditions - Array of conditions (modified in place)
 * @param {Map} bitfieldExpansions - Expansion map (modified in place)
 * @param {Array} parsed - Parsed conditions from text
 * @param {Function} autoLinkAddressFlags - Function to auto-link address flags
 */
export function syncBitfieldFromText(
  bitfieldConditions,
  bitfieldExpansions,
  parsed,
  autoLinkAddressFlags
) {
  bitfieldConditions.length = 0;
  bitfieldConditions.push(...parsed.map((condition, index) => ({
    lineId: index + 1,
    groupId: index + 1, // Each line starts in its own group
    flag: condition.flag,
    type: condition.type,
    size: condition.size,
    memory: condition.memory || '0x0',
    cmp: condition.cmp,
    compareType: condition.compareType,
    compareSize: condition.compareSize,
    value: condition.value || '0',
    hits: condition.hits || '0',
    bytes: '',
    expanded: false,
    expandedLines: [],
  })));
  
  bitfieldExpansions.clear();

  // Auto-link Add Address flags
  autoLinkAddressFlags();
}
