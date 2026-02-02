// ============================================================================
// PART 1: Core Setup, Parsing, and Group Management
// ============================================================================

const prefixArray = ['M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T'];
let bitfieldConditions = [];
let bitfieldExpansions = {};
let linkGroupColors = new Map(); // Map<groupId, colorIndex>

const sizePrefixMap = {
  M: 'Bit0',
  N: 'Bit1',
  O: 'Bit2',
  P: 'Bit3',
  Q: 'Bit4',
  R: 'Bit5',
  S: 'Bit6',
  T: 'Bit7',
  L: 'Lower4',
  U: 'Upper4',
  H: '8-bit',
  W: '24-bit',
  X: '32-bit',
  I: '16-bit BE',
  J: '24-bit BE',
  G: '32-bit BE',
  K: 'BitCount',
  fF: 'Float',
  fB: 'Float BE',
  fH: 'Double32',
  fI: 'Double32 BE',
  fM: 'MBF32',
  fL: 'MBF32 LE',
  '': '16-bit',
};

const sizePrefixOrder = [
  'fF',
  'fB',
  'fH',
  'fI',
  'fM',
  'fL',
  'M',
  'N',
  'O',
  'P',
  'Q',
  'R',
  'S',
  'T',
  'L',
  'U',
  'H',
  'W',
  'X',
  'I',
  'J',
  'G',
  'K',
];

