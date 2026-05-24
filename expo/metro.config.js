const { getDefaultConfig } = require("expo/metro-config");
const { withRorkMetro } = require("@rork-ai/toolkit-sdk/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Fix Hermes "exit 2" — Supabase ESM build usa `import(OTEL_PKG)` dinámico
// que Hermes no parsea. Forzamos a Metro a resolver paquetes por su build CJS.
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = ["require", "react-native", "default"];

// Stub para @opentelemetry/api (Supabase lo importa opcionalmente).
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  "@opentelemetry/api": path.resolve(__dirname, "opentelemetry-stub.js"),
};

module.exports = withRorkMetro(config);
