// ============================================================================
// CUSTOM EXPANSION TOGGLE FUNCTIONS
// ============================================================================

import { 
  showCustomWarning, 
  recountCustomSelections, 
  updateCustomCount,
  openLineCustomization 
} from './custom-panel-controller.js';

/**
 * Validates and toggles skip for a specific byte (turns off all selections for that byte)
 * @param {Map} bitfieldExpansions - Expansion map
 * @param {number} expansionId - The expansion ID
 * @param {number} lineIndex - The line index
 * @param {number} rowBaseAddr - The base address of the row
 * @param {number} byteOffset - The byte offset (0-15)
 * @param {Function} openLineCustomization - Function to reopen panel
 */
export function toggleCustomSkipValidated(
  bitfieldExpansions,
  expansionId,
  lineIndex,
  rowBaseAddr,
  byteOffset,
  openLineCustomization
) {
  const expansion = bitfieldExpansions[expansionId];
  if (!expansion || !expansion.lineConfigs[lineIndex]) return;

  const customData = expansion.lineConfigs[lineIndex].customData;
  if (!customData || !customData.customRows[rowBaseAddr]) return;

  const byteData = customData.customRows[rowBaseAddr][byteOffset];
  if (!byteData) return;
  
  // Turn off all selections for this specific byte
  byteData.bitCount = false;
  byteData.bits = [];

  recountCustomSelections(bitfieldExpansions, expansionId, lineIndex);
  openLineCustomization(expansionId, lineIndex);
}

/**
 * Validates and toggles custom bit selection
 * @param {Map} bitfieldExpansions - Expansion map
 * @param {number} expansionId - The expansion ID
 * @param {number} lineIndex - The line index
 * @param {number} rowBaseAddr - The base address of the row
 * @param {number} byteOffset - The byte offset
 * @param {number} bit - The bit number (0-7)
 * @param {Function} openLineCustomization - Function to reopen panel
 */
export function toggleCustomBitValidated(
  bitfieldExpansions,
  expansionId,
  lineIndex,
  rowBaseAddr,
  byteOffset,
  bit,
  openLineCustomization
) {
  const expansion = bitfieldExpansions[expansionId];
  if (!expansion || !expansion.lineConfigs[lineIndex]) return;

  const customData = expansion.lineConfigs[lineIndex].customData;
  if (!customData || !customData.customRows[rowBaseAddr]) return;

  const byteData = customData.customRows[rowBaseAddr][byteOffset];
  if (!byteData) return;

  const bitIdx = byteData.bits.indexOf(bit);
  const wouldAdd = bitIdx > -1 ? -1 : 1;

  // Special case: if we have BitCount and we're removing a bit, this would break it
  if (byteData.bitCount && bitIdx > -1) {
    // Breaking BitCount - would add 7 individual bits, but we allow going over limit now
    // No blocking - user can select as many as they want
  } 
  // No blocking - user can select as many as they want

  if (bitIdx > -1) {
    byteData.bits.splice(bitIdx, 1);
  } else {
    byteData.bits.push(bit);
    byteData.bits.sort((a, b) => a - b);
  }

  byteData.bitCount = byteData.bits.length === 8;

  recountCustomSelections(bitfieldExpansions, expansionId, lineIndex);
  openLineCustomization(expansionId, lineIndex);
}

/**
 * Validates and toggles custom bit count selection
 * @param {Map} bitfieldExpansions - Expansion map
 * @param {number} expansionId - The expansion ID
 * @param {number} lineIndex - The line index
 * @param {number} rowBaseAddr - The base address of the row
 * @param {number} byteOffset - The byte offset
 * @param {Function} openLineCustomization - Function to reopen panel
 */
export function toggleCustomBitCountValidated(
  bitfieldExpansions,
  expansionId,
  lineIndex,
  rowBaseAddr,
  byteOffset,
  openLineCustomization
) {
  const expansion = bitfieldExpansions[expansionId];
  if (!expansion || !expansion.lineConfigs[lineIndex]) return;

  const customData = expansion.lineConfigs[lineIndex].customData;
  if (!customData || !customData.customRows[rowBaseAddr]) return;

  const byteData = customData.customRows[rowBaseAddr][byteOffset];
  if (!byteData) return;

  const wouldAdd = !byteData.bitCount ? 1 : -byteData.bits.length;

  // No blocking - user can select as many as they want

  byteData.bitCount = !byteData.bitCount;
  if (byteData.bitCount) {
    byteData.bits = [0, 1, 2, 3, 4, 5, 6, 7];
  } else {
    byteData.bits = [];
  }

  recountCustomSelections(bitfieldExpansions, expansionId, lineIndex);
  openLineCustomization(expansionId, lineIndex);
}