// VALIDATION HELPERS
function normalizeHexInput(value, isMemoryType) {
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

function getSizeOptions(type, selectedSize) {
  let options = '';

  if (type === 'BCD') {
    const sizes = ['8-bit', '16-bit', '32-bit', '16-bit BE', '32-bit BE'];
    sizes.forEach((size) => {
      options += `<option value="${size}" ${selectedSize === size ? 'selected' : ''}>${size}</option>`;
    });
  } else if (type === 'Float') {
    const sizes = ['32-bit', '32-bit BE'];
    sizes.forEach((size) => {
      options += `<option value="${size}" ${selectedSize === size ? 'selected' : ''}>${size}</option>`;
    });
  } else if (
    type === 'Mem' ||
    type === 'Delta' ||
    type === 'Prior' ||
    type === 'Invert'
  ) {
    const sizes = [
      '8-bit',
      'Bit0',
      'Bit1',
      'Bit2',
      'Bit3',
      'Bit4',
      'Bit5',
      'Bit6',
      'Bit7',
      'Lower4',
      'Upper4',
      '16-bit',
      '24-bit',
      '32-bit',
      '16-bit BE',
      '24-bit BE',
      '32-bit BE',
      'BitCount',
      'Float',
      'Float BE',
      'Double32',
      'Double32 BE',
      'MBF32',
      'MBF32 LE',
    ];
    sizes.forEach((size) => {
      options += `<option value="${size}" ${selectedSize === size ? 'selected' : ''}>${size}</option>`;
    });
  }

  return options;
}

function parseMemoryToken(token) {
  let body = token.slice(2);
  let prefix = '';

  for (const candidate of sizePrefixOrder) {
    if (body.startsWith(candidate)) {
      prefix = candidate;
      body = body.slice(candidate.length);
      break;
    }
  }

  const size = sizePrefixMap[prefix] || '16-bit';
  return {
    size,
    memory: `0x${body.toUpperCase()}`,
  };
}

function parseOperandToken(token) {
  const trimmed = token.trim();
  if (trimmed.startsWith('{recall}')) {
    return { type: 'Recall', size: '', memory: '' };
  }

  let rest = trimmed;
  let type = 'Mem';
  const prefix = rest.charAt(0);
  if (['d', 'p', 'b', '~'].includes(prefix)) {
    rest = rest.slice(1);
    if (prefix === 'd') type = 'Delta';
    else if (prefix === 'p') type = 'Prior';
    else if (prefix === 'b') type = 'BCD';
    else type = 'Invert';
  }

  if (rest.startsWith('{recall}')) {
    return { type: 'Recall', size: '', memory: '' };
  }

  if (rest.startsWith('0x')) {
    const parsed = parseMemoryToken(rest);
    return { type, size: parsed.size, memory: parsed.memory };
  }

  return { type: 'Value', size: '8-bit', memory: trimmed };
}

function parseLineToCondition(line) {
  const trimmedLine = line.trim();
  if (!trimmedLine) return null;

  let working = trimmedLine;
  let hits = '';

  const hitsMatch = working.match(/\.(\d+)\.$/);
  if (hitsMatch) {
    hits = hitsMatch[1];
    working = working.slice(0, -hitsMatch[0].length);
  }

  let flag = '';
  const flagMatch = working.match(/^([A-Z]:)/);
  if (flagMatch) {
    flag = flagMatch[1];
    working = working.slice(flag.length);
  }

  const isOperandFlag = ['A:', 'B:', 'I:', 'K:'].includes(flag);
  const leftMatch = working.match(
    /^(\{recall\}|[dpb~]?0x[a-zA-Z]{0,2}[0-9A-Fa-f]+|-?\d+)/,
  );
  if (!leftMatch) return null;

  const leftToken = leftMatch[1];
  working = working.slice(leftToken.length);

  let cmp = '';
  let rightToken = '';

  if (working.trim().length > 0) {
    let remaining = working.trim();
    const cmpMatch = isOperandFlag
      ? remaining.match(/^([*\/%+\-&\^])/)
      : remaining.match(/^(<=|>=|!=|=|<|>)/);

    if (cmpMatch) {
      cmp = cmpMatch[1];
      remaining = remaining.slice(cmp.length);
    } else if (!isOperandFlag) {
      cmp = '=';
    }

    if (cmp) {
      rightToken = remaining.trim();
    }
  }

  if (!isOperandFlag && cmp === '') {
    cmp = '=';
  }

  const left = parseOperandToken(leftToken);
  const right = rightToken ? parseOperandToken(rightToken) : null;

  // Apply Add Address flag restrictions
  let finalType = left.type;
  if (flag === 'A:') {
    // Add Address flag only allows Mem, Prior, Value, and Recall types
    if (!['Mem', 'Prior', 'Value', 'Recall'].includes(left.type)) {
      finalType = 'Mem';
    }
  }

  return {
    flag,
    type: finalType,
    size: left.size,
    memory: left.memory,
    cmp,
    compareType: right ? right.type : 'Value',
    compareSize: right ? right.size : '8-bit',
    value: right ? right.memory : '0',
    hits: isOperandFlag ? '' : hits,
  };
}

function parseBaseLogic() {
  const baseLogic = document.getElementById('baseLogic').value.trim();
  if (!baseLogic) return [];
  return baseLogic.split('_').map(parseLineToCondition).filter(Boolean);
}

function syncBitfieldFromText() {
  const parsed = parseBaseLogic();
  bitfieldConditions = parsed.map((condition, index) => ({
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
  }));
  bitfieldExpansions = {};

  // Auto-link Add Address flags
  autoLinkAddressFlags();

  renderBitfieldConditions();
}

function updateGuiFromText() {
  syncBitfieldFromText();
}

// LINKING SYSTEM - SIMPLIFIED
function recalculateLineAndGroupIds() {
  // Store current group relationships before recalculating
  const groupMap = new Map(); // Map old lineId to its groupId
  bitfieldConditions.forEach((condition) => {
    groupMap.set(condition.lineId, condition.groupId);
  });

  // Assign new sequential Line IDs
  bitfieldConditions.forEach((condition, index) => {
    const oldLineId = condition.lineId;
    const newLineId = index + 1;
    condition.lineId = newLineId;

    // If this line was in its own group (groupId == oldLineId), update to new lineId
    if (condition.groupId === oldLineId) {
      condition.groupId = newLineId;
    }
  });

  // Now fix group IDs for linked groups
  // We need to find the new lineId of the group leader and update all members
  const processedGroups = new Set();

  bitfieldConditions.forEach((condition, index) => {
    const currentGroupId = condition.groupId;

    // Skip if already processed or if in own group
    if (
      processedGroups.has(currentGroupId) ||
      condition.groupId === condition.lineId
    ) {
      return;
    }

    // Find all members of this group
    const groupMembers = bitfieldConditions.filter(
      (c) => c.groupId === currentGroupId,
    );

    if (groupMembers.length > 1) {
      // Find the leader (highest lineId in group)
      const leader = groupMembers.reduce((max, line) =>
        line.lineId > max.lineId ? line : max,
      );

      // Update all members to use the leader's lineId as groupId
      groupMembers.forEach((member) => {
        member.groupId = leader.lineId;
      });

      processedGroups.add(currentGroupId);
    }
  });
}

function getGroupLines(groupId) {
  return bitfieldConditions.filter((c) => c.groupId === groupId);
}

function getGroupLeader(groupId) {
  const groupLines = getGroupLines(groupId);
  if (groupLines.length === 0) return null;
  // Leader is the line with the highest lineId in the group
  return groupLines.reduce((max, line) =>
    line.lineId > max.lineId ? line : max,
  );
}

function isGroupLeader(condition) {
  const leader = getGroupLeader(condition.groupId);
  return leader && leader.lineId === condition.lineId;
}

function linkCondition(lineId) {
  const condition = bitfieldConditions.find((c) => c.lineId === lineId);
  if (!condition) return;

  // Only group leaders can link with other groups
  if (!isGroupLeader(condition)) {
    return;
  }

  // Check if already in a multi-line group, if so, add the next line
  const currentGroupLines = getGroupLines(condition.groupId);
  if (currentGroupLines.length > 1) {
    // Already in a multi-line group, so add the next line
    const lastGroupLine = currentGroupLines.reduce((max, line) =>
      line.lineId > max.lineId ? line : max,
    );
    const lastGroupLineIndex = bitfieldConditions.findIndex(
      (c) => c.lineId === lastGroupLine.lineId,
    );

    // Check if there's a condition below to link with
    if (lastGroupLineIndex >= bitfieldConditions.length - 1) {
      return; // No condition below
    }

    const belowCondition = bitfieldConditions[lastGroupLineIndex + 1];
    const belowGroupLines = getGroupLines(belowCondition.groupId);

    // Add all lines from below group to current line's group
    belowGroupLines.forEach((line) => {
      line.groupId = condition.groupId;
    });
  } else {
    // Not in a group yet, so create one with the line below
    const conditionIndex = bitfieldConditions.findIndex(
      (c) => c.lineId === lineId,
    );

    if (conditionIndex >= bitfieldConditions.length - 1) {
      return; // No condition below
    }

    const belowCondition = bitfieldConditions[conditionIndex + 1];
    const belowGroupLines = getGroupLines(belowCondition.groupId);

    // Add all lines from below group to current line's group
    belowGroupLines.forEach((line) => {
      line.groupId = condition.groupId;
    });
  }

  // Assign color if not already assigned
  if (!linkGroupColors.has(condition.groupId)) {
    linkGroupColors.set(condition.groupId, linkGroupColors.size % 2);
  }

  renderBitfieldConditions();
}

function unlinkCondition(lineId) {
  const condition = bitfieldConditions.find((c) => c.lineId === lineId);
  if (!condition) return;

  const groupLines = getGroupLines(condition.groupId);
  const conditionIndex = groupLines.findIndex((c) => c.lineId === lineId);

  // Split: keep lines 0 to conditionIndex in current group
  // Lines after conditionIndex return to their original groups (lineId)
  groupLines.forEach((line, idx) => {
    if (idx > conditionIndex) {
      line.groupId = line.lineId; // Return to original group
    }
  });

  renderBitfieldConditions();
}

function canLinkCondition(lineId) {
  const condition = bitfieldConditions.find((c) => c.lineId === lineId);
  if (!condition) return false;

  // Only group leaders can link with other groups
  if (!isGroupLeader(condition)) {
    return false;
  }

  const groupLines = getGroupLines(condition.groupId);

  // Disable if any line in current group has expanded lines
  if (groupLines.some((c) => c.expanded && c.expandedLines.length > 0)) {
    return false;
  }

  // Find the position of the last line in the current group
  const lastGroupLineIndex = Math.max(
    ...groupLines.map((line) =>
      bitfieldConditions.findIndex((c) => c.lineId === line.lineId),
    ),
  );

  // Disable if no condition below the entire group
  if (lastGroupLineIndex >= bitfieldConditions.length - 1) {
    return false;
  }

  // Get the condition directly below the group
  const belowCondition = bitfieldConditions[lastGroupLineIndex + 1];
  if (!belowCondition) return false;

  // Disable if below condition has pending changes (expanded)
  if (belowCondition.expanded && belowCondition.expandedLines.length > 0) {
    return false;
  }

  // Disable if any line in below group has expanded lines
  const belowGroupLines = getGroupLines(belowCondition.groupId);
  if (belowGroupLines.some((c) => c.expanded && c.expandedLines.length > 0)) {
    return false;
  }

  return true;
}

// BITFIELD MODE FUNCTIONS
function addBitfieldCondition() {
  bitfieldConditions.push({
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
  });

  recalculateLineAndGroupIds();
  renderBitfieldConditions();
}

function removeBitfieldCondition(lineId) {
  const condition = bitfieldConditions.find((c) => c.lineId === lineId);
  if (!condition) return;

  // Get all lines in the group
  const groupLines = getGroupLines(condition.groupId);
  const lineIds = groupLines.map((c) => c.lineId);

  // Remove all conditions in the group
  bitfieldConditions = bitfieldConditions.filter(
    (c) => !lineIds.includes(c.lineId),
  );

  // Clean up expansions
  lineIds.forEach((id) => delete bitfieldExpansions[id]);

  // Clean up link group color
  linkGroupColors.delete(condition.groupId);

  renderBitfieldConditions();
}

function addConditionAtIndex(index) {
  const newCondition = {
    lineId: 0, // Temporary, will be set below
    groupId: 0, // Temporary, will be set below
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

  // Insert the new condition
  bitfieldConditions.splice(index + 1, 0, newCondition);

  // Recalculate all Line IDs and Group IDs
  recalculateLineAndGroupIds();

  renderBitfieldConditions();
}

function copyCondition(lineId) {
  const condition = bitfieldConditions.find((c) => c.lineId === lineId);
  if (!condition) return;

  // Get all lines in the group
  const groupLines = getGroupLines(condition.groupId);

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
  recalculateLineAndGroupIds();

  renderBitfieldConditions();
}

function clearBitfieldConditions() {
  bitfieldConditions = [];
  bitfieldExpansions = {};
  renderBitfieldConditions();
}

function updateBitfieldCondition(lineId, field, value) {
  const condition = bitfieldConditions.find((c) => c.lineId === lineId);
  if (condition) {
    // Validate and normalize inputs
    if (field === 'memory') {
      const isMemoryType = [
        'Mem',
        'Delta',
        'Prior',
        'Invert',
        'BCD',
        'Float',
      ].includes(condition.type);
      value = normalizeHexInput(value, isMemoryType);
    } else if (field === 'value') {
      const isMemoryType = [
        'Mem',
        'Delta',
        'Prior',
        'Invert',
        'BCD',
        'Float',
      ].includes(condition.compareType);
      value = normalizeHexInput(value, isMemoryType);
    }

    condition[field] = value;

    // If flag changed to operand flag (A:, B:, I:, K:), clear comparison
    if (field === 'flag' && ['A:', 'B:', 'I:', 'K:'].includes(value)) {
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
}

function canExpand(condition) {
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

function reopenExpansion(lineId) {
  const condition = bitfieldConditions.find((c) => c.lineId === lineId);
  if (condition) {
    // Reset ALL conditions in the group
    const groupLines = getGroupLines(condition.groupId);
    groupLines.forEach((groupCondition) => {
      groupCondition.expanded = false;
      groupCondition.expandedLines = [];
    });
  }
  delete bitfieldExpansions[lineId];
  renderBitfieldConditions();
}
// ============================================================================
// PART 2: Rendering and New Expansion System with Generated Groups
// ============================================================================

function renderBitfieldConditions() {
  const container = document.getElementById('bitfieldConditionsList');
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

          const isLeader = isGroupLeader(groupCondition);

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
                ? `<div class="expansion-badge" onclick="reopenExpansion(${groupCondition.lineId})">And ${groupCondition.expandedLines.length} added ${groupCondition.expandedLines.length === 1 ? 'line' : 'lines'}</div>`
                : `<button type="button" class="expand-btn" onclick="console.log('Expand clicked for line:', ${groupCondition.lineId}); expandCondition(${groupCondition.lineId})" ${!canExpand(groupCondition) ? 'disabled' : ''}>Expand</button>`
            }
            <button class="link-btn" onclick="linkCondition(${groupCondition.lineId})" ${!canLinkCondition(groupCondition.lineId) ? 'disabled' : ''}>🔗 Link</button>
            <button class="add-line-btn" onclick="addConditionAtIndex(${conditionIndex})">➕ Add</button>
            <button class="copy-condition-btn" onclick="copyCondition(${groupCondition.lineId})">📋 Copy</button>
            <button class="remove-btn" onclick="removeBitfieldCondition(${groupCondition.lineId})">×</button>
          `;
          } else {
            // Non-leader - only show Unlink button
            copyRow.innerHTML = `
            <button class="link-btn" onclick="unlinkCondition(${groupCondition.lineId})">🔗 Unlink</button>
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
            ? `<div class="expansion-badge" onclick="reopenExpansion(${condition.lineId})">And ${condition.expandedLines.length} added ${condition.expandedLines.length === 1 ? 'line' : 'lines'}</div>`
            : `<button type="button" class="expand-btn" onclick="console.log('Expand clicked for line:', ${condition.lineId}); expandCondition(${condition.lineId})" ${!canExpand(condition) ? 'disabled' : ''}>Expand</button>`
        }
        <button class="link-btn" onclick="linkCondition(${condition.lineId})" ${!canLinkCondition(condition.lineId) ? 'disabled' : ''}>🔗 Link</button>
        <button class="add-line-btn" onclick="addConditionAtIndex(${index})">➕ Add</button>
        <button class="copy-condition-btn" onclick="copyCondition(${condition.lineId})">📋 Copy</button>
        <button class="remove-btn" onclick="removeBitfieldCondition(${condition.lineId})">×</button>
      `;
      container.appendChild(copyRow);

      // Handle expansion for individual condition
      if (bitfieldExpansions[condition.lineId]) {
        console.log('Rendering expansion for line:', condition.lineId); // DEBUG
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
          ); // DEBUG
        }

        container.appendChild(expansionDiv);
        console.log(
          'Expansion div added to container for line:',
          condition.lineId,
        ); // DEBUG
      }
    }
  });
}

function getTypeOptions(flag, currentType) {
  if (flag === 'I:') {
    // Add Address flag - only allow Mem, Prior, Value, and Recall
    const allowedTypes = ['Mem', 'Prior', 'Value', 'Recall'];
    let options = '';
    allowedTypes.forEach((type) => {
      options += `<option value="${type}" ${currentType === type ? 'selected' : ''}>${type}</option>`;
    });
    return options;
  } else {
    // All other flags - allow all types
    let options = '';
    const allTypes = [
      'Mem',
      'Value',
      'Delta',
      'Prior',
      'BCD',
      'Float',
      'Invert',
      'Recall',
    ];
    allTypes.forEach((type) => {
      options += `<option value="${type}" ${currentType === type ? 'selected' : ''}>${type}</option>`;
    });
    return options;
  }
}

function validateTypeChange(lineId, newType) {
  const condition = bitfieldConditions.find((c) => c.lineId === lineId);
  if (!condition) return;

  if (condition.flag === 'I:') {
    // Add Address flag validation
    if (!['Mem', 'Prior', 'Value', 'Recall'].includes(newType)) {
      // Revert to Mem and show red flash
      updateBitfieldCondition(lineId, 'type', 'Mem');
      flashTypeDropdown(lineId);
      return;
    }
  }

  updateBitfieldCondition(lineId, 'type', newType);
}

function flashTypeDropdown(lineId) {
  const selectElement = document.getElementById(`type-select-${lineId}`);
  if (!selectElement) return;

  // Add CSS animation class
  selectElement.classList.add('type-validation-flash');

  // Remove class after animation completes
  setTimeout(() => {
    selectElement.classList.remove('type-validation-flash');
  }, 1000);
}

function createConditionRowHTML(condition) {
  const isOperandFlag = ['A:', 'B:', 'I:', 'K:'].includes(condition.flag);
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

  const leftNeedsSize = [
    'Mem',
    'Delta',
    'Prior',
    'Invert',
    'BCD',
    'Float',
  ].includes(condition.type);
  const leftNeedsInput = condition.type !== 'Recall';
  const rightNeedsSize = [
    'Mem',
    'Delta',
    'Prior',
    'Invert',
    'BCD',
    'Float',
  ].includes(condition.compareType);
  const rightNeedsInput = condition.compareType !== 'Recall';

  return `
    <div>
      <select onchange="updateBitfieldCondition(${condition.lineId}, 'flag', this.value); renderBitfieldConditions();">
        <option value="" ${condition.flag === '' ? 'selected' : ''}></option>
        <option value="P:" ${condition.flag === 'P:' ? 'selected' : ''}>Pause If</option>
        <option value="R:" ${condition.flag === 'R:' ? 'selected' : ''}>Reset If</option>
        <option value="Z:" ${condition.flag === 'Z:' ? 'selected' : ''}>Reset Next If</option>
        <option value="A:" ${condition.flag === 'A:' ? 'selected' : ''}>Add Source</option>
        <option value="B:" ${condition.flag === 'B:' ? 'selected' : ''}>Sub Source</option>
        <option value="C:" ${condition.flag === 'C:' ? 'selected' : ''}>Add Hits</option>
        <option value="D:" ${condition.flag === 'D:' ? 'selected' : ''}>Sub Hits</option>
        <option value="I:" ${condition.flag === 'I:' ? 'selected' : ''}>Add Address</option>
        <option value="N:" ${condition.flag === 'N:' ? 'selected' : ''}>And Next</option>
        <option value="O:" ${condition.flag === 'O:' ? 'selected' : ''}>Or Next</option>
        <option value="M:" ${condition.flag === 'M:' ? 'selected' : ''}>Measured</option>
        <option value="G:" ${condition.flag === 'G:' ? 'selected' : ''}>Measured %</option>
        <option value="Q:" ${condition.flag === 'Q:' ? 'selected' : ''}>Measured If</option>
        <option value="T:" ${condition.flag === 'T:' ? 'selected' : ''}>Trigger</option>
        <option value="K:" ${condition.flag === 'K:' ? 'selected' : ''}>Remember</option>
      </select>
    </div>
    
    <div>
      <select id="type-select-${condition.lineId}" onchange="validateTypeChange(${condition.lineId}, this.value); renderBitfieldConditions();">
        ${getTypeOptions(condition.flag, condition.type)}
      </select>
    </div>
    
    <div class="${!leftNeedsSize ? 'hidden' : ''}">
      <select onchange="updateBitfieldCondition(${condition.lineId}, 'size', this.value)" ${!leftNeedsSize ? 'disabled' : ''}>
        ${leftSizeOptions || '<option>-</option>'}
      </select>
    </div>
    
    <div class="${!leftNeedsInput ? 'hidden' : ''}">
      <input type="text" value="${condition.memory}" 
        onchange="updateBitfieldCondition(${condition.lineId}, 'memory', this.value); recomputeExpandState(${condition.lineId}); renderBitfieldConditions();" 
        oninput="updateBitfieldCondition(${condition.lineId}, 'memory', this.value); recomputeExpandState(${condition.lineId});" 
        ${!leftNeedsInput ? 'disabled' : ''}>
    </div>
    
    <div>
      <select onchange="updateBitfieldCondition(${condition.lineId}, 'cmp', this.value); renderBitfieldConditions();">
        ${cmpOptions}
      </select>
    </div>
    
    <div class="${isOperandFlag && !hasOperand ? 'hidden' : ''}">
      <select onchange="updateBitfieldCondition(${condition.lineId}, 'compareType', this.value); renderBitfieldConditions();" ${isOperandFlag && !hasOperand ? 'disabled' : ''}>
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
      <select onchange="updateBitfieldCondition(${condition.lineId}, 'compareSize', this.value)" ${(isOperandFlag && !hasOperand) || !rightNeedsSize ? 'disabled' : ''}>
        ${rightSizeOptions || '<option>-</option>'}
      </select>
    </div>
    
    <div class="${(isOperandFlag && !hasOperand) || !rightNeedsInput ? 'hidden' : ''}">
      <input type="text" value="${condition.value}" 
        onchange="updateBitfieldCondition(${condition.lineId}, 'value', this.value); renderBitfieldConditions();" 
        ${(isOperandFlag && !hasOperand) || !rightNeedsInput ? 'disabled' : ''}>
    </div>
    
    <div class="${isOperandFlag ? 'hidden' : ''}">
      <input type="number" min="0" value="${condition.hits}" onchange="updateBitfieldCondition(${condition.lineId}, 'hits', this.value)" ${isOperandFlag ? 'disabled' : ''}>
    </div>
  `;
}

function formatConditionDisplay(condition) {
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

// NEW EXPANSION SYSTEM WITH GENERATED GROUPS
function expandCondition(lineId) {
  const condition = bitfieldConditions.find((c) => c.lineId === lineId);
  if (!condition || !canExpand(condition)) {
    console.log('Cannot expand:', lineId, condition); // DEBUG
    return;
  }

  // Close any existing expansions first
  Object.keys(bitfieldExpansions).forEach((id) => {
    if (id != lineId) {
      delete bitfieldExpansions[id];
    }
  });

  const groupLines = getGroupLines(condition.groupId);

  if (!bitfieldExpansions[lineId]) {
    bitfieldExpansions[lineId] = {
      generatedGroups: '1',
      deltaCheck: true, // Default to on
      lineConfigs: groupLines.map((line) => ({
        lineId: line.lineId,
        activeTab: 'left',
        arithmeticIncrement: '',
        customFieldSize: '',
        customized: false,
        customData: null,
      })),
    };
  }

  const expansion = bitfieldExpansions[lineId];

  let html = '<div class="expansion-interface">';
  html += `<div class="expansion-header">Expanding Group: ${groupLines.length} line${groupLines.length > 1 ? 's' : ''}</div>`;

  // Generated Groups input
  html += '<div class="expansion-row">';
  html += '<span class="expansion-row-label">Generated Groups:</span>';
  html += `<input type="number" min="1" value="${expansion.generatedGroups}" 
    onchange="updateExpansionField(${lineId}, 'generatedGroups', this.value); expandCondition(${lineId});" 
    style="width: 100px;">`;
  html += '</div>';

  html += '<div class="expansion-divider"></div>';

  // Individual line configurations
  groupLines.forEach((line, idx) => {
    const lineConfig = expansion.lineConfigs[idx];

    html += '<div class="expansion-line-config">';
    html += `<div class="expansion-line-header">Line ${line.lineId}: ${formatConditionDisplay(line)}</div>`;

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
      onclick="updateLineConfig(${lineId}, ${idx}, 'activeTab', 'left'); expandCondition(${lineId});" 
      ${!leftExpandable || lineConfig.customized ? 'disabled' : ''}>Left</button>`;
    html += `<button class="tab-btn ${lineConfig.activeTab === 'right' ? 'active' : ''}" 
      onclick="updateLineConfig(${lineId}, ${idx}, 'activeTab', 'right'); expandCondition(${lineId});" 
      ${!rightExpandable || lineConfig.customized ? 'disabled' : ''}>Right</button>`;
    html += `<button class="tab-btn ${lineConfig.activeTab === 'both' ? 'active' : ''}" 
      onclick="updateLineConfig(${lineId}, ${idx}, 'activeTab', 'both'); expandCondition(${lineId});" 
      ${!bothExpandable || lineConfig.customized ? 'disabled' : ''}>Both</button>`;
    html += '</div>';

    // Input fields
    html += '<div class="expansion-row">';
    html += '<span class="expansion-row-label">Arithmetic Increment:</span>';
    html += `<input type="text" placeholder="Increment" value="${lineConfig.arithmeticIncrement || ''}" 
      onchange="updateLineConfig(${lineId}, ${idx}, 'arithmeticIncrement', this.value)" 
      ${lineConfig.customized ? 'disabled' : ''} style="width: 120px;">`;
    html +=
      '<span class="expansion-row-label" style="margin-left: 1rem;">Custom Field:</span>';
    html += `<input type="text" placeholder="Field Size" value="${lineConfig.customFieldSize || ''}" 
      onchange="updateLineConfig(${lineId}, ${idx}, 'customFieldSize', this.value)" 
      ${lineConfig.customized ? 'disabled' : ''} style="width: 100px;">`;

    if (lineConfig.customized) {
      html += `<button class="cancel-btn" onclick="cancelLineCustomization(${lineId}, ${idx})">Cancel</button>`;
    } else {
      html += `<button class="secondary-btn" onclick="openLineCustomization(${lineId}, ${idx})">Customize</button>`;
    }
    html += '</div>';

    if (lineConfig.customized && lineConfig.customData) {
      html += `<div class="customization-badge">✓ Custom expansion configured (${lineConfig.customData.selectedCount} addresses)</div>`;
    }

    html += '</div>'; // end expansion-line-config
  });

  // Delta/Mem Check option - CORRECTED LOGIC
  const isAddSubSource = groupLines.some(
    (l) => l.flag === 'A:' || l.flag === 'B:',
  );
  const isAndOrNext = groupLines.some(
    (l) => l.flag === 'N:' || l.flag === 'O:',
  );
  const isSingleLine = groupLines.length === 1;

  // Check if any line in the group has Delta or Mem types
  const hasDeltaOrMemType = groupLines.some(
    (l) =>
      ['Delta', 'Mem'].includes(l.type) ||
      ['Delta', 'Mem'].includes(l.compareType),
  );

  // Check if any line has MIXED Delta/Mem (Delta on one side, Mem on the other)
  const hasMixedDeltaMemOnSameLine = groupLines.some((line) => {
    const leftIsDelta = line.type === 'Delta';
    const leftIsMem = line.type === 'Mem';
    const rightIsDelta = line.compareType === 'Delta';
    const rightIsMem = line.compareType === 'Mem';

    // Mixed means: (Delta on left AND Mem on right) OR (Mem on left AND Delta on right)
    return (leftIsDelta && rightIsMem) || (leftIsMem && rightIsDelta);
  });

  // Delta/Mem Check enabled for Add/Sub Source chains (any length) - if has Delta/Mem and not mixed
  const deltaMemCheckEnabledForAddSub =
    isAddSubSource && hasDeltaOrMemType && !hasMixedDeltaMemOnSameLine;

  // And/Or Next functionality enabled ONLY for single lines with N:/O: flags and Delta/Mem (not mixed)
  const deltaMemCheckEnabledForAndOr =
    isSingleLine &&
    isAndOrNext &&
    hasDeltaOrMemType &&
    !hasMixedDeltaMemOnSameLine;

  // Additional check: Disable checkbox if BOTH tab is selected AND there's mixed Delta/Mem
  const bothTabSelected = groupLines.some((line, idx) => {
    const config = expansion.lineConfigs[idx];
    return config && config.activeTab === 'both';
  });

  const checkboxEnabled =
    (deltaMemCheckEnabledForAddSub || deltaMemCheckEnabledForAndOr) &&
    !(bothTabSelected && hasMixedDeltaMemOnSameLine);

  // Show checkbox for any Add/Sub Source or And/Or Next flag
  const shouldShowCheckbox = isAddSubSource || isAndOrNext;

  if (shouldShowCheckbox) {
    html += '<div class="expansion-row">';
    html += '<span class="expansion-row-label">Options:</span>';
    html += `<label style="display: flex; align-items: center; gap: 0.5rem;">
      <input type="checkbox" ${expansion.deltaCheck ? 'checked' : ''} 
        onchange="updateExpansionField(${lineId}, 'deltaCheck', this.checked)" 
        ${!checkboxEnabled ? 'disabled' : ''}>
      Delta/Mem Check
    </label>`;
    html += '</div>';
  }

  html += '<div class="expansion-footer">';
  html += `<button class="cancel-btn" onclick="cancelExpansion(${lineId})">Cancel</button>`;
  html += `<button class="confirm-btn" onclick="confirmExpansion(${lineId})">Confirm</button>`;
  html += '</div>';
  html += '</div>';

  console.log(
    'Expansion panel generated - shouldShowCheckbox:',
    shouldShowCheckbox,
    'checkboxEnabled:',
    checkboxEnabled,
  ); // DEBUG

  bitfieldExpansions[lineId].html = html;
  renderBitfieldConditions();
}

function updateExpansionField(lineId, field, value) {
  if (!bitfieldExpansions[lineId]) return;
  bitfieldExpansions[lineId][field] = value;
}

function updateLineConfig(expansionId, lineIndex, field, value) {
  if (!bitfieldExpansions[expansionId]) return;
  bitfieldExpansions[expansionId].lineConfigs[lineIndex][field] = value;
}

function cancelExpansion(lineId) {
  delete bitfieldExpansions[lineId];
  renderBitfieldConditions();
}

function cancelLineCustomization(expansionId, lineIndex) {
  if (!bitfieldExpansions[expansionId]) return;
  const lineConfig = bitfieldExpansions[expansionId].lineConfigs[lineIndex];
  lineConfig.customized = false;
  lineConfig.customData = null;
  // Don't clear arithmetic increment - user might want to switch back to it
  expandCondition(expansionId);
}

function updateLineConfig(expansionId, lineIndex, field, value) {
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

function openLineCustomization(expansionId, lineIndex) {
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
  html += `<div class="custom-warning" id="custom-warning-${expansionId}-${lineIndex}"></div>`;
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

  // Render rows (same as before but with validation)
  for (let rowIdx = 0; rowIdx < numRows; rowIdx++) {
    const rowBaseAddr = baseAddr + rowIdx * 0x10;

    if (isBitType) {
      if (line.size === 'BitCount') {
        html += '<div class="custom-expansion-bitcount-row">';
        html += `<span class="custom-expansion-addr">0x${rowBaseAddr.toString(16).toUpperCase()}</span>`;

        for (let byteOffset = 0; byteOffset < 0x10; byteOffset++) {
          const byteData = customData.customRows[rowBaseAddr][byteOffset];

          html += '<div class="custom-expansion-bitcount-column">';
          html += `<button class="bit-btn ${byteData.bitCount ? 'active' : ''}" 
            onclick="toggleCustomBitCountValidated(${expansionId}, ${lineIndex}, ${rowBaseAddr}, ${byteOffset})">BC</button>`;
          html += `<span class="custom-expansion-byte-label">0x${byteOffset.toString(16).toUpperCase()}</span>`;
          html += '</div>';
        }

        html += '</div>';
      } else {
        html += '<div class="custom-expansion-bit-row">';
        html += `<span class="custom-expansion-addr">0x${rowBaseAddr.toString(16).toUpperCase()}</span>`;

        for (let byteOffset = 0; byteOffset < 0x10; byteOffset++) {
          const byteData = customData.customRows[rowBaseAddr][byteOffset];

          html += '<div class="custom-expansion-bit-column">';
          for (let bit = 0; bit < 8; bit++) {
            html += `<button class="bit-btn-small ${byteData.bits.includes(bit) ? 'active' : ''}" 
              onclick="toggleCustomBitValidated(${expansionId}, ${lineIndex}, ${rowBaseAddr}, ${byteOffset}, ${bit})">${bit}</button>`;
          }
          html += `<span class="custom-expansion-byte-label">0x${byteOffset.toString(16).toUpperCase()}</span>`;
          html += '</div>';
        }

        html += '</div>';
      }
    } else if (is4BitType) {
      html += '<div class="custom-expansion-4bit-row">';
      html += `<span class="custom-expansion-addr">0x${rowBaseAddr.toString(16).toUpperCase()}</span>`;
      html += '<div class="custom-expansion-4bit-grid">';

      html += '<div class="custom-expansion-4bit-all-row">';
      html += `<button class="bit-btn" onclick="toggleCustomAllUpperValidated(${expansionId}, ${lineIndex}, ${rowBaseAddr})">All U</button>`;
      for (let byteOffset = 0; byteOffset < 0x10; byteOffset++) {
        const byteData = customData.customRows[rowBaseAddr][byteOffset];
        html += `<button class="bit-btn-4bit ${byteData.upper ? 'active' : ''}" 
          onclick="toggleCustomUpperValidated(${expansionId}, ${lineIndex}, ${rowBaseAddr}, ${byteOffset})">U</button>`;
      }
      html += '</div>';

      html += '<div class="custom-expansion-4bit-label-row">';
      html += '<span></span>';
      for (let byteOffset = 0; byteOffset < 0x10; byteOffset++) {
        html += `<span class="custom-expansion-byte-label-inline">0x${byteOffset.toString(16).toUpperCase()}</span>`;
      }
      html += '</div>';

      html += '<div class="custom-expansion-4bit-all-row">';
      html += `<button class="bit-btn" onclick="toggleCustomAllLowerValidated(${expansionId}, ${lineIndex}, ${rowBaseAddr})">All L</button>`;
      for (let byteOffset = 0; byteOffset < 0x10; byteOffset++) {
        const byteData = customData.customRows[rowBaseAddr][byteOffset];
        html += `<button class="bit-btn-4bit ${byteData.lower ? 'active' : ''}" 
          onclick="toggleCustomLowerValidated(${expansionId}, ${lineIndex}, ${rowBaseAddr}, ${byteOffset})">L</button>`;
      }
      html += '</div>';

      html += '</div>';
      html += '</div>';
    } else {
      html += '<div class="custom-expansion-standard-row">';
      html += `<span class="custom-expansion-addr">0x${rowBaseAddr.toString(16).toUpperCase()}</span>`;
      html += `<button class="bit-btn" onclick="toggleCustomAllStandardValidated(${expansionId}, ${lineIndex}, ${rowBaseAddr}, ${stride}, ${buttonsPerRow})">All</button>`;

      for (let i = 0; i < buttonsPerRow; i++) {
        const offset = i * stride;
        const btnData = customData.customRows[rowBaseAddr][offset];

        if (btnData) {
          html += `<button class="bit-btn ${btnData.active ? 'active' : ''}" 
            onclick="toggleCustomStandardValidated(${expansionId}, ${lineIndex}, ${rowBaseAddr}, ${offset})">0x${offset.toString(16).toUpperCase()}</button>`;
        }
      }

      html += '</div>';
    }
  }

  html += '</div>'; // end expansion-scroll

  html += '<div class="expansion-footer">';
  html += `<button class="cancel-btn" onclick="cancelCustomPanel(${expansionId}, ${lineIndex})">Cancel</button>`;
  html += `<button class="confirm-btn" onclick="confirmCustomPanel(${expansionId}, ${lineIndex})">Confirm</button>`;
  html += '</div>';
  html += '</div>';

  bitfieldExpansions[expansionId].customHtml = html;
  bitfieldExpansions[expansionId].showingCustom = true;
  bitfieldExpansions[expansionId].customLineIndex = lineIndex;
  renderBitfieldConditions();
}

function showCustomWarning(expansionId, lineIndex, message) {
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

function updateCustomCount(expansionId, lineIndex) {
  const countEl = document.getElementById(
    `custom-count-${expansionId}-${lineIndex}`,
  );
  if (countEl && bitfieldExpansions[expansionId]) {
    const customData =
      bitfieldExpansions[expansionId].lineConfigs[lineIndex].customData;
    countEl.textContent = customData.selectedCount;
  }
}

function recountCustomSelections(expansionId, lineIndex) {
  const expansion = bitfieldExpansions[expansionId];
  if (!expansion) return;

  const customData = expansion.lineConfigs[lineIndex].customData;
  if (!customData) return;

  const condition = bitfieldConditions.find((c) => c.lineId === expansionId);
  const groupLines = getGroupLines(condition.groupId);
  const line = groupLines[lineIndex];

  let count = 0;

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
  updateCustomCount(expansionId, lineIndex);
}

// Validated toggle functions
function toggleCustomBitCountValidated(
  expansionId,
  lineIndex,
  rowBaseAddr,
  byteOffset,
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

  recountCustomSelections(expansionId, lineIndex);
  openLineCustomization(expansionId, lineIndex);
}

function toggleCustomBitValidated(
  expansionId,
  lineIndex,
  rowBaseAddr,
  byteOffset,
  bit,
) {
  const expansion = bitfieldExpansions[expansionId];
  if (!expansion) return;

  const customData = expansion.lineConfigs[lineIndex].customData;
  const byteData = customData.customRows[rowBaseAddr][byteOffset];

  const bitIdx = byteData.bits.indexOf(bit);
  const wouldAdd = bitIdx > -1 ? -1 : 1;

  // Special case: if we have BitCount and we're removing a bit, this would break it
  if (byteData.bitCount && bitIdx > -1) {
    // Breaking BitCount - would add 7 individual bits
    if (customData.selectedCount + 7 > customData.maxSelections) {
      showCustomWarning(
        expansionId,
        lineIndex,
        'Line count would be exceeded.',
      );
      return;
    }
  } else if (customData.selectedCount + wouldAdd > customData.maxSelections) {
    showCustomWarning(expansionId, lineIndex, 'Line count would be exceeded.');
    return;
  }

  if (bitIdx > -1) {
    byteData.bits.splice(bitIdx, 1);
  } else {
    byteData.bits.push(bit);
    byteData.bits.sort((a, b) => a - b);
  }

  byteData.bitCount = byteData.bits.length === 8;

  recountCustomSelections(expansionId, lineIndex);
  openLineCustomization(expansionId, lineIndex);
}

function toggleCustomUpperValidated(
  expansionId,
  lineIndex,
  rowBaseAddr,
  byteOffset,
) {
  const expansion = bitfieldExpansions[expansionId];
  if (!expansion) return;

  const customData = expansion.lineConfigs[lineIndex].customData;
  const byteData = customData.customRows[rowBaseAddr][byteOffset];

  const wouldAdd = byteData.upper ? -1 : 1;

  if (customData.selectedCount + wouldAdd > customData.maxSelections) {
    showCustomWarning(expansionId, lineIndex, 'Line count would be exceeded.');
    return;
  }

  byteData.upper = !byteData.upper;
  recountCustomSelections(expansionId, lineIndex);
  openLineCustomization(expansionId, lineIndex);
}

function toggleCustomLowerValidated(
  expansionId,
  lineIndex,
  rowBaseAddr,
  byteOffset,
) {
  const expansion = bitfieldExpansions[expansionId];
  if (!expansion) return;

  const customData = expansion.lineConfigs[lineIndex].customData;
  const byteData = customData.customRows[rowBaseAddr][byteOffset];

  const wouldAdd = byteData.lower ? -1 : 1;

  if (customData.selectedCount + wouldAdd > customData.maxSelections) {
    showCustomWarning(expansionId, lineIndex, 'Line count would be exceeded.');
    return;
  }

  byteData.lower = !byteData.lower;
  recountCustomSelections(expansionId, lineIndex);
  openLineCustomization(expansionId, lineIndex);
}

function toggleCustomAllUpperValidated(expansionId, lineIndex, rowBaseAddr) {
  const expansion = bitfieldExpansions[expansionId];
  if (!expansion) return;

  const customData = expansion.lineConfigs[lineIndex].customData;
  const rowData = customData.customRows[rowBaseAddr];

  let allOn = true;
  for (let byteOffset = 0; byteOffset < 0x10; byteOffset++) {
    if (!rowData[byteOffset].upper) {
      allOn = false;
      break;
    }
  }

  const delta = allOn ? -16 : 16;

  if (customData.selectedCount + delta > customData.maxSelections) {
    showCustomWarning(expansionId, lineIndex, 'Line count would be exceeded.');
    return;
  }

  for (let byteOffset = 0; byteOffset < 0x10; byteOffset++) {
    rowData[byteOffset].upper = !allOn;
  }

  recountCustomSelections(expansionId, lineIndex);
  openLineCustomization(expansionId, lineIndex);
}

function toggleCustomAllLowerValidated(expansionId, lineIndex, rowBaseAddr) {
  const expansion = bitfieldExpansions[expansionId];
  if (!expansion) return;

  const customData = expansion.lineConfigs[lineIndex].customData;
  const rowData = customData.customRows[rowBaseAddr];

  let allOn = true;
  for (let byteOffset = 0; byteOffset < 0x10; byteOffset++) {
    if (!rowData[byteOffset].lower) {
      allOn = false;
      break;
    }
  }

  const delta = allOn ? -16 : 16;

  if (customData.selectedCount + delta > customData.maxSelections) {
    showCustomWarning(expansionId, lineIndex, 'Line count would be exceeded.');
    return;
  }

  for (let byteOffset = 0; byteOffset < 0x10; byteOffset++) {
    rowData[byteOffset].lower = !allOn;
  }

  recountCustomSelections(expansionId, lineIndex);
  openLineCustomization(expansionId, lineIndex);
}

function toggleCustomStandardValidated(
  expansionId,
  lineIndex,
  rowBaseAddr,
  offset,
) {
  const expansion = bitfieldExpansions[expansionId];
  if (!expansion) return;

  const customData = expansion.lineConfigs[lineIndex].customData;
  const btnData = customData.customRows[rowBaseAddr][offset];

  const wouldAdd = btnData.active ? -1 : 1;

  if (customData.selectedCount + wouldAdd > customData.maxSelections) {
    showCustomWarning(expansionId, lineIndex, 'Line count would be exceeded.');
    return;
  }

  btnData.active = !btnData.active;
  recountCustomSelections(expansionId, lineIndex);
  openLineCustomization(expansionId, lineIndex);
}

function toggleCustomAllStandardValidated(
  expansionId,
  lineIndex,
  rowBaseAddr,
  stride,
  buttonsPerRow,
) {
  const expansion = bitfieldExpansions[expansionId];
  if (!expansion) return;

  const customData = expansion.lineConfigs[lineIndex].customData;
  const rowData = customData.customRows[rowBaseAddr];

  let allOn = true;
  for (let i = 0; i < buttonsPerRow; i++) {
    const offset = i * stride;
    if (!rowData[offset] || !rowData[offset].active) {
      allOn = false;
      break;
    }
  }

  const delta = allOn ? -buttonsPerRow : buttonsPerRow;

  if (customData.selectedCount + delta > customData.maxSelections) {
    showCustomWarning(expansionId, lineIndex, 'Line count would be exceeded.');
    return;
  }

  for (let i = 0; i < buttonsPerRow; i++) {
    const offset = i * stride;
    if (rowData[offset]) {
      rowData[offset].active = !allOn;
    }
  }

  recountCustomSelections(expansionId, lineIndex);
  openLineCustomization(expansionId, lineIndex);
}

function cancelCustomPanel(expansionId, lineIndex) {
  if (bitfieldExpansions[expansionId]) {
    bitfieldExpansions[expansionId].showingCustom = false;
    delete bitfieldExpansions[expansionId].customHtml;
    delete bitfieldExpansions[expansionId].customLineIndex;
  }
  expandCondition(expansionId);
}

function confirmCustomPanel(expansionId, lineIndex) {
  const expansion = bitfieldExpansions[expansionId];
  if (!expansion) return;

  const customData = expansion.lineConfigs[lineIndex].customData;

  if (customData.selectedCount !== customData.maxSelections) {
    showCustomWarning(expansionId, lineIndex, 'Line count is not met.');
    return;
  }

  // Mark as customized
  expansion.lineConfigs[lineIndex].customized = true;
  expansion.showingCustom = false;
  delete expansion.customHtml;
  delete expansion.customLineIndex;

  expandCondition(expansionId);
}

function confirmExpansion(expansionId) {
  const expansion = bitfieldExpansions[expansionId];
  if (!expansion) {
    console.log('No expansion found for:', expansionId); // DEBUG
    return;
  }

  const condition = bitfieldConditions.find((c) => c.lineId === expansionId);
  if (!condition) {
    console.log('No condition found for:', expansionId); // DEBUG
    return;
  }

  const groupLines = getGroupLines(condition.groupId);
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
        allExpandedLines = applyDeltaMemCheck(groupLines[0], allExpandedLines);
      } else if (isAndOrNextGroup) {
        allExpandedLines = applyAndOrNextCheck(groupLines[0], allExpandedLines);
      }
    }
  }

  console.log('Setting expanded lines:', allExpandedLines); // DEBUG

  // Mark ALL conditions in the group as expanded with the same expanded lines
  groupLines.forEach((groupCondition) => {
    groupCondition.expanded = true;
    groupCondition.expandedLines = allExpandedLines;
  });

  // Clean up expansion data
  delete bitfieldExpansions[expansionId];

  renderBitfieldConditions();
}

