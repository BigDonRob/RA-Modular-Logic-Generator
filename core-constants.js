// ============================================================================
// CORE CONSTANTS AND CONFIGURATION
// ============================================================================

export const prefixArray = ['M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T'];

export const sizePrefixMap = {
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

export const sizePrefixOrder = [
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

export const sizeMapForText = {
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

// Size options for different types
export const SIZE_OPTIONS = {
  BCD: ['8-bit', '16-bit', '32-bit', '16-bit BE', '32-bit BE'],
  Float: ['32-bit', '32-bit BE'],
  Mem: [
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
  ],
};

// Type options for different flags
export const TYPE_OPTIONS = {
  AddAddress: ['Mem', 'Prior', 'Value', 'Recall'],
  All: ['Mem', 'Value', 'Delta', 'Prior', 'BCD', 'Float', 'Invert', 'Recall'],
};

// Memory types that need hex normalization
export const MEMORY_TYPES = [
  'Mem',
  'Delta',
  'Prior',
  'Invert',
  'BCD',
  'Float',
];

// Types that need size selection
export const SIZE_NEEDED_TYPES = [
  'Mem',
  'Delta',
  'Prior',
  'Invert',
  'BCD',
  'Float',
];

// Bit types
export const BIT_TYPES = [
  'Bit0',
  'Bit1',
  'Bit2',
  'Bit3',
  'Bit4',
  'Bit5',
  'Bit6',
  'Bit7',
  'BitCount',
];

// 4-bit types
export const FOUR_BIT_TYPES = ['Lower4', 'Upper4'];

// Operand flags
export const OPERAND_FLAGS = ['A:', 'B:', 'I:', 'K:'];

// Flag definitions
export const FLAG_OPTIONS = [
  { value: '', label: '' },
  { value: 'P:', label: 'Pause If' },
  { value: 'R:', label: 'Reset If' },
  { value: 'Z:', label: 'Reset Next If' },
  { value: 'A:', label: 'Add Source' },
  { value: 'B:', label: 'Sub Source' },
  { value: 'C:', label: 'Add Hits' },
  { value: 'D:', label: 'Sub Hits' },
  { value: 'I:', label: 'Add Address' },
  { value: 'N:', label: 'And Next' },
  { value: 'O:', label: 'Or Next' },
  { value: 'M:', label: 'Measured' },
  { value: 'G:', label: 'Measured %' },
  { value: 'Q:', label: 'Measured If' },
  { value: 'T:', label: 'Trigger' },
  { value: 'K:', label: 'Remember' },
];
