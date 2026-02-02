// ============================================================================
// EXPANSION SYSTEM AND CUSTOM PANELS
// ============================================================================

import { 
  BIT_TYPES, 
  FOUR_BIT_TYPES, 
  OPERAND_FLAGS, 
  sizeMapForText 
} from './core-constants.js';
import { getGroupLines } from './groups.js';
import { applyDeltaMemCheck, applyAndOrNextCheck } from './delta-mem-check.js';

/**
 * Updates a field in the expansion configuration
 * @param {Map} bitfieldExpansions - Expansion map (modified in place)
 * @param {number} lineId - The line ID
 * @param {string} field - The field to update
 * @param {*} value - The new value
 */
export function updateExpansionField(bitfieldExpansions, lineId, field, value) {
  if (!bitfieldExpansions[lineId]) return;
  bitfieldExpansions[lineId][field] = value;
}

/**
 * Updates a line configuration in the expansion
 * @param {Map} bitfieldExpansions - Expansion map (modified in place)
 * @param {number} expansionId - The expansion ID
 * @param {number} lineIndex - The line index
 * @param {string} field - The field to update
 * @param {*} value - The new value
 */
export function updateLineConfig(bitfieldExpansions, expansionId, lineIndex, field, value) {
  if (!bitfieldExpansions[expansionId]) return;
  
  const lineConfig = bitfieldExpansions[expansionId].lineConfigs[lineIndex];

  // If updating arithmetic increment, clear customization state
  if (field === 'arithmeticIncrement' && value && value.trim() !== '') {
    lineConfig.customized = false;
    lineConfig.customData = null;
  }

  // If updating custom field size, clear arithmetic increment
  if (field === 'customFieldSize' && value && value.trim() !== '') {
    lineConfig.arithmeticIncrement = '';
  }

  lineConfig[field] = value;
}

/**
 * Cancels an expansion
 * @param {Map} bitfieldExpansions - Expansion map (modified in place)
 * @param {number} lineId - The line ID
 */
export function cancelExpansion(bitfieldExpansions, lineId) {
  delete bitfieldExpansions[lineId];
}

/**
 * Cancels line customization
 * @param {Map} bitfieldExpansions - Expansion map (modified in place)
 * @param {number} expansionId - The expansion ID
 * @param {number} lineIndex - The line index
 * @param {Function} expandCondition - Function to re-expand
 */
export function cancelLineCustomization(bitfieldExpansions, expansionId, lineIndex, expandCondition) {
  if (!bitfieldExpansions[expansionId]) return;
  const lineConfig = bitfieldExpansions[expansionId].lineConfigs[lineIndex];
  lineConfig.customized = false;
  lineConfig.customData = null;
  // Don't clear arithmetic increment - user might want to switch back to it
  expandCondition(expansionId);
}

/**
 * Shows a custom warning message
 * @param {number} expansionId - The expansion ID
 * @param {number} lineIndex - The line index
 * @param {string} message - The warning message
 */
export function showCustomWarning(expansionId, lineIndex, message) {
  const warningEl = document.getElementById(
    `custom-warning-${expansionId}-${lineIndex}`,
  );
  if (warningEl) {
    warningEl.textContent = message;
    warningEl.classList.add('show');

    // Shake effect
    const panel = warningEl.closest('.expansion-interface');
    if (panel) {
      panel.classList.add('shake');
      setTimeout(() => panel.classList.remove('shake'), 500);
    }

    setTimeout(() => {
      warningEl.classList.remove('show');
    }, 3000);
  }
}

/**
 * Updates the custom selection count display
 * @param {Map} bitfieldExpansions - Expansion map
 * @param {number} expansionId - The expansion ID
 * @param {number} lineIndex - The line index
 */
export function updateCustomCount(bitfieldExpansions, expansionId, lineIndex) {
  const countEl = document.getElementById(
    `custom-count-${expansionId}-${lineIndex}`,
  );
  if (countEl && bitfieldExpansions[expansionId]) {
    const customData =
      bitfieldExpansions[expansionId].lineConfigs[lineIndex].customData;
    countEl.textContent = customData.selectedCount;
  }
}