function generateArithmeticLine(line, lineConfig, groupIdx) {
  let increment = 0;

  if (lineConfig.arithmeticIncrement) {
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
  }

  const useLeftExpansion =
    lineConfig.activeTab === 'left' || lineConfig.activeTab === 'both';
  const useRightExpansion =
    lineConfig.activeTab === 'right' || lineConfig.activeTab === 'both';

  let leftValue, rightValue;

  if (useLeftExpansion) {
    if (line.type === 'Value') {
      leftValue = (parseInt(line.memory, 10) || 0) + groupIdx * increment;
    } else if (
      ['Mem', 'Delta', 'Prior', 'Invert', 'BCD', 'Float'].includes(line.type)
    ) {
      const startAddr = parseInt(line.memory.replace('0x', ''), 16) || 0;
      leftValue = `0x${(startAddr + groupIdx * increment).toString(16).toUpperCase()}`;
    } else {
      leftValue = line.memory;
    }
  } else {
    leftValue = line.memory;
  }

  if (useRightExpansion) {
    if (line.compareType === 'Value') {
      rightValue = (parseInt(line.value, 10) || 0) + groupIdx * increment;
    } else if (
      ['Mem', 'Delta', 'Prior', 'Invert', 'BCD', 'Float'].includes(
        line.compareType,
      )
    ) {
      const startAddr = parseInt(line.value.replace('0x', ''), 16) || 0;
      rightValue = `0x${(startAddr + groupIdx * increment).toString(16).toUpperCase()}`;
    } else {
      rightValue = line.value;
    }
  } else {
    rightValue = line.value;
  }

  return createArithmeticExpansionLine(line, leftValue, rightValue, 0);
}

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

  const useLeftExpansion =
    expansion.activeTab === 'left' || expansion.activeTab === 'both';
  const leftAddr = useLeftExpansion
    ? address
    : parseInt(condition.memory.replace('0x', ''), 16);
  line += `0x${sizeMap[condition.size] || ''}${leftAddr.toString(16).toUpperCase()}`;

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

      const useRightExpansion =
        expansion.activeTab === 'right' || expansion.activeTab === 'both';
      const rightAddr = useRightExpansion
        ? address
        : parseInt(condition.value.replace('0x', ''), 16);
      line +=
        rightPrefix +
        `0x${sizeMap[condition.compareSize] || ''}${rightAddr.toString(16).toUpperCase()}`;
    }

    if (
      !isOperandFlag &&
      condition.hits &&
      condition.hits !== '' &&
      condition.hits !== '0'
    ) {
      line += `.${condition.hits}.`;
    }
  }

  return line;
}