/**
 * Validates and toggles custom upper nibble selection
 * @param {Map} bitfieldExpansions - Expansion map
 * @param {number} expansionId - The expansion ID
 * @param {number} lineIndex - The line index
 * @param {number} rowBaseAddr - The base address of the row
 * @param {number} byteOffset - The byte offset
 * @param {Function} openLineCustomization - Function to reopen panel
 */
export function toggleCustomUpperValidated(
  bitfieldExpansions,
  expansionId,
  lineIndex,
  rowBaseAddr,
  byteOffset,
  openLineCustomization
) {
  const expansion = bitfieldExpansions[expansionId];
  if (!expansion || !expansion.lineConfigs[lineIndex]) return;

  const customData = expansion.lineConfigs[lineIndex].customData;
  if (!customData || !customData.customRows[rowBaseAddr]) return;

  const byteData = customData.customRows[rowBaseAddr][byteOffset];
  if (!byteData) return;

  // No blocking - user can select as many as they want

  byteData.upper = !byteData.upper;

  recountCustomSelections(bitfieldExpansions, expansionId, lineIndex);
  openLineCustomization(expansionId, lineIndex);
}

/**
 * Validates and toggles custom lower nibble selection
 * @param {Map} bitfieldExpansions - Expansion map
 * @param {number} expansionId - The expansion ID
 * @param {number} lineIndex - The line index
 * @param {number} rowBaseAddr - The base address of the row
 * @param {number} byteOffset - The byte offset
 * @param {Function} openLineCustomization - Function to reopen panel
 */
export function toggleCustomLowerValidated(
  bitfieldExpansions,
  expansionId,
  lineIndex,
  rowBaseAddr,
  byteOffset,
  openLineCustomization
) {
  const expansion = bitfieldExpansions[expansionId];
  if (!expansion || !expansion.lineConfigs[lineIndex]) return;

  const customData = expansion.lineConfigs[lineIndex].customData;
  if (!customData || !customData.customRows[rowBaseAddr]) return;

  const byteData = customData.customRows[rowBaseAddr][byteOffset];
  if (!byteData) return;

  // No blocking - user can select as many as they want

  byteData.lower = !byteData.lower;

  recountCustomSelections(bitfieldExpansions, expansionId, lineIndex);
  openLineCustomization(expansionId, lineIndex);
}

/**
 * Validates and toggles all upper nibbles in a row
 * @param {Map} bitfieldExpansions - Expansion map
 * @param {number} expansionId - The expansion ID
 * @param {number} lineIndex - The line index
 * @param {number} rowBaseAddr - The base address of the row
 * @param {Function} openLineCustomization - Function to reopen panel
 */
export function toggleCustomAllUpperValidated(
  bitfieldExpansions,
  expansionId,
  lineIndex,
  rowBaseAddr,
  openLineCustomization
) {
  const expansion = bitfieldExpansions[expansionId];
  if (!expansion || !expansion.lineConfigs[lineIndex]) return;

  const customData = expansion.lineConfigs[lineIndex].customData;
  if (!customData || !customData.customRows[rowBaseAddr]) return;

  const row = customData.customRows[rowBaseAddr];
  let newCount = 0;

  // Calculate new count if all are selected
  for (let byteOffset = 0; byteOffset < 0x10; byteOffset++) {
    const byteData = row[byteOffset];
    if (byteData && !byteData.upper) {
      newCount++;
    }
  }

  // No blocking - user can select as many as they want

  // Toggle all upper bits
  for (let byteOffset = 0; byteOffset < 0x10; byteOffset++) {
    const byteData = row[byteOffset];
    if (byteData) {
      byteData.upper = true;
    }
  }

  recountCustomSelections(bitfieldExpansions, expansionId, lineIndex);
  openLineCustomization(expansionId, lineIndex);
}

