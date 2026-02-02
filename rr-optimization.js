// ============================================================================
// R/R (REMEMBER/RECALL) OPTIMIZATION MODULE
// ============================================================================

/**
 * Finds the longest pattern of 2+ lines that repeats 3+ times
 * @param {Array} lines - Array of logic lines
 * @returns {Object|null} Best pattern found or null
 */
export function findBestPattern(lines) {
  if (lines.length < 6) return null; // Need at least 6 lines for 2-line pattern × 3 occurrences
  
  const patternMap = new Map();
  
  // Check patterns of 2+ lines
  for (let patternLength = 2; patternLength <= lines.length / 3; patternLength++) {
    for (let startIndex = 0; startIndex <= lines.length - patternLength; startIndex++) {
      const pattern = lines.slice(startIndex, startIndex + patternLength).join('_');
      
      if (!patternMap.has(pattern)) {
        // Count occurrences of this pattern
        let count = 0;
        for (let i = 0; i <= lines.length - patternLength; i++) {
          const candidate = lines.slice(i, i + patternLength).join('_');
          if (candidate === pattern) {
            count++;
            i += patternLength - 1; // Skip overlapping occurrences
          }
        }
        
        if (count >= 3) {
          patternMap.set(pattern, {
            lines: lines.slice(startIndex, startIndex + patternLength),
            count,
            length: patternLength
          });
        }
      }
    }
  }
  
  if (patternMap.size === 0) return null;
  
  // Find the longest pattern (most lines)
  let bestPattern = null;
  let maxLength = 0;
  
  for (const [pattern, info] of patternMap) {
    if (info.length > maxLength) {
      maxLength = info.length;
      bestPattern = info;
    }
  }
  
  console.log('R/R: Found best pattern -', bestPattern.length, 'lines,', bestPattern.count, 'occurrences');
  
  return bestPattern;
}

/**
 * Applies R/R optimization to logic string
 * @param {string} logicString - The logic string to optimize
 * @returns {Object} Optimized logic and savings info
 */
export function applyRROptimization(logicString) {
  console.log('R/R OPTIMIZATION START');
  console.log('Input logic length:', logicString.length);
  
  // Parse logic into lines
  const lines = logicString.split('_').filter(line => line.trim());
  console.log('Total lines:', lines.length);
  
  // Find best pattern
  const pattern = findBestPattern(lines);
  
  if (!pattern) {
    console.log('R/R: No qualifying patterns found');
    return {
      optimizedLogic: logicString,
      originalLength: logicString.length,
      optimizedLength: logicString.length,
      savings: 0,
      patternUsed: null
    };
  }
  
  // Extract the last line and its flag
  const lastLine = pattern.lines[pattern.lines.length - 1];
  const flagMatch = lastLine.match(/^([A-Z]:)/);
  const originalFlag = flagMatch ? flagMatch[1] : '';
  
  if (!originalFlag) {
      console.log('R/R: No flag found on last line of pattern');
    return {
      optimizedLogic: logicString,
      originalLength: logicString.length,
      optimizedLength: logicString.length,
      savings: 0,
      patternUsed: null
    };
  }
  
  // Create remember pattern (replace last line's flag with K:)
  const rememberLines = [...pattern.lines];
  const lastLineIndex = rememberLines.length - 1;
  rememberLines[lastLineIndex] = rememberLines[lastLineIndex].replace(originalFlag, 'K:');
  const rememberPattern = rememberLines.join('_');
  
  console.log('R/R: Replaced flag', originalFlag, 'with K: on last line');
  console.log('R/R: Remember pattern:', rememberPattern);
  
  // Create recall replacement
  const recallReplacement = `${originalFlag}{recall}`;
  console.log('R/R: Recall replacement:', recallReplacement);
  
  // Build optimized logic
  const originalPatternString = pattern.lines.join('_');
  let optimizedLogic = rememberPattern + '_';
  
  let remainingLines = [...lines];
  let index = 0;
  
  while (index < remainingLines.length) {
    // Check if this position starts with our pattern
    if (index + pattern.length <= remainingLines.length) {
      const candidate = remainingLines.slice(index, index + pattern.length).join('_');
      
      if (candidate === originalPatternString) {
        // Replace with recall
        optimizedLogic += recallReplacement;
        index += pattern.length;
        
        // Add underscore if not at end
        if (index < remainingLines.length) {
          optimizedLogic += '_';
        }
      } else {
        // Keep original line
        optimizedLogic += remainingLines[index];
        index++;
        
        // Add underscore if not at end
        if (index < remainingLines.length) {
          optimizedLogic += '_';
        }
      }
    } else {
      // Not enough lines for pattern, keep remaining
      optimizedLogic += remainingLines.slice(index).join('_');
      break;
    }
  }
  
  // Remove trailing underscore
  optimizedLogic = optimizedLogic.replace(/_$/, '');
  
  const originalLength = logicString.length;
  const optimizedLength = optimizedLogic.length;
  const savings = originalLength - optimizedLength;
  
  console.log('R/R: Original length:', originalLength);
  console.log('R/R: Optimized length:', optimizedLength);
  console.log('R/R: Savings:', savings, 'characters');
  
  return {
    optimizedLogic,
    originalLength,
    optimizedLength,
    savings,
    patternUsed: {
      lines: pattern.lines,
      count: pattern.count,
      originalFlag,
      rememberPattern,
      recallReplacement
    }
  };
}
