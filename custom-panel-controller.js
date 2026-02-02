// ============================================================================
// CUSTOM EXPANSION PANEL CONTROLLER
// ============================================================================

import { formatConditionDisplay } from './html-renderer.js';

/**
 * Opens the custom expansion panel for a specific line
 * @param {Map} bitfieldExpansions - Expansion map
 * @param {Array} bitfieldConditions - Conditions array
 * @param {number} expansionId - The expansion ID
 * @param {number} lineIndex - The line index
 * @param {Function} getGroupLines - Function to get group lines
 * @param {Function} renderBitfieldConditions - Function to re-render
 */
export function openLineCustomization(
  bitfieldExpansions,
  bitfieldConditions,
  expansionId,
  lineIndex,
  getGroupLines,
  renderBitfieldConditions
) {
  const expansion = bitfieldExpansions[expansionId];
  if (!expansion) return;

  const condition = bitfieldConditions.find((c) => c.lineId === expansionId);
  const groupLines = getGroupLines(condition.groupId);
  const line = groupLines[lineIndex];
  const lineConfig = expansion.lineConfigs[lineIndex];

  const generatedGroups = parseInt(expansion.generatedGroups) || 1;

  // Parse custom field size
  const fieldSizeInput = lineConfig.customFieldSize;
  let fieldSize;

  if (fieldSizeInput.startsWith('0x')) {
    fieldSize = parseInt(fieldSizeInput, 16);
  } else if (fieldSizeInput.startsWith('h') || fieldSizeInput.startsWith('H')) {
    fieldSize = parseInt(fieldSizeInput.substring(1), 16);
  } else {
    fieldSize = parseInt(fieldSizeInput, 10);
  }

  if (!Number.isFinite(fieldSize) || fieldSize <= 0) return;

  // Initialize custom panel data
  if (!lineConfig.customData) {
    lineConfig.customData = {
      maxSelections: generatedGroups,
      selectedCount: 0,
      customRows: {},
    };
  }

  const customData = lineConfig.customData;
  customData.maxSelections = generatedGroups; // Update in case it changed

  const isBitType = [
    'Bit0',
    'Bit1',
    'Bit2',
    'Bit3',
    'Bit4',
    'Bit5',
    'Bit6',
    'Bit7',
    'BitCount',
  ].includes(line.size);
  const is4BitType = ['Lower4', 'Upper4'].includes(line.size);

  let html = '<div class="expansion-interface custom-expansion">';
  html += `<div class="expansion-header">Customize Line ${line.lineId}: ${formatConditionDisplay(line)}</div>`;
  html += `<div class="custom-limit-display">Selected: <span id="custom-count-${expansionId}-${lineIndex}">${customData.selectedCount}</span> / ${generatedGroups}</div>`;
  html += '<div class="expansion-scroll">';

  const startAddr = parseInt(line.memory.replace('0x', ''), 16) || 0;
  const baseAddr = startAddr & ~0xf;

  let stride = 1;
  let buttonsPerRow = 16;

  if (['16-bit', '16-bit BE'].includes(line.size)) {
    stride = 2;
    buttonsPerRow = 8;
  } else if (
    [
      '24-bit',
      '24-bit BE',
      '32-bit',
      '32-bit BE',
      'Float',
      'Float BE',
      'Double32',
      'Double32 BE',
      'MBF32',
      'MBF32 LE',
    ].includes(line.size)
  ) {
    stride = 4;
    buttonsPerRow = 4;
  }

  const numRows = Math.ceil(fieldSize / 0x10);

  // Initialize rows if needed
  for (let rowIdx = 0; rowIdx < numRows; rowIdx++) {
    const rowBaseAddr = baseAddr + rowIdx * 0x10;

    if (!customData.customRows[rowBaseAddr]) {
      customData.customRows[rowBaseAddr] = {};

      if (isBitType) {
        if (line.size === 'BitCount') {
          for (let byteOffset = 0; byteOffset < 0x10; byteOffset++) {
            customData.customRows[rowBaseAddr][byteOffset] = {
              bitCount: false,
              bits: [],
            };
          }
        } else {
          for (let byteOffset = 0; byteOffset < 0x10; byteOffset++) {
            customData.customRows[rowBaseAddr][byteOffset] = {
              bitCount: false,
              bits: [],
            };
          }
        }
      } else if (is4BitType) {
        for (let byteOffset = 0; byteOffset < 0x10; byteOffset++) {
          customData.customRows[rowBaseAddr][byteOffset] = {
            upper: false,
            lower: false,
          };
        }
      } else {
        for (let i = 0; i < buttonsPerRow; i++) {
          const offset = i * stride;
          customData.customRows[rowBaseAddr][offset] = {
            active: false,
          };
        }
      }
    }
  }

  // Render rows
  for (let rowIdx = 0; rowIdx < numRows; rowIdx++) {
    const rowBaseAddr = baseAddr + rowIdx * 0x10;

    if (isBitType) {
      html += '<div class="custom-expansion-bit-row">';
      
      for (let byteOffset = 0; byteOffset < 0x10; byteOffset++) {
        const byteData = customData.customRows[rowBaseAddr][byteOffset];
        const fullAddress = rowBaseAddr + byteOffset;

        html += '<div class="custom-expansion-bit-byte-row">';
        // Full address for the 8 bits
        html += `<span class="custom-expansion-full-addr">0x${fullAddress.toString(16).toUpperCase()}</span>`;
        
        // Skip and BitCount buttons for this row
        html += `<button class="bit-btn skip-btn" onclick="window.toggleCustomSkipValidated(${expansionId}, ${lineIndex}, ${rowBaseAddr}, ${byteOffset})">Skip</button>`;
        html += `<button class="bit-btn ${byteData.bitCount ? 'active' : ''}" 
          onclick="window.toggleCustomBitCountValidated(${expansionId}, ${lineIndex}, ${rowBaseAddr}, ${byteOffset})">BitCount</button>`;
        
        // Individual bit buttons 0-7
        for (let bit = 0; bit < 8; bit++) {
          html += `<button class="bit-btn-small ${byteData.bits.includes(bit) ? 'active' : ''}" 
            onclick="window.toggleCustomBitValidated(${expansionId}, ${lineIndex}, ${rowBaseAddr}, ${byteOffset}, ${bit})">${bit}</button>`;
        }
        
        html += '</div>';
      }

      html += '</div>';
    } else if (is4BitType) {
      html += '<div class="custom-expansion-4bit-row">';
      html += `<span class="custom-expansion-addr">0x${rowBaseAddr.toString(16).toUpperCase()}</span>`;
      html += '<div class="custom-expansion-4bit-grid">';

      html += '<div class="custom-expansion-4bit-all-row">';
      html += `<button class="bit-btn" onclick="window.toggleCustomAllUpperValidated(${expansionId}, ${lineIndex}, ${rowBaseAddr})">All U</button>`;
      for (let byteOffset = 0; byteOffset < 0x10; byteOffset++) {
        const byteData = customData.customRows[rowBaseAddr][byteOffset];
        html += `<button class="bit-btn-4bit ${byteData.upper ? 'active' : ''}" 
          onclick="window.toggleCustomUpperValidated(${expansionId}, ${lineIndex}, ${rowBaseAddr}, ${byteOffset})">U</button>`;
      }
      html += '</div>';

      html += '<div class="custom-expansion-4bit-label-row">';
      html += '<span></span>';
      for (let byteOffset = 0; byteOffset < 0x10; byteOffset++) {
        html += `<span class="custom-expansion-byte-label-inline">0x${byteOffset.toString(16).toUpperCase()}</span>`;
      }
      html += '</div>';

      html += '<div class="custom-expansion-4bit-all-row">';
      html += `<button class="bit-btn" onclick="window.toggleCustomAllLowerValidated(${expansionId}, ${lineIndex}, ${rowBaseAddr})">All L</button>`;
      for (let byteOffset = 0; byteOffset < 0x10; byteOffset++) {
        const byteData = customData.customRows[rowBaseAddr][byteOffset];
        html += `<button class="bit-btn-4bit ${byteData.lower ? 'active' : ''}" 
          onclick="window.toggleCustomLowerValidated(${expansionId}, ${lineIndex}, ${rowBaseAddr}, ${byteOffset})">L</button>`;
      }
      html += '</div>';

      html += '</div>';
      html += '</div>';
    } else {
      html += '<div class="custom-expansion-standard-row">';
      html += `<span class="custom-expansion-addr">0x${rowBaseAddr.toString(16).toUpperCase()}</span>`;
      html += `<button class="bit-btn" onclick="window.toggleCustomAllStandardValidated(${expansionId}, ${lineIndex}, ${rowBaseAddr}, ${stride}, ${buttonsPerRow})">All</button>`;

      for (let i = 0; i < buttonsPerRow; i++) {
        const offset = i * stride;
        const btnData = customData.customRows[rowBaseAddr][offset];

        if (btnData) {
          html += `<button class="bit-btn ${btnData.active ? 'active' : ''}" 
            onclick="window.toggleCustomStandardValidated(${expansionId}, ${lineIndex}, ${rowBaseAddr}, ${offset})">0x${offset.toString(16).toUpperCase()}</button>`;
        }
      }

      html += '</div>';
    }
  }

  html += '</div>'; // end expansion-scroll

  html += `<div class="custom-warning" id="custom-warning-${expansionId}-${lineIndex}"></div>`;
  html += '<div class="expansion-footer">';
  html += `<button class="cancel-btn" onclick="window.cancelCustomPanel(${expansionId}, ${lineIndex})">Cancel</button>`;
  html += `<button class="confirm-btn" onclick="window.confirmCustomPanel(${expansionId}, ${lineIndex})">Confirm</button>`;
  html += '</div>';
  html += '</div>';

  bitfieldExpansions[expansionId].customHtml = html;
  bitfieldExpansions[expansionId].showingCustom = true;
  bitfieldExpansions[expansionId].customLineIndex = lineIndex;
  renderBitfieldConditions();
}

