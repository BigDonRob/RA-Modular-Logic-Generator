console.log('🚀 app.js loading - v3');

import { 
  BIT_TYPES,
  FOUR_BIT_TYPES,
  OPERAND_FLAGS,
  sizeMapForText
} from './core-constants.js';
import { validateTypeChange, canExpand } from './validation.js';
import { parseBaseLogic } from './parsing.js';
import { 
  getGroupLines, 
  isGroupLeader, 
  recalculateLineAndGroupIds,
  linkCondition,
  unlinkCondition,
  canLinkCondition as canLinkConditionUtil,
  autoLinkAddressFlags
} from './groups.js';
import {
  addBitfieldCondition,
  removeBitfieldCondition,
  addConditionAtIndex,
  copyCondition,
  clearBitfieldConditions,
  updateBitfieldCondition,
  syncBitfieldFromText
} from './bitfield-operations.js';
import { 
  updateExpansionField, 
  updateLineConfig, 
  cancelExpansion, 
  cancelLineCustomization,
  confirmExpansion,
  convertBitfieldConditionToText
} from './expansion-system.js';
import { 
  renderBitfieldConditions, 
  flashTypeDropdown,
  formatConditionDisplay 
} from './html-renderer.js';
import { compressBits, calculateCompressionSavings } from './compression.js';
import { applyDeltaMemCheck, applyAndOrNextCheck } from './delta-mem-check.js';
import { applyRROptimization } from './rr-optimization.js';
import { 
  openLineCustomization,
  showCustomWarning,
  recountCustomSelections,
  updateCustomCount,
  cancelCustomPanel,
  confirmCustomPanel,
  validateCustomSelectionCount,
  cancelAllCustomExpansions
} from './custom-panel-controller.js';
import {
  toggleCustomSkipValidated,
  toggleCustomBitValidated,
  toggleCustomBitCountValidated,
  toggleCustomUpperValidated,
  toggleCustomLowerValidated,
  toggleCustomAllUpperValidated,
  toggleCustomAllLowerValidated,
  toggleCustomStandardValidated,
  toggleCustomAllStandardValidated
} from './custom-toggles.js';

// ============================================================================
// GLOBAL STATE
// ============================================================================

let bitfieldConditions = [];
let bitfieldExpansions = new Map();
let linkGroupColors = new Map();

// ============================================================================
// CUSTOM EXPANSION GENERATION FUNCTIONS
// ============================================================================

/**
 * Generates custom expansion lines based on user selections
 * @param {Object} line - The original line condition
 * @param {Object} lineConfig - The line configuration with custom data
 * @param {number} groupIdx - The group index
 * @returns {Array} Array of generated line strings
 */
function generateCustomLines(line, lineConfig, groupIdx) {
  const customData = lineConfig.customData;
  if (!customData) return [];

  const lines = [];
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

  const sortedRowAddrs = Object.keys(customData.customRows)
    .map((k) => parseInt(k))
    .sort((a, b) => a - b);

  let selections = [];

  for (const rowBaseAddr of sortedRowAddrs) {
    const rowData = customData.customRows[rowBaseAddr];

    if (isBitType) {
      const sortedOffsets = Object.keys(rowData)
        .map((k) => parseInt(k))
        .sort((a, b) => a - b);
      for (const byteOffset of sortedOffsets) {
        const byteData = rowData[byteOffset];
        const addr = rowBaseAddr + byteOffset;

        if (byteData.bitCount) {
          selections.push({ addr, size: 'BitCount' });
        } else if (byteData.bits && byteData.bits.length > 0) {
          byteData.bits.forEach((bit) => {
            selections.push({ addr, size: `Bit${bit}` });
          });
        }
      }
    } else if (is4BitType) {
      for (let byteOffset = 0; byteOffset < 0x10; byteOffset++) {
        const byteData = rowData[byteOffset];
        const addr = rowBaseAddr + byteOffset;

        if (byteData.upper) {
          selections.push({ addr, size: 'Upper4' });
        }
        if (byteData.lower) {
          selections.push({ addr, size: 'Lower4' });
        }
      }
    } else {
      const sortedOffsets = Object.keys(rowData)
        .map((k) => parseInt(k))
        .sort((a, b) => a - b);
      for (const offset of sortedOffsets) {
        const btnData = rowData[offset];
        const addr = rowBaseAddr + offset;

        if (btnData && btnData.active) {
          selections.push({ addr, size: line.size });
        }
      }
    }
  }

  // Get the selection for this group index
  if (groupIdx < selections.length) {
    const selection = selections[groupIdx];
    lines.push(
      createConditionLine(
        line,
        selection.addr,
        selection.size,
        null,
        lineConfig,
      ),
    );
  }

  return lines;
}

/**
 * Creates a condition line with proper formatting
 * @param {Object} condition - The original condition
 * @param {number} address - The address to use
 * @param {string} size - The size type
 * @param {number|null} bit - The bit number (if applicable)
 * @param {Object} expansion - The expansion configuration
 * @returns {string} The formatted condition line
 */
