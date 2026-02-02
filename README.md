# Modular Logic Generator

A powerful web-based tool for building achievement logic conditions with advanced expansion and optimization capabilities.

## Features

### Core Functionality
- **Visual Logic Builder**: Create conditions using intuitive dropdowns for flags, types, sizes, and values
- **Real-time Validation**: Input validation prevents invalid combinations
- **Group Management**: Link conditions together for batch operations
- **Live Preview**: See generated logic in real-time

### Advanced Expansion System

#### Custom Bit Expansion
- **Bit Selection**: Choose individual bits (Bit0-Bit7) or nibbles (Lower4/Upper4)
- **Multiple Addresses**: Select from multiple memory addresses
- **Custom Groups**: Create unlimited custom expansion groups
- **Visual Interface**: Easy-to-use bit selection panel

#### Arithmetic Expansion
- **Increment Support**: Add arithmetic increments to memory addresses
- **Hex/Decimal Input**: Support for both hex and decimal values
- **Per-line Configuration**: Different increments for each line

### Optimization Features

#### Bit Compression
- **Smart Detection**: Automatically identifies compressible bit patterns
- **Add/Sub Logic**: Properly handles Add Source (A:) and Sub Source (B:) flags
- **Group Optimization**: Reduces group count when compression is possible
- **Interleaved Pattern**: A+B+A+C pattern for maximum efficiency

#### Delta/Mem Check
- **Accumulator Logic**: Creates Delta and Mem versions with accumulators
- **Flag Detection**: Works with Add/Sub Source and And/Or Next flags
- **Automatic Application**: Applies to appropriate groups automatically

#### R/R (Remember/Recall) Optimization
- **Pattern Detection**: Finds repetitive patterns in generated logic
- **Memory Optimization**: Uses Remember flags to eliminate duplication
- **Intelligent Replacement**: Replaces patterns with Recall calls
- **Space Savings**: Significant reduction in logic string size

## Getting Started

### Basic Usage
1. **Enter Base Logic**: Start with a base logic string or build from scratch
2. **Add Conditions**: Use the visual builder to add conditions
3. **Configure Groups**: Link related conditions together
4. **Expand**: Click Expand to generate expanded logic
5. **Optimize**: Enable optimization features for maximum efficiency

### Advanced Features

#### Custom Expansion
1. Click **Expand** on any condition
2. Select **Customize** for bit lines
3. Choose bits and addresses in the customization panel
4. Set the number of groups to generate
5. **Confirm** to apply custom expansion

#### Bit Compression
1. Enable **Bit-Compression** toggle in expansion panel
2. Only works with Bit lines (Bit0-Bit7) that have custom expansion
3. Automatically compresses 5+ bits from the same address
4. Applies proper Add/Sub flag logic

#### Delta/Mem Check
1. Enable **Delta/Mem Check** toggle in expansion panel
2. Works with Add/Sub Source (A:/B:) flags
3. Creates accumulator versions of expanded logic
4. Handles And/Or Next (N:/O:) flags appropriately

#### R/R Optimization
1. Enable **R/R Collapse** toggle on main panel
2. Click **Generate Logic** to apply optimization
3. Automatically finds and compresses repetitive patterns
4. Uses Remember/Recall flags for space savings

## Input Validation

### Flag Restrictions
- **I: (Add Address)**: Only allows Mem, Prior, Value, Recall types
- **All other flags**: Allow all types (Mem, Value, Delta, Prior, BCD, Float, Invert, Recall)

### Expansion Restrictions
- **Disabled for**: Value=Value and Recall=Recall combinations
- **Enabled for**: Any combination with at least one memory type

### Size Requirements
- **Memory Types**: Require size selection (8-bit, Bit0-Bit7, etc.)
- **Value/Recall**: No size selection needed

## Optimization Rules

### Bit Compression Rules
- **Only Bit lines**: Works with Bit0-Bit7 sizes only
- **Minimum 5 bits**: Requires 5+ bits from same address
- **A:/B: flags**: Must have Add Source or Sub Source flags
- **Non-Bit lines**: Cannot have customizations or increments

### Group Optimization
- **Last Line Priority**: Uses last line in group for compression decisions
- **Interleaved Pattern**: A+B+A+C pattern for optimal results
- **Delta/Mem**: Uses last line flags for accumulator logic

### R/R Pattern Matching
- **Minimum Pattern**: 2+ lines repeating 3+ times
- **Longest Pattern**: Selects longest qualifying pattern
- **Flag Replacement**: Replaces last line flag with K:
- **Recall Usage**: Uses original flag + {recall} for replacements

## Technical Architecture

### Modular Structure
- **app.js**: Main application logic and UI coordination
- **compression.js**: Bit compression algorithms
- **delta-mem-check.js**: Delta/Mem accumulator logic
- **rr-optimization.js**: Remember/Recall optimization
- **expansion-system.js**: Expansion management
- **custom-panel-controller.js**: Custom expansion UI
- **html-renderer.js**: UI rendering and updates
- **validation.js**: Input validation and normalization
- **parsing.js**: Logic string parsing
- **core-constants.js**: Core constants and mappings

### Data Flow
1. **Input**: User enters conditions via UI
2. **Validation**: Input validation and normalization
3. **Expansion**: Generate expanded logic with optimizations
4. **Optimization**: Apply compression and R/R optimization
5. **Output**: Generate final optimized logic string

## Browser Compatibility

- **Modern Browsers**: Chrome, Firefox, Safari, Edge
- **ES6 Modules**: Requires modern JavaScript support
- **No Dependencies**: Pure vanilla JavaScript implementation

## Performance

### Optimization Impact
- **Bit Compression**: Can reduce 56 lines to 4 lines (93% reduction)
- **R/R Optimization**: Can save hundreds of characters in repetitive logic
- **Group Optimization**: Reduces unnecessary duplication
- **Memory Efficient**: Modular architecture minimizes memory usage

### Large Logic Support
- **Thousands of Conditions**: Handles large logic sets efficiently
- **Complex Patterns**: Processes complex bit patterns quickly
- **Real-time Updates**: Immediate feedback on changes

## Tips and Best Practices

### For Maximum Efficiency
1. **Use Custom Expansion**: For bit-level control and maximum compression
2. **Enable All Optimizations**: Bit Compression + Delta/Mem + R/R
3. **Group Related Conditions**: Link similar conditions together
4. **Use Appropriate Flags**: Choose correct flags for intended behavior

### For Debugging
1. **Check Console**: Monitor optimization process and results
2. **Verify Output**: Review generated logic for correctness
3. **Test Incrementally**: Build logic step by step
4. **Use Validation**: Let validation guide correct input

### For Complex Logic
1. **Start Simple**: Build basic structure first
2. **Add Complexity**: Gradually add advanced features
3. **Test Each Step**: Verify each addition works correctly
4. **Document Logic**: Keep track of complex logic patterns

## Keyboard Shortcuts

- **Tab**: Navigate between form fields
- **Enter**: Confirm actions in modals
- **Escape**: Cancel current operation
- **Ctrl+C**: Copy to clipboard (when focused on logic output)

## Support

For issues, questions, or feature requests, please refer to the console output for debugging information. The application provides detailed logging for all operations and optimizations.