/**
 * Shows a custom warning message with reduced shake effect
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

    // Reduced shake effect
    const panel = warningEl.closest('.expansion-interface');
    if (panel) {
      panel.classList.add('shake-reduced');
      setTimeout(() => panel.classList.remove('shake-reduced'), 200); // Reduced from 500ms to 200ms
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
  const expansion = bitfieldExpansions[expansionId];
  if (!expansion || !expansion.lineConfigs[lineIndex]) return;

  const customData = expansion.lineConfigs[lineIndex].customData;
  if (!customData) return;

  const countEl = document.getElementById(`custom-count-${expansionId}-${lineIndex}`);
  if (countEl) {
    countEl.textContent = customData.selectedCount;
  }
}

/**
 * Recounts all custom selections for a line
 * @param {Map} bitfieldExpansions - Expansion map
 * @param {number} expansionId - The expansion ID
 * @param {number} lineIndex - The line index
 */
export function recountCustomSelections(bitfieldExpansions, expansionId, lineIndex) {
  const expansion = bitfieldExpansions[expansionId];
  if (!expansion || !expansion.lineConfigs[lineIndex]) return;

  const customData = expansion.lineConfigs[lineIndex].customData;
  if (!customData) return;

  let count = 0;

  // Count selections based on data type
  for (const rowBaseAddr in customData.customRows) {
    const row = customData.customRows[rowBaseAddr];
    
    for (const key in row) {
      const data = row[key];
      
      if (data.bitCount) {
        count++;
      } else if (data.bits && data.bits.length > 0) {
        count += data.bits.length;
      } else if (data.upper || data.lower) {
        if (data.upper) count++;
        if (data.lower) count++;
      } else if (data.active) {
        count++;
      }
    }
  }

  customData.selectedCount = count;
  updateCustomCount(bitfieldExpansions, expansionId, lineIndex);
}

