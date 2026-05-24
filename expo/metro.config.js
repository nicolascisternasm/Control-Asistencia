const { getDefaultConfig } = require("expo/metro-config");
const { withRorkMetro } = require("@rork-ai/toolkit-sdk/metro");

const config = getDefaultConfig(__dirname);

const rorkConfig = withRorkMetro(config);

rorkConfig.transformer = rorkConfig.transformer || {};
rorkConfig.transformer.transformIgnorePatterns = [
  "node_modules/(?!(@rork-ai/toolkit-sdk|@ai-sdk/react|@ai-sdk/provider|@ai-sdk/provider-utils|@ai-sdk/gateway|@ai-sdk/ui-utils|ai|posthog-react-native)/)",
];

module.exports = rorkConfig;