/**
 * Validates and toggles all lower nibbles in a row
 * @param {Map} bitfieldExpansions - Expansion map
 * @param {number} expansionId - The expansion ID
 * @param {number} lineIndex - The line index
 * @param {number} rowBaseAddr - The base address of the row
 * @param {Function} openLineCustomization - Function to reopen panel
 */
export function toggleCustomAllLowerValidated(
  bitfieldExpansions,
  expansionId,
  lineIndex,
  rowBaseAddr,
  openLineCustomization
) {
  const expansion = bitfieldExpansions[expansionId];
  if (!expansion || !expansion.lineConfigs[lineIndex]) return;

  const customData = expansion.lineConfigs[lineIndex].customData;
  if (!customData || !customData.customRows[rowBaseAddr]) return;

  const row = customData.customRows[rowBaseAddr];
  let newCount = 0;

  // Calculate new count if all are selected
  for (let byteOffset = 0; byteOffset < 0x10; byteOffset++) {
    const byteData = row[byteOffset];
    if (byteData && !byteData.lower) {
      newCount++;
    }
  }

  // No blocking - user can select as many as they want

  // Toggle all lower bits
  for (let byteOffset = 0; byteOffset < 0x10; byteOffset++) {
    const byteData = row[byteOffset];
    if (byteData) {
      byteData.lower = true;
    }
  }

  recountCustomSelections(bitfieldExpansions, expansionId, lineIndex);
  openLineCustomization(expansionId, lineIndex);
}

/**
 * Validates and toggles custom standard selection
 * @param {Map} bitfieldExpansions - Expansion map
 * @param {number} expansionId - The expansion ID
 * @param {number} lineIndex - The line index
 * @param {number} rowBaseAddr - The base address of the row
 * @param {number} offset - The offset within the row
 * @param {Function} openLineCustomization - Function to reopen panel
 */
export function toggleCustomStandardValidated(
  bitfieldExpansions,
  expansionId,
  lineIndex,
  rowBaseAddr,
  offset,
  openLineCustomization
) {
  const expansion = bitfieldExpansions[expansionId];
  if (!expansion || !expansion.lineConfigs[lineIndex]) return;

  const customData = expansion.lineConfigs[lineIndex].customData;
  if (!customData || !customData.customRows[rowBaseAddr]) return;

  const btnData = customData.customRows[rowBaseAddr][offset];
  if (!btnData) return;

  // No blocking - user can select as many as they want

  btnData.active = !btnData.active;

  recountCustomSelections(bitfieldExpansions, expansionId, lineIndex);
  openLineCustomization(expansionId, lineIndex);
}

/**
 * Validates and toggles all standard selections in a row
 * @param {Map} bitfieldExpansions - Expansion map
 * @param {number} expansionId - The expansion ID
 * @param {number} lineIndex - The line index
 * @param {number} rowBaseAddr - The base address of the row
 * @param {number} stride - The stride between buttons
 * @param {number} buttonsPerRow - Number of buttons per row
 * @param {Function} openLineCustomization - Function to reopen panel
 */
export function toggleCustomAllStandardValidated(
  bitfieldExpansions,
  expansionId,
  lineIndex,
  rowBaseAddr,
  stride,
  buttonsPerRow,
  openLineCustomization
) {
  const expansion = bitfieldExpansions[expansionId];
  if (!expansion || !expansion.lineConfigs[lineIndex]) return;

  const customData = expansion.lineConfigs[lineIndex].customData;
  if (!customData || !customData.customRows[rowBaseAddr]) return;

  const row = customData.customRows[rowBaseAddr];
  let newCount = 0;

  // Calculate new count if all are selected
  for (let i = 0; i < buttonsPerRow; i++) {
    const offset = i * stride;
    const btnData = row[offset];
    if (btnData && !btnData.active) {
      newCount++;
    }
  }

  // No blocking - user can select as many as they want

  // Toggle all buttons
  for (let i = 0; i < buttonsPerRow; i++) {
    const offset = i * stride;
    const btnData = row[offset];
    if (btnData) {
      btnData.active = true;
    }
  }

  recountCustomSelections(bitfieldExpansions, expansionId, lineIndex);
  openLineCustomization(expansionId, lineIndex);
}