function createConditionLine(condition, address, size, bit, expansion) {
  let line = '';

  if (condition.flag) line += condition.flag;

  if (condition.type === 'Delta') line += 'd';
  else if (condition.type === 'Prior') line += 'p';
  else if (condition.type === 'BCD') line += 'b';
  else if (condition.type === 'Invert') line += '~';

  const sizeMap = {
    Bit0: 'M',
    Bit1: 'N',
    Bit2: 'O',
    Bit3: 'P',
    Bit4: 'Q',
    Bit5: 'R',
    Bit6: 'S',
    Bit7: 'T',
    Lower4: 'L',
    Upper4: 'U',
    '8-bit': 'H',
    '16-bit': '',
    '24-bit': 'W',
    '32-bit': 'X',
    '16-bit BE': 'I',
    '24-bit BE': 'J',
    '32-bit BE': 'G',
    BitCount: 'K',
    Float: 'fF',
    'Float BE': 'fB',
    Double32: 'fH',
    'Double32 BE': 'fI',
    MBF32: 'fM',
    'MBF32 LE': 'fL',
  };

  // For custom expansion, use the custom address with proper size prefix
  const sizePrefix = sizeMap[size] || '';
  line += `0x${sizePrefix}${address.toString(16).toUpperCase().padStart(4, '0')}`;

  const isOperandFlag = ['A:', 'B:', 'I:', 'K:'].includes(condition.flag);
  if (
    !isOperandFlag ||
    (isOperandFlag && condition.cmp && condition.cmp !== '')
  ) {
    line += condition.cmp || '=';

    if (condition.compareType === 'Recall') {
      line += '{recall}';
    } else if (condition.compareType === 'Value') {
      line += condition.value;
    } else if (
      ['Mem', 'Delta', 'Prior', 'Invert', 'BCD', 'Float'].includes(
        condition.compareType,
      )
    ) {
      let rightPrefix = '';
      if (condition.compareType === 'Delta') rightPrefix = 'd';
      else if (condition.compareType === 'Prior') rightPrefix = 'p';
      else if (condition.compareType === 'BCD') rightPrefix = 'b';
      else if (condition.compareType === 'Invert') rightPrefix = '~';

      // For right side, use original value with proper prefix
      line +=
        rightPrefix +
        `0x${sizeMap[condition.compareSize] || ''}${condition.value.replace('0x', '').toUpperCase()}`;
    }
  }

  // Add hits
  if (condition.hits && condition.hits !== '0') {
    line += '.' + condition.hits + '.';
  }

  return line;
}

// ============================================================================
// MAIN APPLICATION FUNCTIONS
// ============================================================================

/**
 * Updates the GUI from the base logic textarea
 */
function updateGuiFromText() {
  const parsed = parseBaseLogic();
  
  syncBitfieldFromText(
    bitfieldConditions,
    bitfieldExpansions,
    parsed,
    () => autoLinkAddressFlags(bitfieldConditions, linkGroupColors)
  );
  
  renderBitfieldConditions(
    bitfieldConditions,
    bitfieldExpansions,
    linkGroupColors,
    (lineId) => linkCondition(bitfieldConditions, linkGroupColors, lineId),
    (lineId) => unlinkCondition(bitfieldConditions, lineId),
    (lineId) => canLinkConditionUtil(bitfieldConditions, lineId),
    (index) => addConditionAtIndex(bitfieldConditions, index),
    (lineId) => copyCondition(bitfieldConditions, lineId),
    (lineId) => removeBitfieldCondition(bitfieldConditions, bitfieldExpansions, linkGroupColors, lineId),
    expandCondition,
    reopenExpansion
  );
}

/**
 * Recomputes the expand state for a condition
 * @param {number} lineId - The line ID
 */
function recomputeExpandState(lineId) {
  const condition = bitfieldConditions.find((c) => c.lineId === lineId);
  if (!condition) return;
  const btn = document.querySelector(
    `.bitfield-condition-row[data-id="${lineId}"] .expand-btn`,
  );
  if (btn) {
    btn.disabled = !canExpand(condition);
  }
}

/**
 * Reopens an expansion
 * @param {number} lineId - The line ID
 */
function reopenExpansion(lineId) {
  const condition = bitfieldConditions.find((c) => c.lineId === lineId);
  if (condition) {
    // Reset ALL conditions in the group
    const groupLines = getGroupLines(bitfieldConditions, condition.groupId);
    groupLines.forEach((groupCondition) => {
      groupCondition.expanded = false;
      groupCondition.expandedLines = [];
    });
  }
  delete bitfieldExpansions[lineId];
  updateGuiFromText();
}

// ============================================================================
// WRAPPER FUNCTIONS FOR GLOBAL ACCESS
// ============================================================================

// Bitfield Operations
function addBitfieldConditionWrapper() {
  // Close any open expansions first
  Object.keys(bitfieldExpansions).forEach((id) => {
    delete bitfieldExpansions[id];
  });
  
  addBitfieldCondition(bitfieldConditions);
  
  // Render directly without re-parsing from textarea
  renderBitfieldConditions(
    bitfieldConditions,
    bitfieldExpansions,
    linkGroupColors,
    (lineId) => linkCondition(bitfieldConditions, linkGroupColors, lineId),
    (lineId) => unlinkCondition(bitfieldConditions, lineId),
    (lineId) => canLinkConditionUtil(bitfieldConditions, lineId),
    (index) => addConditionAtIndex(bitfieldConditions, index),
    (lineId) => copyCondition(bitfieldConditions, lineId),
    (lineId) => removeBitfieldCondition(bitfieldConditions, bitfieldExpansions, linkGroupColors, lineId),
    expandCondition,
    reopenExpansion
  );
}

function removeBitfieldConditionWrapper(lineId) {
  // Close any open expansions first
  Object.keys(bitfieldExpansions).forEach((id) => {
    delete bitfieldExpansions[id];
  });
  
  removeBitfieldCondition(bitfieldConditions, bitfieldExpansions, linkGroupColors, lineId);
  
  // Render directly without re-parsing from textarea
  renderBitfieldConditions(
    bitfieldConditions,
    bitfieldExpansions,
    linkGroupColors,
    (lineId) => linkCondition(bitfieldConditions, linkGroupColors, lineId),
    (lineId) => unlinkCondition(bitfieldConditions, lineId),
    (lineId) => canLinkConditionUtil(bitfieldConditions, lineId),
    (index) => addConditionAtIndex(bitfieldConditions, index),
    (lineId) => copyCondition(bitfieldConditions, lineId),
    (lineId) => removeBitfieldCondition(bitfieldConditions, bitfieldExpansions, linkGroupColors, lineId),
    expandCondition,
    reopenExpansion
  );
}

function addConditionAtIndexWrapper(index) {
  // Close any open expansions first
  Object.keys(bitfieldExpansions).forEach((id) => {
    delete bitfieldExpansions[id];
  });
  
  addConditionAtIndex(bitfieldConditions, index);
  
  // Render directly without re-parsing from textarea
  renderBitfieldConditions(
    bitfieldConditions,
    bitfieldExpansions,
    linkGroupColors,
    (lineId) => linkCondition(bitfieldConditions, linkGroupColors, lineId),
    (lineId) => unlinkCondition(bitfieldConditions, lineId),
    (lineId) => canLinkConditionUtil(bitfieldConditions, lineId),
    (index) => addConditionAtIndex(bitfieldConditions, index),
    (lineId) => copyCondition(bitfieldConditions, lineId),
    (lineId) => removeBitfieldCondition(bitfieldConditions, bitfieldExpansions, linkGroupColors, lineId),
    expandCondition,
    reopenExpansion
  );
}

