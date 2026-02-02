// ============================================================================
// BIT COMPRESSION MODULE
// ============================================================================

/**
 * Compresses bit expansions into BitCount format when 5+ bits from same address
 * @param {Array} lines - Array of expanded line strings
 * @returns {Array} Compressed lines (or original if no compression possible)
 */
export function compressBits(lines) {
  const groups = [];
  let currentGroup = null;

  // First pass: Group lines by address and type (ignoring flags for grouping)
  lines.forEach(line => {
    // Match bit lines (ignore flags for grouping)
    const bitMatch = line.match(/(A:|B:)?([dpb~])?0x([MNOPQRST])([0-9A-F]+)/);
    
    if (!bitMatch) {
      // Not a bit line - close current group and add as standalone
      if (currentGroup) {
        groups.push(currentGroup);
        currentGroup = null;
      }
      groups.push({ bits: null, lines: [line], hasCompressibleFlag: false });
      return;
    }

    const prefix = bitMatch[1] || '';
    const typePrefix = bitMatch[2] || '';
    const bit = bitMatch[3];
    const addr = bitMatch[4];
    const bitIndex = ['M','N','O','P','Q','R','S','T'].indexOf(bit);

    if (bitIndex === -1) {
      // Not a valid bit - close current group and add as standalone
      if (currentGroup) {
        groups.push(currentGroup);
        currentGroup = null;
      }
      groups.push({ bits: null, lines: [line], hasCompressibleFlag: false });
      return;
    }

    // Check if we should start a new group or continue current one
    if (!currentGroup || 
        currentGroup.addr !== addr || 
        currentGroup.typePrefix !== typePrefix) {
      
      if (currentGroup) {
        groups.push(currentGroup);
      }
      currentGroup = { addr, typePrefix, bits: [bitIndex], lines: [line], prefixes: [prefix] };
    } else {
      // Continue current group
      currentGroup.bits.push(bitIndex);
      currentGroup.lines.push(line);
      currentGroup.prefixes.push(prefix);
    }
  });

  // Handle last group
  if (currentGroup) {
    groups.push(currentGroup);
  }

  // Second pass: Determine which groups should be compressed based on LAST line's flag
  groups.forEach(group => {
    if (group.bits) {
      // Check if the LAST line in this group has A: or B: flag
      const lastLinePrefix = group.prefixes[group.prefixes.length - 1];
      group.hasCompressibleFlag = (lastLinePrefix === 'A:' || lastLinePrefix === 'B:');
    }
  });

  // Check if any groups are compressible
  const hasCompressibleGroups = groups.some(group => 
    group.bits && 
    group.bits.length >= 5 && 
    group.hasCompressibleFlag
  );

  // If no groups are compressible, return original lines
  if (!hasCompressibleGroups) {
    return lines;
  }

  // Compress groups and build result
  const result = [];
  groups.forEach(group => {
    if (group.bits && 
        group.bits.length >= 5 && 
        group.hasCompressibleFlag) {
      
      // Find missing bits (0-7)
      const allBits = [0,1,2,3,4,5,6,7];
      const missingBits = allBits.filter(bit => !group.bits.includes(bit));
      
      // Create BitCount line using the LAST line's prefix and type
      const lastLinePrefix = group.prefixes[group.prefixes.length - 1];
      const lastLineTypePrefix = group.typePrefix;
      
      const bitCountLine = `${lastLinePrefix}${lastLineTypePrefix}0xK${group.addr}`;
      
      // Add missing bit lines with appropriate flags
      const missingLines = [];
      missingBits.forEach(bit => {
        const bitPrefix = ['M','N','O','P','Q','R','S','T'][bit];
        
        if (lastLinePrefix === 'B:') {
          // B: (Sub Source) - Add missing bits first (use A: flag for addition)
          missingLines.push(`A:${lastLineTypePrefix}0x${bitPrefix}${group.addr}`);
        } else {
          // A: (Add Source) - Sub missing bits (use B: flag for subtraction)
          missingLines.push(`B:${lastLineTypePrefix}0x${bitPrefix}${group.addr}`);
        }
      });
      
      console.log('Compressing group - bits:', group.bits.length, ', missing:', missingBits.length);
      console.log('Last line prefix:', lastLinePrefix, ', Type prefix:', lastLineTypePrefix);
      console.log('BitCount line:', bitCountLine);
      console.log('Missing lines:', missingLines);
      
      // Add in correct order based on flag type
      if (lastLinePrefix === 'B:') {
        // B: (Sub Source) - Add missing bits first (A:), then Sub BitCount (B:)
        console.log('B: compression - Add missing bits (A:) first, then Sub BitCount (B:)');
        result.push(...missingLines, bitCountLine);
      } else {
        // A: (Add Source) - Add BitCount first (A:), then Sub missing bits (B:)
        console.log('A: compression - Add BitCount (A:) first, then Sub missing bits (B:)');
        result.push(bitCountLine, ...missingLines);
      }
      
      console.log('Compressed result for this group:', result.slice(-missingLines.length - 1));
    } else {
      // Not compressible - add original lines
      result.push(...group.lines);
    }
  });

  return result;
}

/**
 * Calculates how many lines would be saved by compression
 * @param {Array} lines - Original expanded lines
 * @returns {number} Number of lines saved (can be negative if compression adds lines)
 */
export function calculateCompressionSavings(lines) {
  const compressed = compressBits(lines);
  return lines.length - compressed.length;
}