/**
 * Recounts custom selections for a line
 * @param {Map} bitfieldExpansions - Expansion map (modified in place)
 * @param {Array} bitfieldConditions - Array of conditions
 * @param {number} expansionId - The expansion ID
 * @param {number} lineIndex - The line index
 */
export function recountCustomSelections(bitfieldExpansions, bitfieldConditions, expansionId, lineIndex) {
  const expansion = bitfieldExpansions[expansionId];
  if (!expansion) return;

  const customData = expansion.lineConfigs[lineIndex].customData;
  if (!customData) return;

  const condition = bitfieldConditions.find((c) => c.lineId === expansionId);
  const groupLines = getGroupLines(bitfieldConditions, condition.groupId);
  const line = groupLines[lineIndex];

  let count = 0;

  const isBitType = BIT_TYPES.includes(line.size);
  const is4BitType = FOUR_BIT_TYPES.includes(line.size);

  Object.values(customData.customRows).forEach((rowData) => {
    if (isBitType) {
      Object.values(rowData).forEach((byteData) => {
        if (byteData.bitCount) {
          count++; // BitCount counts as 1
        } else {
          count += byteData.bits.length;
        }
      });
    } else if (is4BitType) {
      Object.values(rowData).forEach((byteData) => {
        if (byteData.upper) count++;
        if (byteData.lower) count++;
      });
    } else {
      Object.values(rowData).forEach((btnData) => {
        if (btnData.active) count++;
      });
    }
  });

  customData.selectedCount = count;
  updateCustomCount(bitfieldExpansions, expansionId, lineIndex);
}

/**
 * Validates and toggles a bit count selection
 * @param {Map} bitfieldExpansions - Expansion map (modified in place)
 * @param {number} expansionId - The expansion ID
 * @param {number} lineIndex - The line index
 * @param {number} rowBaseAddr - The row base address
 * @param {number} byteOffset - The byte offset
 * @param {Function} recountCustomSelections - Function to recount selections
 * @param {Function} openLineCustomization - Function to open customization
 */
export function toggleCustomBitCountValidated(
  bitfieldExpansions,
  expansionId,
  lineIndex,
  rowBaseAddr,
  byteOffset,
  recountCustomSelections,
  openLineCustomization
) {
  const expansion = bitfieldExpansions[expansionId];
  if (!expansion) return;

  const customData = expansion.lineConfigs[lineIndex].customData;
  const byteData = customData.customRows[rowBaseAddr][byteOffset];

  const wouldAdd = !byteData.bitCount ? 1 : -byteData.bits.length;

  if (customData.selectedCount + wouldAdd > customData.maxSelections) {
    showCustomWarning(expansionId, lineIndex, 'Line count would be exceeded.');
    return;
  }

  byteData.bitCount = !byteData.bitCount;
  if (byteData.bitCount) {
    byteData.bits = [0, 1, 2, 3, 4, 5, 6, 7];
  } else {
    byteData.bits = [];
  }

  recountCustomSelections(bitfieldExpansions, bitfieldConditions, expansionId, lineIndex);
  openLineCustomization(expansionId, lineIndex);
}

/**
 * Confirms and applies an expansion to a group of conditions
 * @param {Map} bitfieldExpansions - Expansion map (modified in place)
 * @param {Array} bitfieldConditions - Conditions array (modified in place)
 * @param {number} expansionId - The expansion ID
 * @param {Function} generateArithmeticLine - Function to generate arithmetic lines
 * @param {Function} generateCustomLines - Function to generate custom lines
 * @param {Function} convertBitfieldConditionToText - Function to convert condition to text
 */
