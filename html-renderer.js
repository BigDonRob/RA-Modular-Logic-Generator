// ============================================================================
// HTML RENDERER MODULE
// Updated: 2025-02-02 02:37:00 - Fixed badge generation groups
// ============================================================================

console.log(' html-renderer.js loading - v3');

import { 
  SIZE_OPTIONS, 
  TYPE_OPTIONS, 
  FLAG_OPTIONS, 
  OPERAND_FLAGS, 
  SIZE_NEEDED_TYPES 
} from './core-constants.js';
import { canExpand } from './validation.js';
import { getGroupLines, isGroupLeader } from './groups.js';

/**
 * Gets size options HTML for a given type
 * @param {string} type - The condition type
 * @param {string} selectedSize - The currently selected size
 * @returns {string} HTML options string
 */
export function getSizeOptions(type, selectedSize) {
  let options = '';

  if (type === 'BCD') {
    const sizes = SIZE_OPTIONS.BCD;
    sizes.forEach((size) => {
      options += `<option value="${size}" ${selectedSize === size ? 'selected' : ''}>${size}</option>`;
    });
  } else if (type === 'Float') {
    const sizes = SIZE_OPTIONS.Float;
    sizes.forEach((size) => {
      options += `<option value="${size}" ${selectedSize === size ? 'selected' : ''}>${size}</option>`;
    });
  } else if (
    type === 'Mem' ||
    type === 'Delta' ||
    type === 'Prior' ||
    type === 'Invert'
  ) {
    const sizes = SIZE_OPTIONS.Mem;
    sizes.forEach((size) => {
      options += `<option value="${size}" ${selectedSize === size ? 'selected' : ''}>${size}</option>`;
    });
  }

  return options;
}

/**
 * Gets type options HTML for a given flag
 * @param {string} flag - The condition flag
 * @param {string} currentType - The currently selected type
 * @returns {string} HTML options string
 */
export function getTypeOptions(flag, currentType) {
  if (flag === 'I:') {
    // Add Address flag - only allow Mem, Prior, Value, and Recall
    const allowedTypes = TYPE_OPTIONS.AddAddress;
    let options = '';
    allowedTypes.forEach((type) => {
      options += `<option value="${type}" ${currentType === type ? 'selected' : ''}>${type}</option>`;
    });
    return options;
  } else {
    // All other flags - allow all types
    const allTypes = TYPE_OPTIONS.All;
    let options = '';
    allTypes.forEach((type) => {
      options += `<option value="${type}" ${currentType === type ? 'selected' : ''}>${type}</option>`;
    });
    return options;
  }
}

/**
 * Creates the HTML for a condition row
 * @param {Object} condition - The condition object
 * @returns {string} HTML string for the condition row
 */
