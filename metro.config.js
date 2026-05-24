const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withRorkMetro } = require("@rork-ai/toolkit-sdk/metro");

const config = getDefaultConfig(__dirname);

const otelStub = path.resolve(__dirname, "opentelemetry-stub.js");
const supabaseCjs = path.resolve(
  __dirname,
  "node_modules/@supabase/supabase-js/dist/index.cjs"
);

const previousResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === "@opentelemetry/api" ||
    moduleName.startsWith("@opentelemetry/") ||
    moduleName === "opentelemetry" ||
    moduleName.startsWith("opentelemetry/") ||
    moduleName.startsWith("opentelemetry-")
  ) {
    return { type: "sourceFile", filePath: otelStub };
  }
  // Force CJS build of supabase-js: the ESM build uses dynamic import(OTEL_PKG)
  // which Hermes cannot parse. The CJS build uses require(s) which is Hermes-compatible.
  if (moduleName === "@supabase/supabase-js") {
    return { type: "sourceFile", filePath: supabaseCjs };
  }
  if (previousResolveRequest) {
    return previousResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withRorkMetro(config);
