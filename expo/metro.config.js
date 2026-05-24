const { getDefaultConfig } = require("expo/metro-config");
const { withRorkMetro } = require("@rork-ai/toolkit-sdk/metro");

const config = getDefaultConfig(__dirname);

const rorkConfig = withRorkMetro(config);

// Force Babel to transform ESM-only packages (e.g. @rork-ai/toolkit-sdk and AI SDK deps)
// to CommonJS before Hermes compiles the bundle. Without this, `export * from ...`
// reaches hermesc raw and the Android release build fails with "hermesc exit code 2".
rorkConfig.transformer = rorkConfig.transformer || {};
rorkConfig.transformer.transformIgnorePatterns = [
  "node_modules/(?!(@rork-ai/toolkit-sdk|@ai-sdk/react|@ai-sdk/provider|@ai-sdk/provider-utils|@ai-sdk/gateway|@ai-sdk/ui-utils|ai|posthog-react-native)/)",
];

// Ensure Metro understands the `exports` field in package.json so that
// ESM-only subpaths resolve correctly before being transformed.
rorkConfig.resolver = rorkConfig.resolver || {};
rorkConfig.resolver.unstable_enablePackageExports = true;

module.exports = rorkConfig;
