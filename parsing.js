// ============================================================================
// PARSING FUNCTIONS
// ============================================================================

import { sizePrefixMap, sizePrefixOrder, OPERAND_FLAGS } from './core-constants.js';

/**
 * Parses a memory token to extract size and memory address
 * @param {string} token - The memory token (e.g., "0xX001234")
 * @returns {Object} Object with size and memory properties
 */
export function parseMemoryToken(token) {
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

/**
 * Parses an operand token to determine its type and properties
 * @param {string} token - The operand token
 * @returns {Object} Object with type, size, and memory properties
 */
export function parseOperandToken(token) {
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

/**
 * Parses a line of text into a condition object
 * @param {string} line - The line to parse
 * @returns {Object|null} Condition object or null if parsing fails
 */
export function parseLineToCondition(line) {
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

  const isOperandFlag = OPERAND_FLAGS.includes(flag);
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

  return {
    flag,
    type: left.type,  // Use the parsed type directly
    size: left.size,
    memory: left.memory,
    cmp,
    compareType: right ? right.type : 'Value',
    compareSize: right ? right.size : '8-bit',
    value: right ? right.memory : '0',
    hits: isOperandFlag ? '' : hits,
  };
}

/**
 * Parses the base logic textarea into an array of conditions
 * @returns {Array} Array of parsed conditions
 */
export function parseBaseLogic() {
  const baseLogic = document.getElementById('baseLogic').value.trim();
  if (!baseLogic) return [];
  return baseLogic.split('_').map(parseLineToCondition).filter(Boolean);
}