export function createConditionRowHTML(condition) {
  const isOperandFlag = OPERAND_FLAGS.includes(condition.flag);
  const hasOperand = condition.cmp && condition.cmp !== '';

  let cmpOptions = '';
  if (isOperandFlag) {
    cmpOptions = `
      <option value="" ${condition.cmp === '' ? 'selected' : ''}></option>
      <option value="*" ${condition.cmp === '*' ? 'selected' : ''}>*</option>
      <option value="/" ${condition.cmp === '/' ? 'selected' : ''}>/</option>
      <option value="%" ${condition.cmp === '%' ? 'selected' : ''}>%</option>
      <option value="+" ${condition.cmp === '+' ? 'selected' : ''}>+</option>
      <option value="-" ${condition.cmp === '-' ? 'selected' : ''}>-</option>
      <option value="&" ${condition.cmp === '&' ? 'selected' : ''}>&amp;</option>
      <option value="^" ${condition.cmp === '^' ? 'selected' : ''}>^</option>
    `;
  } else {
    cmpOptions = `
      <option value="=" ${condition.cmp === '=' ? 'selected' : ''}>=</option>
      <option value="<" ${condition.cmp === '<' ? 'selected' : ''}>&lt;</option>
      <option value="<=" ${condition.cmp === '<=' ? 'selected' : ''}>&lt;=</option>
      <option value=">" ${condition.cmp === '>' ? 'selected' : ''}>&gt;</option>
      <option value=">=" ${condition.cmp === '>=' ? 'selected' : ''}>&gt;=</option>
      <option value="!=" ${condition.cmp === '!=' ? 'selected' : ''}>!=</option>
    `;
  }

  const leftSizeOptions = getSizeOptions(condition.type, condition.size);
  const rightSizeOptions = getSizeOptions(
    condition.compareType,
    condition.compareSize,
  );

  const leftNeedsSize = SIZE_NEEDED_TYPES.includes(condition.type);
  const leftNeedsInput = condition.type !== 'Recall';
  const rightNeedsSize = SIZE_NEEDED_TYPES.includes(condition.compareType);
  const rightNeedsInput = condition.compareType !== 'Recall';

  return `
    <div>
      <select onchange="window.updateBitfieldCondition(${condition.lineId}, 'flag', this.value); window.renderBitfieldConditions();">
        ${FLAG_OPTIONS.map(flag => 
          `<option value="${flag.value}" ${condition.flag === flag.value ? 'selected' : ''}>${flag.label}</option>`
        ).join('')}
      </select>
    </div>
    
    <div>
      <select id="type-select-${condition.lineId}" onchange="window.validateTypeChange(${condition.lineId}, this.value); window.renderBitfieldConditions();">
        ${getTypeOptions(condition.flag, condition.type)}
      </select>
    </div>
    
    <div class="${!leftNeedsSize ? 'hidden' : ''}">
      <select onchange="window.updateBitfieldCondition(${condition.lineId}, 'size', this.value)" ${!leftNeedsSize ? 'disabled' : ''}>
        ${leftSizeOptions || '<option>-</option>'}
      </select>
    </div>
    
    <div class="${!leftNeedsInput ? 'hidden' : ''}">
      <input type="text" value="${condition.memory}" 
        onchange="window.updateBitfieldCondition(${condition.lineId}, 'memory', this.value); window.recomputeExpandState(${condition.lineId}); window.renderBitfieldConditions();" 
        oninput="window.updateBitfieldCondition(${condition.lineId}, 'memory', this.value); window.recomputeExpandState(${condition.lineId});" 
        ${!leftNeedsInput ? 'disabled' : ''}>
    </div>
    
    <div>
      <select onchange="window.updateBitfieldCondition(${condition.lineId}, 'cmp', this.value); window.renderBitfieldConditions();">
        ${cmpOptions}
      </select>
    </div>
    
    <div class="${isOperandFlag && !hasOperand ? 'hidden' : ''}">
      <select onchange="window.updateBitfieldCondition(${condition.lineId}, 'compareType', this.value); window.renderBitfieldConditions();" ${isOperandFlag && !hasOperand ? 'disabled' : ''}>
        <option value="Value" ${condition.compareType === 'Value' ? 'selected' : ''}>Value</option>
        <option value="Mem" ${condition.compareType === 'Mem' ? 'selected' : ''}>Mem</option>
        <option value="Delta" ${condition.compareType === 'Delta' ? 'selected' : ''}>Delta</option>
        <option value="Prior" ${condition.compareType === 'Prior' ? 'selected' : ''}>Prior</option>
        <option value="BCD" ${condition.compareType === 'BCD' ? 'selected' : ''}>BCD</option>
        <option value="Float" ${condition.compareType === 'Float' ? 'selected' : ''}>Float</option>
        <option value="Invert" ${condition.compareType === 'Invert' ? 'selected' : ''}>Invert</option>
        <option value="Recall" ${condition.compareType === 'Recall' ? 'selected' : ''}>Recall</option>
      </select>
    </div>
    
    <div class="${(isOperandFlag && !hasOperand) || !rightNeedsSize ? 'hidden' : ''}">
      <select onchange="window.updateBitfieldCondition(${condition.lineId}, 'compareSize', this.value)" ${(isOperandFlag && !hasOperand) || !rightNeedsSize ? 'disabled' : ''}>
        ${rightSizeOptions || '<option>-</option>'}
      </select>
    </div>
    
    <div class="${(isOperandFlag && !hasOperand) || !rightNeedsInput ? 'hidden' : ''}">
      <input type="text" value="${condition.value}" 
        onchange="window.updateBitfieldCondition(${condition.lineId}, 'value', this.value); window.renderBitfieldConditions();" 
        ${(isOperandFlag && !hasOperand) || !rightNeedsInput ? 'disabled' : ''}>
    </div>
    
    <div class="${isOperandFlag ? 'hidden' : ''}">
      <input type="number" min="0" value="${condition.hits}" onchange="window.updateBitfieldCondition(${condition.lineId}, 'hits', this.value)" ${isOperandFlag ? 'disabled' : ''}>
    </div>
  `;
}

