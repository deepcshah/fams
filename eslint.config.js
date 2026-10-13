const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    ignores: ['dist/*', 'node_modules/*', '.expo/*'],
  },
  {
    // Reanimated shared values are mutable by design — writing `sv.value` from a
    // worklet or an event handler is the documented API. The React Compiler's
    // immutability rule has no model for that, so it is switched off where the
    // pan/zoom viewport lives rather than littering the files with disables.
    files: ['src/components/PanZoom.tsx', 'src/components/tree/**'],
    rules: { 'react-hooks/immutability': 'off' },
  },
];
