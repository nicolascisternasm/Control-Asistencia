const { getDefaultConfig } = require("expo/metro-config");
const { withRorkMetro } = require("@rork-ai/toolkit-sdk/metro");

const config = getDefaultConfig(__dirname);

// Force Metro to prefer the CommonJS ("require") export condition over "import".
// Hermes cannot parse dynamic `import()` expressions used by the ESM build of
// `@supabase/tracing` (e.g. `import(/* webpackIgnore */ OTEL_PKG)`), which made
// `:app:createBundleReleaseJsAndAssets` fail with `hermesc exit value 2`.
// The CJS variant of the same module uses `require()` and works fine.
config.resolver = config.resolver || {};
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = ["require", "react-native", "default"];

module.exports = withRorkMetro(config);