/**
 * Formats a condition for display
 * @param {Object} condition - The condition to format
 * @returns {string} Formatted display string
 */
export function formatConditionDisplay(condition) {
  let display = '';
  if (condition.flag) display += condition.flag + ' ';
  display += condition.type + ' ';
  display += condition.size + ' ';
  display += condition.memory;
  if (condition.cmp) {
    display += ' ' + condition.cmp + ' ';
    display += condition.compareType + ' ';
    if (condition.compareSize) display += condition.compareSize + ' ';
    display += condition.value;
  }
  return display;
}

/**
 * Renders all bitfield conditions to the DOM
 * @param {Array} bitfieldConditions - Array of conditions
 * @param {Map} bitfieldExpansions - Expansion map
 * @param {Map} linkGroupColors - Group colors map
 * @param {Function} linkCondition - Function to link conditions
 * @param {Function} unlinkCondition - Function to unlink conditions
 * @param {Function} canLinkCondition - Function to check if linking is possible
 * @param {Function} addConditionAtIndex - Function to add condition at index
 * @param {Function} copyCondition - Function to copy condition
 * @param {Function} removeBitfieldCondition - Function to remove condition
 * @param {Function} expandCondition - Function to expand condition
 * @param {Function} reopenExpansion - Function to reopen expansion
 */