function createArithmeticExpansionLine(
  condition,
  leftValue,
  rightValue,
  index,
) {
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

  if (condition.type === 'Value') {
    line += leftValue;
  } else if (
    ['Mem', 'Delta', 'Prior', 'Invert', 'BCD', 'Float'].includes(condition.type)
  ) {
    if (typeof leftValue === 'string' && leftValue.startsWith('0x')) {
      line += leftValue.replace('0x', '0x' + (sizeMap[condition.size] || ''));
    } else {
      line += leftValue;
    }
  }

  const isOperandFlag = ['A:', 'B:', 'I:', 'K:'].includes(condition.flag);
  if (
    !isOperandFlag ||
    (isOperandFlag && condition.cmp && condition.cmp !== '')
  ) {
    line += condition.cmp || '=';

    if (condition.compareType === 'Recall') {
      line += '{recall}';
    } else if (condition.compareType === 'Value') {
      line += rightValue;
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

      if (typeof rightValue === 'string' && rightValue.startsWith('0x')) {
        line +=
          rightPrefix +
          rightValue.replace(
            '0x',
            '0x' + (sizeMap[condition.compareSize] || ''),
          );
      } else {
        line += rightPrefix + rightValue;
      }
    }

    if (
      !isOperandFlag &&
      condition.hits &&
      condition.hits !== '' &&
      condition.hits !== '0'
    ) {
      line += `.${condition.hits}.`;
    }
  }

  return line;
}

