// ============================================================================
// GROUP MANAGEMENT AND LINKING SYSTEM
// ============================================================================

import { MEMORY_TYPES } from './core-constants.js';
import { canExpand } from './validation.js';

/**
 * Gets all lines in a specific group
 * @param {Array} bitfieldConditions - Array of all conditions
 * @param {number} groupId - The group ID to filter by
 * @returns {Array} Array of conditions in the group
 */
export function getGroupLines(bitfieldConditions, groupId) {
  return bitfieldConditions.filter((c) => c.groupId === groupId);
}

/**
 * Gets the group leader (line with highest lineId in the group)
 * @param {Array} bitfieldConditions - Array of all conditions
 * @param {number} groupId - The group ID
 * @returns {Object|null} Group leader condition or null
 */
export function getGroupLeader(bitfieldConditions, groupId) {
  const groupLines = getGroupLines(bitfieldConditions, groupId);
  if (groupLines.length === 0) return null;
  // Leader is the line with the highest lineId in the group
  return groupLines.reduce((max, line) =>
    line.lineId > max.lineId ? line : max,
  );
}

/**
 * Checks if a condition is the group leader
 * @param {Array} bitfieldConditions - Array of all conditions
 * @param {Object} condition - The condition to check
 * @returns {boolean} Whether the condition is the group leader
 */
export function isGroupLeader(bitfieldConditions, condition) {
  const leader = getGroupLeader(bitfieldConditions, condition.groupId);
  return leader && leader.lineId === condition.lineId;
}

/**
 * Recalculates line and group IDs after changes
 * @param {Array} bitfieldConditions - Array of all conditions (modified in place)
 */
export function recalculateLineAndGroupIds(bitfieldConditions) {
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

/**
 * Links a condition with the condition(s) below it
 * @param {Array} bitfieldConditions - Array of all conditions (modified in place)
 * @param {Map} linkGroupColors - Map of group colors (modified in place)
 * @param {number} lineId - The line ID to link
 */
export function linkCondition(bitfieldConditions, linkGroupColors, lineId) {
  const condition = bitfieldConditions.find((c) => c.lineId === lineId);
  if (!condition) return;

  // Only group leaders can link with other groups
  if (!isGroupLeader(bitfieldConditions, condition)) {
    return;
  }

  // Check if already in a multi-line group, if so, add the next line
  const currentGroupLines = getGroupLines(bitfieldConditions, condition.groupId);
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
    const belowGroupLines = getGroupLines(bitfieldConditions, belowCondition.groupId);

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
    const belowGroupLines = getGroupLines(bitfieldConditions, belowCondition.groupId);

    // Add all lines from below group to current line's group
    belowGroupLines.forEach((line) => {
      line.groupId = condition.groupId;
    });
  }

  // Assign color if not already assigned
  if (!linkGroupColors.has(condition.groupId)) {
    linkGroupColors.set(condition.groupId, linkGroupColors.size % 2);
  }
}

/**
 * Unlinks a condition from its group
 * @param {Array} bitfieldConditions - Array of all conditions (modified in place)
 * @param {number} lineId - The line ID to unlink
 */
export function unlinkCondition(bitfieldConditions, lineId) {
  const condition = bitfieldConditions.find((c) => c.lineId === lineId);
  if (!condition) return;

  const groupLines = getGroupLines(bitfieldConditions, condition.groupId);
  const conditionIndex = groupLines.findIndex((c) => c.lineId === lineId);

  // Split: keep lines 0 to conditionIndex in current group
  // Lines after conditionIndex return to their original groups (lineId)
  groupLines.forEach((line, idx) => {
    if (idx > conditionIndex) {
      line.groupId = line.lineId; // Return to original group
    }
  });
}

/**
 * Checks if a condition can be linked with the condition below
 * @param {Array} bitfieldConditions - Array of all conditions
 * @param {number} lineId - The line ID to check
 * @returns {boolean} Whether the condition can be linked
 */
export function canLinkCondition(bitfieldConditions, lineId) {
  const condition = bitfieldConditions.find((c) => c.lineId === lineId);
  if (!condition) return false;

  // Only group leaders can link with other groups
  if (!isGroupLeader(bitfieldConditions, condition)) {
    return false;
  }

  const groupLines = getGroupLines(bitfieldConditions, condition.groupId);

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
  const belowGroupLines = getGroupLines(bitfieldConditions, belowCondition.groupId);
  if (belowGroupLines.some((c) => c.expanded && c.expandedLines.length > 0)) {
    return false;
  }

  return true;
}

/**
 * Auto-links Add Address, Add Source, Sub Source, And Next, and Or Next flags from top to bottom
 * @param {Array} bitfieldConditions - Array of all conditions (modified in place)
 * @param {Map} linkGroupColors - Map of group colors (modified in place)
 */
export function autoLinkAddressFlags(bitfieldConditions, linkGroupColors) {
  // Find all linkable flags and link them from top to bottom
  const linkableLines = bitfieldConditions
    .map((c, idx) => ({ condition: c, index: idx }))
    .filter(({ condition }) => ['I:', 'A:', 'B:', 'N:', 'O:'].includes(condition.flag));

  linkableLines.forEach(({ condition }) => {
    // Only link if this line is a group leader and can link
    if (isGroupLeader(bitfieldConditions, condition) && canLinkCondition(bitfieldConditions, condition.lineId)) {
      linkCondition(bitfieldConditions, linkGroupColors, condition.lineId);
    }
  });
}