export function renderBitfieldConditions(
  bitfieldConditions,
  bitfieldExpansions,
  linkGroupColors,
  linkCondition,
  unlinkCondition,
  canLinkCondition,
  addConditionAtIndex,
  copyCondition,
  removeBitfieldCondition,
  expandCondition,
  reopenExpansion
) {
  const container = document.getElementById('bitfieldConditionsList');
  
  if (!container) {
    console.error('bitfieldConditionsList container not found!');
    return;
  }
  
  container.innerHTML = '';

  // Group conditions by groupId to render together
  const processedIndices = new Set();
  const groupMap = new Map(); // Map<groupId, condition[]>

  bitfieldConditions.forEach((condition, index) => {
    if (!groupMap.has(condition.groupId)) {
      groupMap.set(condition.groupId, []);
    }
    groupMap.get(condition.groupId).push({ condition, index });
  });

  bitfieldConditions.forEach((condition, index) => {
    if (processedIndices.has(index)) return;

    const groupLines = groupMap.get(condition.groupId);
    const isMultiLineGroup = groupLines.length > 1;

    if (isMultiLineGroup) {
      // Render entire link group
      const colorIndex = linkGroupColors.get(condition.groupId);
      const colorClass = colorIndex === 0 ? 'forest-green' : 'maroon';

      const groupContainer = document.createElement('div');
      groupContainer.className = `link-group-container ${colorClass}`;

      groupLines.forEach(
        ({ condition: groupCondition, index: conditionIndex }) => {
          processedIndices.add(conditionIndex);

          const isLeader = isGroupLeader(bitfieldConditions, groupCondition);

          // Create condition row
          const row = document.createElement('div');
          row.className =
            'bitfield-condition-row' +
            (groupCondition.expanded ? ' read-only' : '') +
            ' show-expand';
          row.setAttribute('data-id', groupCondition.lineId);

          row.innerHTML = createConditionRowHTML(groupCondition);
          groupContainer.appendChild(row);

          // Show buttons based on position in link group
          const copyRow = document.createElement('div');
          copyRow.className = 'bitfield-copy-row';

          if (isLeader) {
            // Leader - show all buttons
            copyRow.innerHTML = `
            ${
              groupCondition.expanded
                ? (() => {
                    // Get the generated groups count from the condition (stored before expansion was deleted)
                    const generatedGroups = groupCondition.generatedGroupsCount || 1;
                    const badgeText = `Generating ${generatedGroups} ${generatedGroups === 1 ? 'group' : 'groups'}`;
                    return `<div class="expansion-badge" onclick="window.reopenExpansion(${groupCondition.lineId})">${badgeText}</div>`;
                  })()
                : `<button type="button" class="expand-btn" onclick="console.log('Expand clicked for line:', ${groupCondition.lineId}); window.expandCondition(${groupCondition.lineId})" ${!canExpand(groupCondition) ? 'disabled' : ''}>Expand</button>`
            }
            <button class="link-btn" onclick="window.linkCondition(${groupCondition.lineId})" ${!canLinkCondition(groupCondition.lineId) ? 'disabled' : ''}>Link</button>
            <button class="add-line-btn" onclick="window.addConditionAtIndex(${conditionIndex})">Add</button>
            <button class="copy-condition-btn" onclick="window.copyCondition(${groupCondition.lineId})">Copy</button>
            <button class="remove-btn" onclick="window.removeBitfieldCondition(${groupCondition.lineId})">×</button>
          `;
          } else {
            // Non-leader - only show Unlink button
            copyRow.innerHTML = `
            <button class="link-btn" onclick="window.unlinkCondition(${groupCondition.lineId})">Unlink</button>
          `;
          }
          groupContainer.appendChild(copyRow);
        },
      );

      container.appendChild(groupContainer);

      // Handle expansion for this group - check if any condition in the group has an expansion
      const groupExpansion = groupLines.find(
        ({ condition: groupCondition }) =>
          bitfieldExpansions[groupCondition.lineId],
      );
      if (groupExpansion) {
        const expansionId = groupExpansion.condition.lineId;
        const expansionDiv = document.createElement('div');

        if (
          bitfieldExpansions[expansionId] &&
          bitfieldExpansions[expansionId].showingCustom
        ) {
          expansionDiv.innerHTML = bitfieldExpansions[expansionId].customHtml;
        } else {
          expansionDiv.innerHTML = bitfieldExpansions[expansionId].html;
        }

        container.appendChild(expansionDiv);
      }
    } else {
      // Render individual condition (not linked)
      processedIndices.add(index);

      const row = document.createElement('div');
      row.className =
        'bitfield-condition-row' +
        (condition.expanded ? ' read-only' : '') +
        ' show-expand';
      row.setAttribute('data-id', condition.lineId);

      row.innerHTML = createConditionRowHTML(condition);
      container.appendChild(row);

      const copyRow = document.createElement('div');
      copyRow.className = 'bitfield-copy-row';
      copyRow.innerHTML = `
        ${
          condition.expanded
            ? (() => {
                // Get the generated groups count from the condition (stored before expansion was deleted)
                const generatedGroups = condition.generatedGroupsCount || 1;
                const badgeText = `Generating ${generatedGroups} ${generatedGroups === 1 ? 'group' : 'groups'}`;
                return `<div class="expansion-badge" onclick="window.reopenExpansion(${condition.lineId})">${badgeText}</div>`;
              })()
            : `<button type="button" class="expand-btn" onclick="console.log('Expand clicked for line:', ${condition.lineId}); window.expandCondition(${condition.lineId})" ${!canExpand(condition) ? 'disabled' : ''}>Expand</button>`
        }
        <button class="link-btn" onclick="window.linkCondition(${condition.lineId})" ${!canLinkCondition(condition.lineId) ? 'disabled' : ''}>Link</button>
        <button class="add-line-btn" onclick="window.addConditionAtIndex(${index})">Add</button>
        <button class="copy-condition-btn" onclick="window.copyCondition(${condition.lineId})">Copy</button>
        <button class="remove-btn" onclick="window.removeBitfieldCondition(${condition.lineId})">×</button>
      `;
      container.appendChild(copyRow);

      // Handle expansion for individual condition
      if (bitfieldExpansions[condition.lineId]) {
        console.log('Rendering expansion for line:', condition.lineId);
        const expansionDiv = document.createElement('div');

        if (bitfieldExpansions[condition.lineId].showingCustom) {
          expansionDiv.innerHTML =
            bitfieldExpansions[condition.lineId].customHtml;
        } else {
          expansionDiv.innerHTML = bitfieldExpansions[condition.lineId].html;
          console.log(
            'Expansion HTML set for line:',
            condition.lineId,
            'length:',
            expansionDiv.innerHTML.length,
          );
        }

        container.appendChild(expansionDiv);
        console.log(
          'Expansion div added to container for line:',
          condition.lineId,
        );
      }
    }
  });
}

/**
 * Flashes a type dropdown to show validation error
 * @param {number} lineId - The line ID
 */
export function flashTypeDropdown(lineId) {
  const selectElement = document.getElementById(`type-select-${lineId}`);
  if (!selectElement) return;

  // Add CSS animation class
  selectElement.classList.add('type-validation-flash');

  // Remove class after animation completes
  setTimeout(() => {
    selectElement.classList.remove('type-validation-flash');
  }, 1000);
}
