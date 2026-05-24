const { getDefaultConfig } = require("expo/metro-config");
const { withRorkMetro } = require("@rork-ai/toolkit-sdk/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Force Metro to prefer CommonJS over ESM when resolving packages with `exports`.
// This avoids Hermes choking on dynamic `import(OTEL_PKG)` syntax inside
// @supabase/tracing (sub-paquete de @supabase/supabase-js) cuyo build ESM no
// puede ser parseado por hermesc.
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = ["require", "react-native", "default"];

// Stub para @opentelemetry/api por si algún paquete lo resuelve directamente.
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  "@opentelemetry/api": path.resolve(__dirname, "opentelemetry-stub.js"),
};

module.exports = withRorkMetro(config);