/**
 * Cancels the custom panel and returns to normal expansion
 * @param {Map} bitfieldExpansions - Expansion map
 * @param {number} expansionId - The expansion ID
 * @param {number} lineIndex - The line index
 * @param {Function} expandCondition - Function to reopen normal expansion
 */
export function cancelCustomPanel(bitfieldExpansions, expansionId, lineIndex, expandCondition) {
  const expansion = bitfieldExpansions[expansionId];
  if (!expansion) return;

  expansion.showingCustom = false;
  delete expansion.customHtml;
  delete expansion.customLineIndex;

  expandCondition(expansionId);
}

/**
 * Confirms the custom panel configuration with validation
 * @param {Map} bitfieldExpansions - Expansion map
 * @param {number} expansionId - The expansion ID
 * @param {number} lineIndex - The line index
 * @param {Function} expandCondition - Function to reopen normal expansion
 */
export function confirmCustomPanel(bitfieldExpansions, expansionId, lineIndex, expandCondition) {
  const expansion = bitfieldExpansions[expansionId];
  if (!expansion) return;

  const lineConfig = expansion.lineConfigs[lineIndex];
  if (!lineConfig) return;

  // Validate selection count before confirming
  if (!validateCustomSelectionCount(bitfieldExpansions, expansionId, lineIndex)) {
    return; // Don't confirm if validation fails
  }

  // Mark as customized
  lineConfig.customized = true;
  expansion.showingCustom = false;
  delete expansion.customHtml;
  delete expansion.customLineIndex;

  expandCondition(expansionId);
}

/**
 * Validates that custom selections match the generated groups count
 * @param {Map} bitfieldExpansions - Expansion map
 * @param {number} expansionId - The expansion ID
 * @param {number} lineIndex - The line index
 * @returns {boolean} - True if valid, false otherwise
 */
export function validateCustomSelectionCount(bitfieldExpansions, expansionId, lineIndex) {
  const expansion = bitfieldExpansions[expansionId];
  if (!expansion || !expansion.lineConfigs[lineIndex]) return true;

  const customData = expansion.lineConfigs[lineIndex].customData;
  if (!customData) return true;

  const generatedGroups = parseInt(expansion.generatedGroups) || 1;
  const selectedCount = customData.selectedCount || 0;

  if (selectedCount !== generatedGroups) {
    showCustomWarning(
      expansionId, 
      lineIndex, 
      `Custom selection count (${selectedCount}) must match Generated Groups (${generatedGroups})`
    );
    return false;
  }

  return true;
}

/**
 * Cancels all custom expansions for a given expansion
 * @param {Map} bitfieldExpansions - Expansion map
 * @param {number} expansionId - The expansion ID
 * @param {Function} expandCondition - Function to reopen normal expansion
 */
export function cancelAllCustomExpansions(bitfieldExpansions, expansionId, expandCondition) {
  const expansion = bitfieldExpansions[expansionId];
  if (!expansion || !expansion.lineConfigs) return;

  // Cancel custom expansions for all lines
  expansion.lineConfigs.forEach((lineConfig, lineIndex) => {
    if (lineConfig.customized) {
      lineConfig.customized = false;
      lineConfig.customData = null;
    }
  });

  // Clear any showing custom panel
  expansion.showingCustom = false;
  delete expansion.customHtml;
  delete expansion.customLineIndex;

  // Re-open normal expansion
  expandCondition(expansionId);
}