function copyConditionWrapper(lineId) {
  // Close any open expansions first
  Object.keys(bitfieldExpansions).forEach((id) => {
    delete bitfieldExpansions[id];
  });
  
  copyCondition(bitfieldConditions, lineId);
  
  // Render directly without re-parsing from textarea
  renderBitfieldConditions(
    bitfieldConditions,
    bitfieldExpansions,
    linkGroupColors,
    (lineId) => linkCondition(bitfieldConditions, linkGroupColors, lineId),
    (lineId) => unlinkCondition(bitfieldConditions, lineId),
    (lineId) => canLinkConditionUtil(bitfieldConditions, lineId),
    (index) => addConditionAtIndex(bitfieldConditions, index),
    (lineId) => copyCondition(bitfieldConditions, lineId),
    (lineId) => removeBitfieldCondition(bitfieldConditions, bitfieldExpansions, linkGroupColors, lineId),
    expandCondition,
    reopenExpansion
  );
}

function clearBitfieldConditionsWrapper() {
  // Close any open expansions first
  Object.keys(bitfieldExpansions).forEach((id) => {
    delete bitfieldExpansions[id];
  });
  
  clearBitfieldConditions(bitfieldConditions, bitfieldExpansions);
  
  // Render directly without re-parsing from textarea
  renderBitfieldConditions(
    bitfieldConditions,
    bitfieldExpansions,
    linkGroupColors,
    (lineId) => linkCondition(bitfieldConditions, linkGroupColors, lineId),
    (lineId) => unlinkCondition(bitfieldConditions, lineId),
    (lineId) => canLinkConditionUtil(bitfieldConditions, lineId),
    (index) => addConditionAtIndex(bitfieldConditions, index),
    (lineId) => copyCondition(bitfieldConditions, lineId),
    (lineId) => removeBitfieldCondition(bitfieldConditions, bitfieldExpansions, linkGroupColors, lineId),
    expandCondition,
    reopenExpansion
  );
}

function updateBitfieldConditionWrapper(lineId, field, value) {
  updateBitfieldCondition(
    bitfieldConditions,
    bitfieldExpansions,
    lineId,
    field,
    value,
    recomputeExpandState,
    expandCondition
  );
}

// Group Management
function linkConditionWrapper(lineId) {
  // Close any open expansions first
  Object.keys(bitfieldExpansions).forEach((id) => {
    delete bitfieldExpansions[id];
  });
  
  linkCondition(bitfieldConditions, linkGroupColors, lineId);
  
  // Render directly without re-parsing from textarea
  renderBitfieldConditions(
    bitfieldConditions,
    bitfieldExpansions,
    linkGroupColors,
    (lineId) => linkCondition(bitfieldConditions, linkGroupColors, lineId),
    (lineId) => unlinkCondition(bitfieldConditions, lineId),
    (lineId) => canLinkConditionUtil(bitfieldConditions, lineId),
    (index) => addConditionAtIndex(bitfieldConditions, index),
    (lineId) => copyCondition(bitfieldConditions, lineId),
    (lineId) => removeBitfieldCondition(bitfieldConditions, bitfieldExpansions, linkGroupColors, lineId),
    expandCondition,
    reopenExpansion
  );
}

function unlinkConditionWrapper(lineId) {
  // Close any open expansions first
  Object.keys(bitfieldExpansions).forEach((id) => {
    delete bitfieldExpansions[id];
  });
  
  unlinkCondition(bitfieldConditions, lineId);
  
  // Render directly without re-parsing from textarea
  renderBitfieldConditions(
    bitfieldConditions,
    bitfieldExpansions,
    linkGroupColors,
    (lineId) => linkCondition(bitfieldConditions, linkGroupColors, lineId),
    (lineId) => unlinkCondition(bitfieldConditions, lineId),
    (lineId) => canLinkConditionUtil(bitfieldConditions, lineId),
    (index) => addConditionAtIndex(bitfieldConditions, index),
    (lineId) => copyCondition(bitfieldConditions, lineId),
    (lineId) => removeBitfieldCondition(bitfieldConditions, bitfieldExpansions, linkGroupColors, lineId),
    expandCondition,
    reopenExpansion
  );
}
function validateTypeChangeWrapper(lineId, newType) {
  const condition = bitfieldConditions.find((c) => c.lineId === lineId);
  if (!condition) return;

  if (!validateTypeChange(condition.flag, newType)) {
    // Revert to Mem and show red flash
    updateBitfieldConditionWrapper(lineId, 'type', 'Mem');
    flashTypeDropdown(lineId);
    return;
  }

  updateBitfieldConditionWrapper(lineId, 'type', newType);
}

function canLinkConditionWrapper(lineId) {
  return canLinkConditionUtil(bitfieldConditions, lineId);
}