export function confirmExpansion(
  bitfieldExpansions,
  bitfieldConditions,
  expansionId,
  generateArithmeticLine,
  generateCustomLines,
  convertBitfieldConditionToText
) {
  const expansion = bitfieldExpansions[expansionId];
  if (!expansion) {
    console.log('No expansion found for:', expansionId);
    return;
  }

  const condition = bitfieldConditions.find((c) => c.lineId === expansionId);
  if (!condition) {
    console.log('No condition found for:', expansionId);
    return;
  }

  const groupLines = getGroupLines(bitfieldConditions, condition.groupId);
  const generatedGroups = parseInt(expansion.generatedGroups) || 1;

  let allExpandedLines = [];

  // Standard expansion (existing code)
  for (let groupIdx = 0; groupIdx < generatedGroups; groupIdx++) {
    groupLines.forEach((line, lineIdx) => {
      const lineConfig = expansion.lineConfigs[lineIdx];

      let linesToAdd = [];

      if (lineConfig.customized && lineConfig.customData) {
        // Use custom expansion
        linesToAdd = generateCustomLines(line, lineConfig, groupIdx);
      } else if (
        lineConfig.arithmeticIncrement &&
        lineConfig.arithmeticIncrement.trim() !== ''
      ) {
        // Use arithmetic expansion
        linesToAdd = [generateArithmeticLine(line, lineConfig, groupIdx)];
      } else {
        // Copy without changes
        linesToAdd = [convertBitfieldConditionToText(line)];
      }

      allExpandedLines.push(...linesToAdd);
    });
  }

  // Apply Delta/Mem check if enabled - applies to ANY line in the group
  if (expansion.deltaCheck) {
    // Check if ANY line in the group has Delta/Mem types
    const groupHasDeltaOrMem = groupLines.some(
      (l) =>
        ['Delta', 'Mem'].includes(l.type) ||
        ['Delta', 'Mem'].includes(l.compareType),
    );

    if (groupHasDeltaOrMem) {
      // Check if this is Add/Sub Source or And/Or Next group
      const isAddSubSourceGroup = groupLines.some(
        (l) => l.flag === 'A:' || l.flag === 'B:',
      );
      const isAndOrNextGroup = groupLines.some(
        (l) => l.flag === 'N:' || l.flag === 'O:',
      );

      if (isAddSubSourceGroup) {
        allExpandedLines = applyDeltaMemCheck(groupLines[groupLines.length - 1], allExpandedLines);
      } else if (isAndOrNextGroup) {
        allExpandedLines = applyAndOrNextCheck(groupLines[groupLines.length - 1], allExpandedLines);
      }
    }
  }

  console.log('Setting expanded lines:', allExpandedLines);

  // Mark ALL conditions in the group as expanded with the same expanded lines
  groupLines.forEach((groupCondition) => {
    groupCondition.expanded = true;
    groupCondition.expandedLines = allExpandedLines;
  });

  // Clean up expansion data
  delete bitfieldExpansions[expansionId];
}

/**
 * Converts a bitfield condition to text format
 * @param {Object} condition - The condition to convert
 * @returns {string} Text representation
 */
export function convertBitfieldConditionToText(condition) {
  let text = '';

  if (condition.flag) text += condition.flag;

  // Add type prefix
  if (condition.type === 'Delta') text += 'd';
  else if (condition.type === 'Prior') text += 'p';
  else if (condition.type === 'BCD') text += 'b';
  else if (condition.type === 'Invert') text += '~';

  // Add memory/value
  if (condition.type === 'Value') {
    text += condition.memory;
  } else {
    // Apply size prefix for memory types
    if (
      typeof condition.memory === 'string' &&
      condition.memory.startsWith('0x')
    ) {
      text += condition.memory.replace(
        '0x',
        '0x' + (sizeMapForText[condition.size] || ''),
      );
    } else {
      text += condition.memory;
    }
  }

  // Add comparison
  if (condition.cmp) {
    text += condition.cmp;

    // Add right side
    if (condition.compareType === 'Recall') {
      text += '{recall}';
    } else if (condition.compareType === 'Value') {
      text += condition.value;
    } else {
      if (condition.compareType === 'Delta') text += 'd';
      else if (condition.compareType === 'Prior') text += 'p';
      else if (condition.compareType === 'BCD') text += 'b';
      else if (condition.compareType === 'Invert') text += '~';

      // Apply size prefix for memory types on right side
      if (
        typeof condition.value === 'string' &&
        condition.value.startsWith('0x')
      ) {
        text += condition.value.replace(
          '0x',
          '0x' + (sizeMapForText[condition.compareSize] || ''),
        );
      } else {
        text += condition.value;
      }
    }
  }

  // Add hits
  if (condition.hits && condition.hits !== '0') {
    text += '.' + condition.hits + '.';
  }

  return text;
}
