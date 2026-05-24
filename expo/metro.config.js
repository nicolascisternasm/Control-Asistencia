const { getDefaultConfig } = require("expo/metro-config");
const { withRorkMetro } = require("@rork-ai/toolkit-sdk/metro");

const config = getDefaultConfig(__dirname);

// Enable package.json "exports" field so modern ESM packages (e.g. @rork-ai/toolkit-sdk,
// @ai-sdk/*) resolve to the correct entry points before being transformed.
config.resolver = config.resolver || {};
config.resolver.unstable_enablePackageExports = true;

// Force Babel to transform ESM-only packages to CommonJS before Hermes compiles the
// bundle. Without this, `export * from "..."` / `import x from "..."` reach hermesc
// raw and it fails with "exit value 2".
config.transformer = config.transformer || {};
config.transformer.unstable_allowRequireContext = true;

module.exports = withRorkMetro(config);