// Expansion System
function expandCondition(lineId) {
  // Close any existing expansions first
  Object.keys(bitfieldExpansions).forEach((id) => {
    if (id != lineId) {
      delete bitfieldExpansions[id];
    }
  });

  const condition = bitfieldConditions.find((c) => c.lineId === lineId);
  if (!condition) {
    return;
  }

  const groupLines = getGroupLines(bitfieldConditions, condition.groupId);

  if (!bitfieldExpansions[lineId]) {
    bitfieldExpansions[lineId] = {
      generatedGroups: '1',
      deltaCheck: true, // Default to on
      lineConfigs: groupLines.map((line) => {
        // Set default custom field size based on individual line type
        let defaultCustomFieldSize = '0x50'; // Default for everything else
        
        if (['Bit0', 'Bit1', 'Bit2', 'Bit3', 'Bit4', 'Bit5', 'Bit6', 'Bit7', 'BitCount'].includes(line.size)) {
          defaultCustomFieldSize = '0x08'; // Individual bits
        } else if (['Lower4', 'Upper4'].includes(line.size)) {
          defaultCustomFieldSize = '0x20'; // 4-bit types
        }
        
        return {
          lineId: line.lineId,
          activeTab: 'left',
          arithmeticIncrement: '',
          customFieldSize: defaultCustomFieldSize, // Set default based on individual line type
          customized: false,
          customData: null,
        };
      }),
    };
  }

  const expansion = bitfieldExpansions[lineId];

  // Generate expansion HTML
  let html = '<div class="expansion-interface">';
  html += `<div class="expansion-header">Expanding Group: ${groupLines.length} line${groupLines.length > 1 ? 's' : ''}</div>`;

  // Generated Groups input
  html += '<div class="expansion-row">';
  html += '<span class="expansion-row-label">Generated Groups:</span>';
  html += `<input type="number" min="1" value="${expansion.generatedGroups}" 
    onchange="window.updateExpansionField(${lineId}, 'generatedGroups', this.value); window.expandCondition(${lineId});" 
    style="width: 100px;">`;
  html += '</div>';

  html += '<div class="expansion-divider"></div>';

  // Individual line configurations
  groupLines.forEach((line, idx) => {
    const lineConfig = expansion.lineConfigs[idx];
    html += '<div class="expansion-line-config">';
    html += `<div class="expansion-line-header">Line ${line.lineId}: ${line.flag} ${line.type} ${line.size} ${line.memory}</div>`;

    // Tab selection
    const leftExpandable = !['Recall'].includes(line.type);
    const hasComparison = line.cmp && line.cmp.trim() !== '';
    const rightExpandable =
      !['Recall'].includes(line.compareType) && hasComparison;
    const leftHasSize = [
      'Mem',
      'Delta',
      'Prior',
      'Invert',
      'BCD',
      'Float',
    ].includes(line.type);
    const rightHasSize = [
      'Mem',
      'Delta',
      'Prior',
      'Invert',
      'BCD',
      'Float',
    ].includes(line.compareType);
    const bothExpandable =
      leftHasSize && rightHasSize && line.size === line.compareSize;

    html += '<div class="expansion-tabs">';
    html += `<button class="tab-btn ${lineConfig.activeTab === 'left' ? 'active' : ''}" 
      onclick="window.updateLineConfig(${lineId}, ${idx}, 'activeTab', 'left'); window.expandCondition(${lineId});" 
      ${!leftExpandable || lineConfig.customized ? 'disabled' : ''}>Left</button>`;
    html += `<button class="tab-btn ${lineConfig.activeTab === 'right' ? 'active' : ''}" 
      onclick="window.updateLineConfig(${lineId}, ${idx}, 'activeTab', 'right'); window.expandCondition(${lineId});" 
      ${!rightExpandable || lineConfig.customized ? 'disabled' : ''}>Right</button>`;
    html += `<button class="tab-btn ${lineConfig.activeTab === 'both' ? 'active' : ''}" 
      onclick="window.updateLineConfig(${lineId}, ${idx}, 'activeTab', 'both'); window.expandCondition(${lineId});" 
      ${!bothExpandable || lineConfig.customized ? 'disabled' : ''}>Both</button>`;
    html += '</div>';

    // Input fields
    html += '<div class="expansion-row">';
    html += '<span class="expansion-row-label">Arithmetic Increment:</span>';
    html += `<input type="text" placeholder="Increment" value="${lineConfig.arithmeticIncrement || ''}" 
      onchange="window.updateLineConfig(${lineId}, ${idx}, 'arithmeticIncrement', this.value)" 
      ${lineConfig.customized ? 'disabled' : ''} style="width: 120px;">`;
    html +=
      '<span class="expansion-row-label" style="margin-left: 1rem;">Custom Field:</span>';
    html += `<input type="text" placeholder="Field Size" value="${lineConfig.customFieldSize || ''}" 
      onchange="window.updateLineConfig(${lineId}, ${idx}, 'customFieldSize', this.value)" 
      ${lineConfig.customized ? 'disabled' : ''} style="width: 100px;">`;

    if (lineConfig.customized) {
      html += `<button class="cancel-btn" onclick="window.cancelLineCustomization(${lineId}, ${idx})">Cancel</button>`;
    } else {
      html += `<button class="secondary-btn" onclick="window.openLineCustomization(${lineId}, ${idx})">Customize</button>`;
    }
    html += '</div>';

    if (lineConfig.customized && lineConfig.customData) {
      html += `<div class="customization-badge">✓ Custom expansion configured (${lineConfig.customData.selectedCount} addresses)</div>`;
    }

    html += '</div>'; // end expansion-line-config
  });

  html += '<div class="expansion-footer">';
  html += `<button class="cancel-btn" onclick="window.cancelExpansion(${lineId})">Cancel</button>`;
  html += `<button class="confirm-btn" onclick="window.confirmExpansion(${lineId})">Confirm</button>`;
  html += '</div>';
  
  // Add optimization controls section
  html += '<div class="expansion-optimization" style="margin-top: 1rem; display: flex; align-items: center; gap: 1rem;">';
  html += '<div class="expansion-tabs" style="display: flex; gap: 0.5rem; margin-bottom: 0;">';
  
  // Check if Bit Compression should be enabled
  // Rule: Only Bit lines can have customizations or increments for Bit Compression to work
  const hasBitCustomExpansion = (() => {
    // First, check if there's at least one Bit line with custom expansion
    const hasBitLinesWithCustomExpansion = groupLines.some((line, lineIdx) => {
      const lineConfig = expansion.lineConfigs[lineIdx];
      const isValidBitType = ['Mem', 'Delta', 'Prior'].includes(line.type);
      const isBitSize = line.size && line.size.match(/^Bit[0-7]$/);
      const hasCustomExpansion = lineConfig.customized && lineConfig.customData;
      console.log(`DEBUG: Bit Line ${line.lineId} - Type: ${line.type}, Size: ${line.size}, IsValidBitType: ${isValidBitType}, IsBitSize: ${isBitSize}, Customized: ${lineConfig.customized}, HasCustomData: ${!!lineConfig.customData}`);
      return isValidBitType && isBitSize && hasCustomExpansion;
    });

    if (!hasBitLinesWithCustomExpansion) {
      console.log(`DEBUG: hasBitCustomExpansion: false (no Bit lines with custom expansion)`);
      return false;
    }

    // Second, check if any non-Bit line has customizations or increments
    const hasNonBitLineCustomizations = groupLines.some((line, lineIdx) => {
      const lineConfig = expansion.lineConfigs[lineIdx];
      const isBitSize = line.size && line.size.match(/^Bit[0-7]$/);
      
      // Check for custom expansion on non-Bit lines
      const hasCustomExpansion = lineConfig.customized && lineConfig.customData;
      
      // Check for arithmetic increments (non-zero, non-blank)
      const hasArithmeticIncrement = lineConfig.arithmeticIncrement && 
                                     lineConfig.arithmeticIncrement.trim() !== '' && 
                                     lineConfig.arithmeticIncrement.trim() !== '0';
      
      const hasCustomization = hasCustomExpansion || hasArithmeticIncrement;
      
      console.log(`DEBUG: Non-Bit Line ${line.lineId} - Type: ${line.type}, Size: ${line.size}, IsBitSize: ${isBitSize}, HasCustomExpansion: ${hasCustomExpansion}, HasArithmeticIncrement: ${hasArithmeticIncrement}, HasCustomization: ${hasCustomization}`);
      
      return !isBitSize && hasCustomization;
    });

    // Bit Compression is enabled only if there are Bit lines with custom expansion
    // AND no non-Bit lines have customizations or increments
    const result = hasBitLinesWithCustomExpansion && !hasNonBitLineCustomizations;
    console.log(`DEBUG: hasBitCustomExpansion: ${result} (Bit lines with custom: ${hasBitLinesWithCustomExpansion}, Non-Bit lines with custom: ${hasNonBitLineCustomizations})`);
    return result;
  })();
  
  // Check if Delta/Mem Check should be enabled
  const hasDeltaMemCheckRequirements = groupLines.some((line) => {
    // Check for Add/Sub Source flag (A:) or And/Or next flag
    const hasRequiredFlag = ['A:'].includes(line.flag);
    
    if (!hasRequiredFlag) return false;
    
    // Check for MEM or DELTA on left or right logic
    const leftIsMemOrDelta = ['Mem', 'Delta'].includes(line.type);
    const rightIsMemOrDelta = line.cmp && ['Mem', 'Delta'].includes(line.compareType);
    
    // Check for Mem/Mem || Delta/Delta on both left and right
    const bothMemOrDelta = leftIsMemOrDelta && rightIsMemOrDelta && 
      ((line.type === 'Mem' && line.compareType === 'Mem') || 
       (line.type === 'Delta' && line.compareType === 'Delta'));
    
    return leftIsMemOrDelta || rightIsMemOrDelta || bothMemOrDelta;
  });
  
  html += `<button id="deltaMemCheck" class="tab-btn ${hasDeltaMemCheckRequirements ? 'active' : ''}" 
    onclick="toggleDeltaMemCheck()" 
    ${!hasDeltaMemCheckRequirements ? 'disabled' : ''}>Delta/Mem Check</button>`;
  html += `<button id="bitCompression" class="tab-btn ${hasBitCustomExpansion ? 'active' : ''}" 
    onclick="toggleBitCompression()" 
    ${!hasBitCustomExpansion ? 'disabled' : ''}>Bit-Compression</button>`;
  html += '</div>';
  html += '</div>';
  html += '</div>';

  bitfieldExpansions[lineId].html = html;
  
  // Render the updated conditions with expansion
  renderBitfieldConditions(
    bitfieldConditions,
    bitfieldExpansions,
    linkGroupColors,
    (lineId) => linkCondition(bitfieldConditions, linkGroupColors, lineId),
    (lineId) => unlinkCondition(bitfieldConditions, lineId),
    (lineId) => canLinkConditionUtil(bitfieldConditions, lineId),
    (index) => addConditionAtIndex(bitfieldConditions, index),
    (lineId) => copyCondition(bitfieldConditions, lineId),
    (lineId) => removeBitfieldCondition(bitfieldConditions, bitfieldExpansions, linkGroupColors, lineId),
    expandCondition,
    reopenExpansion
  );
}

