const { getDefaultConfig } = require("expo/metro-config");
const { withRorkMetro } = require("@rork-ai/toolkit-sdk/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);

config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = ["require", "react-native", "default"];

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  "@opentelemetry/api": path.resolve(__dirname, "opentelemetry-stub.js"),
};

module.exports = withRorkMetro(config);
