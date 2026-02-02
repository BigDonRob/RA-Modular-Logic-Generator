// ============================================================================
// DELTA/MEM CHECK MODULE
// ============================================================================

/**
 * Applies Delta/Mem check transformation to expanded lines
 * Creates two versions: all Delta, then all Mem, with accumulators
 * @param {Object} condition - The first condition in the group
 * @param {Array} expandedLines - Array of expanded line strings
 * @returns {Array} Transformed lines with Delta and Mem versions
 */
export function applyDeltaMemCheck(condition, expandedLines) {
  // Check if condition has Delta or Mem types
  const leftIsDeltaOrMem = ['Delta', 'Mem'].includes(condition.type);
  const rightIsDeltaOrMem = ['Delta', 'Mem'].includes(condition.compareType);
  
  // If neither side uses Delta/Mem, return original lines
  if (!leftIsDeltaOrMem && !rightIsDeltaOrMem) {
    return expandedLines;
  }
  
  const deltaLines = [];
  const memLines = [];
  
  // Transform each line to both Delta and Mem versions
  expandedLines.forEach(line => {
    // NEVER convert Add Address (I:) to Delta
    if (line.startsWith('I:')) {
      deltaLines.push(line);
      memLines.push(line);
      return;
    }

    // Create Delta version: add 'd' prefix to all 0x addresses
    // Preserve 0xH (8-bit) addresses from being converted
    const deltaLine = line
      .replace(/\b0xH/g, 'd0xH')  // Mark 8-bit temporarily
      .replace(/\b0x(?![d])/g, 'd0x');  // Convert unmarked 0x to d0x
    
    // Create Mem version: remove 'd' prefix from all addresses
    // Restore 0xH addresses
    const memLine = line
      .replace(/\bd0xH/g, '0xH')  // Restore 8-bit
      .replace(/\bd0x(?![H])/g, '0x');  // Remove other 'd' prefixes
    
    deltaLines.push(deltaLine);
    memLines.push(memLine);
  });
  
  // Add accumulator lines for Add/Sub Source flags
  if (condition.flag === 'A:' || condition.flag === 'B:') {
    const accumulatorLine = '0=0';
    deltaLines.push(accumulatorLine);
    memLines.push(accumulatorLine);
  }
  
  // Return all Delta lines, then all Mem lines
  return [...deltaLines, ...memLines];
}

/**
 * Applies And/Or Next check transformation (for single-line N:/O: groups)
 * @param {Object} condition - The condition with N: or O: flag
 * @param {Array} expandedLines - Array of expanded line strings
 * @returns {Array} Transformed lines with And Next and Or Next versions
 */
export function applyAndOrNextCheck(condition, expandedLines) {
  const leftIsDeltaOrMem = ['Delta', 'Mem'].includes(condition.type);
  const rightIsDeltaOrMem = ['Delta', 'Mem'].includes(condition.compareType);
  
  if (!leftIsDeltaOrMem && !rightIsDeltaOrMem) {
    return expandedLines;
  }

  const andNextLines = [];
  const orNextLines = [];

  expandedLines.forEach((line, index) => {
    const isLastLine = index === expandedLines.length - 1;

    // Create And Next version (convert Or Next to And Next)
    let andNextLine = line;
    if (!isLastLine) {
      // Convert flag: O: → N:
      andNextLine = andNextLine.replace(/^O:/, 'N:');

      // Swap Mem ↔ Delta types
      andNextLine = andNextLine
        .replace(/\b0xH/g, 'd0xH')
        .replace(/\b0x(?![d])/g, 'd0x');
      andNextLine = andNextLine
        .replace(/\bd0xH/g, '0xH')
        .replace(/\bd0x(?![H])/g, '0x');

      // Invert comparisons
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

      // Swap Mem ↔ Delta types
      orNextLine = orNextLine
        .replace(/\b0xH/g, 'd0xH')
        .replace(/\b0x(?![d])/g, 'd0x');
      orNextLine = orNextLine
        .replace(/\bd0xH/g, '0xH')
        .replace(/\bd0x(?![H])/g, '0x');

      // Invert comparisons
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