function updateExpansionFieldWrapper(lineId, field, value) {
  // If updating generatedGroups, cancel all custom expansions
  if (field === 'generatedGroups') {
    console.log(`=== DEBUG: Generated Groups input changed ===`);
    console.log(`Line ID: ${lineId}`);
    console.log(`New Generated Groups value: ${value}`);
    console.log('Cancelling all custom expansions...');
    cancelAllCustomExpansions(bitfieldExpansions, lineId, expandCondition);
  }
  
  updateExpansionField(bitfieldExpansions, lineId, field, value);
}

function updateLineConfigWrapper(expansionId, lineIndex, field, value) {
  updateLineConfig(bitfieldExpansions, expansionId, lineIndex, field, value);
}

function cancelExpansionWrapper(lineId) {
  cancelExpansion(bitfieldExpansions, lineId);
  
  // Re-render after canceling
  renderBitfieldConditions(
    bitfieldConditions,
    bitfieldExpansions,
    linkGroupColors,
    (lineId) => linkCondition(bitfieldConditions, linkGroupColors, lineId),
    (lineId) => unlinkCondition(bitfieldConditions, lineId),
    (lineId) => canLinkConditionUtil(bitfieldConditions, lineId),
    (index) => addConditionAtIndex(bitfieldConditions, index),
    (lineId) => copyCondition(bitfieldConditions, lineId),
    (lineId) => removeBitfieldCondition(bitfieldConditions, bitfieldExpansions, linkGroupColors, lineId),
    expandCondition,
    reopenExpansion
  );
}

function cancelLineCustomizationWrapper(expansionId, lineIndex) {
  cancelLineCustomization(bitfieldExpansions, expansionId, lineIndex, expandCondition);
}

