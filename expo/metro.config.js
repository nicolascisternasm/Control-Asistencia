const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withRorkMetro } = require("@rork-ai/toolkit-sdk/metro");

const config = withRorkMetro(getDefaultConfig(__dirname));

// Patch @supabase/supabase-js to strip the dynamic `import(OTEL_PKG)` that
// Hermes cannot parse. See metro-transformer.js. Applied AFTER withRorkMetro
// so the Rork wrapper does not overwrite babelTransformerPath.
config.transformer = {
  ...config.transformer,
  babelTransformerPath: path.resolve(__dirname, "metro-transformer.js"),
};

module.exports = config;