// MISSING HELPER FUNCTIONS
function convertBitfieldConditionToText(condition) {
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

    if (
      typeof condition.memory === 'string' &&
      condition.memory.startsWith('0x')
    ) {
      text += condition.memory.replace(
        '0x',
        '0x' + (sizeMap[condition.size] || ''),
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

      if (
        typeof condition.value === 'string' &&
        condition.value.startsWith('0x')
      ) {
        text += condition.value.replace(
          '0x',
          '0x' + (sizeMap[condition.compareSize] || ''),
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

function applyDeltaMemCheck(condition, expandedLines) {
  const leftIsDeltaOrMem = ['Delta', 'Mem'].includes(condition.type);
  const rightIsDeltaOrMem = ['Delta', 'Mem'].includes(condition.compareType);

  if (!leftIsDeltaOrMem && !rightIsDeltaOrMem) {
    return expandedLines;
  }

  const deltaLines = [];
  const memLines = [];

  expandedLines.forEach((line) => {
    // NEVER convert Add Address (I:) to Delta
    if (line.startsWith('I:')) {
      deltaLines.push(line);
      memLines.push(line);
      return;
    }

    const deltaLine = line.replace(/\b0x/g, 'd0x');

    const memLine = line.replace(/\bd0x/g, '0x');

    deltaLines.push(deltaLine);
    memLines.push(memLine);
  });

  // Inject 0=0 after ALL Delta lines and after ALL Mem lines
  const accumulatorLine = '0=0';

  return [...deltaLines, accumulatorLine, ...memLines, accumulatorLine];
}

function applyAndOrNextCheck(condition, expandedLines) {
  const leftIsDeltaOrMem = ['Delta', 'Mem'].includes(condition.type);
  const rightIsDeltaOrMem = ['Delta', 'Mem'].includes(condition.compareType);

  if (!leftIsDeltaOrMem && !rightIsDeltaOrMem) {
    return expandedLines;
  }

  const andNextLines = [];
  const orNextLines = [];

  expandedLines.forEach((line, index) => {
    // Skip the last line for flag removal
    const isLastLine = index === expandedLines.length - 1;

    // Create And Next version (convert Or Next to And Next)
    let andNextLine = line;
    if (!isLastLine) {
      // Convert flag: O: → N:
      andNextLine = andNextLine.replace(/^O:/, 'N:');

      // Convert types: Mem ↔ Delta
      andNextLine = andNextLine
        .replace(/\b0xH/g, 'd0xH')
        .replace(/\b0x(?![d])/g, 'd0x');
      andNextLine = andNextLine
        .replace(/\bd0xH/g, '0xH')
        .replace(/\bd0x(?![H])/g, '0x');

      // Convert comparisons
      andNextLine = andNextLine.replace(/=/g, '!=');
      andNextLine = andNextLine.replace(/!=/g, '=');
      andNextLine = andNextLine.replace(/>/g, '<=');
      andNextLine = andNextLine.replace(/<=/g, '>');
      andNextLine = andNextLine.replace(/</g, '>=');
      andNextLine = andNextLine.replace(/>=/g, '<');
    }

    // Create Or Next version (convert And Next to Or Next)
    let orNextLine = line;
    if (!isLastLine) {
      // Convert flag: N: → O:
      orNextLine = orNextLine.replace(/^N:/, 'O:');

      // Convert types: Mem ↔ Delta
      orNextLine = orNextLine
        .replace(/\b0xH/g, 'd0xH')
        .replace(/\b0x(?![d])/g, 'd0x');
      orNextLine = orNextLine
        .replace(/\bd0xH/g, '0xH')
        .replace(/\bd0x(?![H])/g, '0x');

      // Convert comparisons
      orNextLine = orNextLine.replace(/=/g, '!=');
      orNextLine = orNextLine.replace(/!=/g, '=');
      orNextLine = orNextLine.replace(/>/g, '<=');
      orNextLine = orNextLine.replace(/<=/g, '>');
      orNextLine = orNextLine.replace(/</g, '>=');
      orNextLine = orNextLine.replace(/>=/g, '<');
    }

    andNextLines.push(andNextLine);
    orNextLines.push(orNextLine);
  });

  return [...andNextLines, ...orNextLines];
}

function autoLinkAddressFlags() {
  // Find all Add Address flags and link them from top to bottom
  const addAddressLines = bitfieldConditions
    .map((c, idx) => ({ condition: c, index: idx }))
    .filter(({ condition }) => condition.flag === 'I:');

  addAddressLines.forEach(({ condition, index }) => {
    // Only link if this line is a group leader and can link
    if (isGroupLeader(condition) && canLinkCondition(condition.lineId)) {
      linkCondition(condition.lineId);
    }
  });
}

function copyToClipboard(text) {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      // Optional: Show a success message
      console.log('Copied to clipboard');
    })
    .catch((err) => {
      console.error('Failed to copy: ', err);
    });
}

function generateBitfieldLogic() {
  const compressEnabled = document.getElementById('compressEnabled').checked;

  // Collect all conditions including expanded ones
  let allLines = [];

  bitfieldConditions.forEach((condition) => {
    if (condition.expanded && condition.expandedLines.length > 0) {
      allLines.push(...condition.expandedLines);
    } else {
      allLines.push(convertBitfieldConditionToText(condition));
    }
  });

  // Generate the final logic string
  let logicString = allLines.join('_');

  if (compressEnabled) {
    // Apply compression logic here if needed
    // For now, just return the uncompressed version
  }

  // Update the base logic textarea
  document.getElementById('baseLogic').value = logicString;

  // Re-parse and auto-link
  syncBitfieldFromText();

  // Copy to clipboard
  copyToClipboard(logicString);
}