function openLineCustomizationWrapper(expansionId, lineIndex) {
  openLineCustomization(
    bitfieldExpansions,
    bitfieldConditions,
    expansionId,
    lineIndex,
    (groupId) => getGroupLines(bitfieldConditions, groupId),
    () => renderBitfieldConditions(
      bitfieldConditions,
      bitfieldExpansions,
      linkGroupColors,
      (lineId) => linkCondition(bitfieldConditions, linkGroupColors, lineId),
      (lineId) => unlinkCondition(bitfieldConditions, lineId),
      (lineId) => canLinkConditionUtil(bitfieldConditions, lineId),
      (index) => addConditionAtIndex(bitfieldConditions, index),
      (lineId) => copyCondition(bitfieldConditions, lineId),
      (lineId) => removeBitfieldCondition(bitfieldConditions, bitfieldExpansions, linkGroupColors, lineId),
      expandCondition,
      reopenExpansion
    )
  );
}

function confirmExpansionWrapper(lineId) {
  const expansion = bitfieldExpansions[lineId];
  if (!expansion) {
    console.log('No expansion found for:', lineId);
    return;
  }

  const condition = bitfieldConditions.find((c) => c.lineId === lineId);
  if (!condition) {
    console.log('No condition found for:', lineId);
    return;
  }

  const groupLines = getGroupLines(bitfieldConditions, condition.groupId);
  const generatedGroups = parseInt(expansion.generatedGroups) || 1;

  let allExpandedLines = [];

  // OPTIMIZATION: Check if Bit Compression can reduce the number of groups
  const bitCompressionButton = document.getElementById('bitCompression');
  const bitCompressionEnabled = bitCompressionButton && bitCompressionButton.classList.contains('active');
  
  console.log('Starting expansion - Groups:', generatedGroups, 'Lines:', groupLines.length);

  let actualGroupsToGenerate = generatedGroups;
  let lastCompressibleLine = null;
  let lastCompressibleLineIdx = -1;

  // If Bit Compression is enabled, check if we can reduce the number of groups
  if (bitCompressionEnabled && generatedGroups > 1) {
    console.log('Checking for group optimization...');
    
    // Find the last line that has custom expansion (this determines compression)
    for (let i = groupLines.length - 1; i >= 0; i--) {
      const line = groupLines[i];
      const lineConfig = expansion.lineConfigs[i];
      const isBitType = ['Mem', 'Delta', 'Prior'].includes(line.type);
      const isBitSize = line.size && line.size.match(/^Bit[0-7]$/);
      const hasCustomExpansion = lineConfig.customized && lineConfig.customData;
      
      if (isBitType && isBitSize && hasCustomExpansion) {
        lastCompressibleLine = { line, lineIdx: i, lineConfig };
        lastCompressibleLineIdx = i;
        break;
      }
    }
    
    if (lastCompressibleLine) {
      console.log('Found compressible line at index', lastCompressibleLineIdx);
      
      // Generate what the compressible line would produce for all groups
      const compressibleExpandedLines = [];
      for (let groupIdx = 0; groupIdx < generatedGroups; groupIdx++) {
        const customLines = generateCustomLines(
          lastCompressibleLine.line, 
          lastCompressibleLine.lineConfig, 
          groupIdx
        );
        compressibleExpandedLines.push(...customLines);
      }
      
      console.log('Compressible line would generate', compressibleExpandedLines.length, 'lines for', generatedGroups, 'groups');
      
      // Apply Bit Compression to see how many groups it reduces to
      const compressedLines = compressBits(compressibleExpandedLines);
      const compressedGroupCount = compressedLines.length;
      
      console.log('Bit Compression reduces', generatedGroups, 'groups to', compressedGroupCount, 'groups');
      
      // Use the reduced group count
      actualGroupsToGenerate = compressedGroupCount;
    } else {
      console.log('No compressible lines found, using original group count');
    }
  }

  console.log('Generating', actualGroupsToGenerate, 'groups');
  
  if (bitCompressionEnabled && actualGroupsToGenerate < generatedGroups && lastCompressibleLine) {
    // OPTIMIZED EXPANSION: Separate and interleave compressible/non-compressible lines
    console.log('Using interleaved optimization');
    
    // Step 1: Generate non-compressible lines (String A) - these will be duplicated
    const nonCompressibleLines = [];
    groupLines.forEach((line, lineIdx) => {
      if (lineIdx !== lastCompressibleLineIdx) {
        const lineText = convertBitfieldConditionToText(line);
        nonCompressibleLines.push(lineText);
      }
    });
    console.log('Non-compressible lines:', nonCompressibleLines.length);
    
    // Step 2: Generate compressible line for all groups and compress them
    const compressibleExpandedLines = [];
    for (let groupIdx = 0; groupIdx < generatedGroups; groupIdx++) {
      const customLines = generateCustomLines(
        lastCompressibleLine.line, 
        lastCompressibleLine.lineConfig, 
        groupIdx
      );
      compressibleExpandedLines.push(...customLines);
    }
    console.log('Compressible line expanded to', compressibleExpandedLines.length, 'lines');
    
    // Apply Bit Compression to get Strings B, C, D, E
    console.log('Applying Bit Compression');
    console.log('Input to compression:', compressibleExpandedLines);
    const compressedLines = compressBits(compressibleExpandedLines);
    console.log('Compressed to', compressedLines.length, 'lines');
    
    // Step 3: Interleave A + B + A + C + A + D + A + E
    for (let i = 0; i < compressedLines.length; i++) {
      // Add non-compressible lines (String A)
      allExpandedLines.push(...nonCompressibleLines);
      console.log('Added String A for compressed line', i + 1);
      
      // Add compressed line (String B, C, D, E)
      allExpandedLines.push(compressedLines[i]);
      console.log('Added compressed line', i + 1, ':', compressedLines[i]);
    }
    
  } else {
    // STANDARD EXPANSION: Generate all lines for each group together
    console.log('Using standard expansion');
    
    for (let groupIdx = 0; groupIdx < actualGroupsToGenerate; groupIdx++) {
      const groupLinesToAdd = [];
      console.log('Processing group', groupIdx + 1, 'of', actualGroupsToGenerate);
      
      groupLines.forEach((line, lineIdx) => {
        const lineConfig = expansion.lineConfigs[lineIdx];
        console.log(`Line ${lineIdx}: ${line.flag} ${line.type} ${line.size} ${line.memory}`);

        if (lineConfig.customized && lineConfig.customData) {
          // Use custom expansion - generate lines based on user selections
          const customLines = generateCustomLines(line, lineConfig, groupIdx);
          groupLinesToAdd.push(...customLines);
          console.log('Added', customLines.length, 'custom lines');
        } else if (
          lineConfig.arithmeticIncrement &&
          lineConfig.arithmeticIncrement.trim() !== ''
        ) {
          // Use arithmetic expansion with proper size prefix format
          let increment = 0;
          if (lineConfig.arithmeticIncrement.startsWith('0x')) {
            increment = parseInt(lineConfig.arithmeticIncrement, 16);
          } else if (
            lineConfig.arithmeticIncrement.startsWith('h') ||
            lineConfig.arithmeticIncrement.startsWith('H')
          ) {
            increment = parseInt(lineConfig.arithmeticIncrement.substring(1), 16);
          } else {
            increment = parseInt(lineConfig.arithmeticIncrement, 10);
          }

          const baseAddr = parseInt(line.memory.replace('0x', ''), 16);
          const newAddr = (baseAddr + increment * groupIdx).toString(16).toUpperCase().padStart(4, '0');
          const sizePrefix = sizeMapForText[line.size] || '';
          const formattedAddr = `0x${sizePrefix}${newAddr}`;
          const lineText = `${line.flag}${formattedAddr}`;
          groupLinesToAdd.push(lineText);
          console.log('Added arithmetic line:', lineText);
        } else {
          // Copy without changes
          const lineText = convertBitfieldConditionToText(line);
          groupLinesToAdd.push(lineText);
          console.log('Added copy line:', lineText);
        }
      });
      
      console.log('Group', groupIdx + 1, 'total lines:', groupLinesToAdd.length);
      // Add all lines for this group to the result
      allExpandedLines.push(...groupLinesToAdd);
    }
  }
  
  console.log('Final result:', allExpandedLines.length, 'lines');

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
        // Apply Delta/Mem check for Add/Sub Source group
        allExpandedLines = applyDeltaMemCheck(groupLines[groupLines.length - 1], allExpandedLines);
        console.log('Applied Delta/Mem check for Add/Sub Source group');
      } else if (isAndOrNextGroup) {
        // Apply And/Or Next check for group
        allExpandedLines = applyAndOrNextCheck(groupLines[groupLines.length - 1], allExpandedLines);
        console.log('Applied And/Or Next check for group');
      }
    }
  }

  console.log('Setting expanded lines:', allExpandedLines);

  // Store the actual groups count after optimization/compression in the condition
  const actualGroupsCount = actualGroupsToGenerate;

  // Mark only the group leader with expanded lines, others get empty arrays
  groupLines.forEach((groupCondition, index) => {
    groupCondition.expanded = true;
    groupCondition.generatedGroupsCount = actualGroupsCount; // Store for badge display
    if (index === 0) {
      // Only the first condition (group leader) gets the expanded lines
      groupCondition.expandedLines = allExpandedLines;
    } else {
      // Other conditions get empty expanded lines (they're represented by the leader)
      groupCondition.expandedLines = [];
    }
  });

  // Clean up expansion data
  delete bitfieldExpansions[lineId];

  // Re-render to show the "Added X Lines" badge
  renderBitfieldConditions(
    bitfieldConditions,
    bitfieldExpansions,
    linkGroupColors,
    (lineId) => linkCondition(bitfieldConditions, linkGroupColors, lineId),
    (lineId) => unlinkCondition(bitfieldConditions, lineId),
    (lineId) => canLinkConditionUtil(bitfieldConditions, lineId),
    (index) => addConditionAtIndex(bitfieldConditions, index),
    (lineId) => copyCondition(bitfieldConditions, lineId),
    (lineId) => removeBitfieldCondition(bitfieldConditions, bitfieldExpansions, linkGroupColors, lineId),
    expandCondition,
    reopenExpansion
  );
}

// Utility Functions
function copyToClipboard(text) {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      console.log('Copied to clipboard');
    })
    .catch((err) => {
      console.error('Failed to copy: ', err);
    });
}

function generateBitfieldLogic() {
  // Check if R/R Collapse optimization is enabled
  const optimizeButton = document.getElementById('optimizeRR');
  const optimizeEnabled = optimizeButton && optimizeButton.classList.contains('active');

  console.log('Generate Logic - R/R enabled:', optimizeEnabled);

  // Collect all conditions including expanded ones
  let allLines = [];

  bitfieldConditions.forEach((condition) => {
    // Skip non-leader group members that are expanded (they're represented by the leader)
    if (condition.expanded && condition.expandedLines.length > 0) {
      console.log('Condition', condition.lineId, 'has', condition.expandedLines.length, 'expanded lines');
      
      let expandedLines = [...condition.expandedLines]; // Clone array
      
      // Apply R/R Collapse (Bit Compression) if enabled
      if (optimizeEnabled) {
        const originalLength = expandedLines.length;
        expandedLines = compressBits(expandedLines);
        const linesSaved = originalLength - expandedLines.length;
        console.log('Bit Compression:', originalLength, '→', expandedLines.length, '(saved', linesSaved, ')');
      }
      
      allLines.push(...expandedLines);
    } else if (condition.expanded && condition.expandedLines.length === 0) {
      // Skip group members that are expanded but have no lines (represented by leader)
      console.log('Condition', condition.lineId, 'is expanded group member - skipping');
    } else {
      const lineText = convertBitfieldConditionToText(condition);
      console.log('Condition', condition.lineId, 'as normal line:', lineText);
      allLines.push(lineText);
    }
  });

  console.log('Collected', allLines.length, 'lines');

  // Generate the final logic string
  let logicString = allLines.join('_');
  console.log('Logic string length:', logicString.length);

  if (optimizeEnabled) {
    // Apply R/R Collapse (Bit Compression) optimization
    console.log('R/R Collapse optimization applied during line collection');
    
    // Apply R/R (Remember/Recall) optimization
    console.log('Applying R/R optimization');
    const rrResult = applyRROptimization(logicString);
    
    if (rrResult.savings > 0) {
      logicString = rrResult.optimizedLogic;
      console.log('R/R Optimization successful!');
      console.log('Pattern:', rrResult.patternUsed.lines.length, 'lines ×', rrResult.patternUsed.count, 'occurrences');
      console.log('Original flag:', rrResult.patternUsed.originalFlag);
      console.log('Total savings:', rrResult.savings, 'characters');
    } else {
      console.log('R/R Optimization: No suitable patterns found');
    }
  }

  // Update the base logic textarea
  document.getElementById('baseLogic').value = logicString;

  console.log('=== About to re-parse - this will lose group structure ===');
  // Re-parse and auto-link
  updateGuiFromText();

  // Copy to clipboard
  copyToClipboard(logicString);
  console.log('Generate Logic Complete');
}

// ============================================================================
// GLOBAL WINDOW BINDINGS
// ============================================================================

// Toggle functions for optimization and expansion options
function toggleOptimize(type) {
  const button = document.getElementById('optimizeRR');
  button.classList.toggle('active');
  console.log(`Optimize ${type} toggled:`, button.classList.contains('active'));
}

function toggleDeltaMemCheck() {
  const button = document.getElementById('deltaMemCheck');
  button.classList.toggle('active');
  console.log('Delta/Mem Check toggled:', button.classList.contains('active'));
  
  // Update expansion data
  // This would need to be tied to the current expansion context
}

function toggleBitCompression() {
  const button = document.getElementById('bitCompression');
  button.classList.toggle('active');
  console.log('Bit-Compression toggled:', button.classList.contains('active'));
  
  // Update expansion data
  // This would need to be tied to the current expansion context
}

// Make functions globally accessible for HTML onclick handlers
console.log('Setting up global functions...');
window.updateGuiFromText = updateGuiFromText;
window.addBitfieldCondition = addBitfieldConditionWrapper;
window.removeBitfieldCondition = removeBitfieldConditionWrapper;
window.addConditionAtIndex = addConditionAtIndexWrapper;
window.copyCondition = copyConditionWrapper;
window.clearBitfieldConditions = clearBitfieldConditionsWrapper;
window.updateBitfieldCondition = updateBitfieldConditionWrapper;
window.linkCondition = linkConditionWrapper;
window.unlinkCondition = unlinkConditionWrapper;
console.log('Global functions set up complete');
window.canLinkCondition = canLinkConditionWrapper;
window.validateTypeChange = validateTypeChangeWrapper;
window.expandCondition = expandCondition;
window.reopenExpansion = reopenExpansion;
window.recomputeExpandState = recomputeExpandState;
window.updateExpansionField = updateExpansionFieldWrapper;
window.updateLineConfig = updateLineConfigWrapper;
window.cancelExpansion = cancelExpansionWrapper;
window.cancelLineCustomization = cancelLineCustomizationWrapper;
window.openLineCustomization = openLineCustomizationWrapper;
window.confirmExpansion = confirmExpansionWrapper;
window.cancelCustomPanel = (expansionId, lineIndex) => cancelCustomPanel(bitfieldExpansions, expansionId, lineIndex, expandCondition);
window.toggleOptimize = toggleOptimize;
window.toggleDeltaMemCheck = toggleDeltaMemCheck;
window.toggleBitCompression = toggleBitCompression;
window.confirmCustomPanel = (expansionId, lineIndex) => confirmCustomPanel(bitfieldExpansions, expansionId, lineIndex, expandCondition);
window.toggleCustomSkipValidated = (expansionId, lineIndex, rowBaseAddr, byteOffset) => toggleCustomSkipValidated(bitfieldExpansions, expansionId, lineIndex, rowBaseAddr, byteOffset, openLineCustomizationWrapper);
window.toggleCustomBitValidated = (expansionId, lineIndex, rowBaseAddr, byteOffset, bit) => toggleCustomBitValidated(bitfieldExpansions, expansionId, lineIndex, rowBaseAddr, byteOffset, bit, openLineCustomizationWrapper);
window.toggleCustomBitCountValidated = (expansionId, lineIndex, rowBaseAddr, byteOffset) => toggleCustomBitCountValidated(bitfieldExpansions, expansionId, lineIndex, rowBaseAddr, byteOffset, openLineCustomizationWrapper);
window.toggleCustomUpperValidated = (expansionId, lineIndex, rowBaseAddr, byteOffset) => toggleCustomUpperValidated(bitfieldExpansions, expansionId, lineIndex, rowBaseAddr, byteOffset, openLineCustomizationWrapper);
window.toggleCustomLowerValidated = (expansionId, lineIndex, rowBaseAddr, byteOffset) => toggleCustomLowerValidated(bitfieldExpansions, expansionId, lineIndex, rowBaseAddr, byteOffset, openLineCustomizationWrapper);
window.toggleCustomAllUpperValidated = (expansionId, lineIndex, rowBaseAddr) => toggleCustomAllUpperValidated(bitfieldExpansions, expansionId, lineIndex, rowBaseAddr, openLineCustomizationWrapper);
window.toggleCustomAllLowerValidated = (expansionId, lineIndex, rowBaseAddr) => toggleCustomAllLowerValidated(bitfieldExpansions, expansionId, lineIndex, rowBaseAddr, openLineCustomizationWrapper);
window.toggleCustomStandardValidated = (expansionId, lineIndex, rowBaseAddr, offset) => toggleCustomStandardValidated(bitfieldExpansions, expansionId, lineIndex, rowBaseAddr, offset, openLineCustomizationWrapper);
window.toggleCustomAllStandardValidated = (expansionId, lineIndex, rowBaseAddr, stride, buttonsPerRow) => toggleCustomAllStandardValidated(bitfieldExpansions, expansionId, lineIndex, rowBaseAddr, stride, buttonsPerRow, openLineCustomizationWrapper);
window.copyToClipboard = copyToClipboard;
window.generateBitfieldLogic = generateBitfieldLogic;
window.addBitfieldCondition = addBitfieldConditionWrapper;
window.clearBitfieldConditions = clearBitfieldConditionsWrapper;

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initializes the application when DOM is ready
 */
function initializeApp() {
  // Parse initial content from textarea if any
  updateGuiFromText();
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
