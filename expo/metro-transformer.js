/**
 * Custom Metro transformer.
 *
 * Wraps Expo's default transformer and patches `@supabase/supabase-js` so that
 * Hermes can parse the bundle. Supabase 2.106+ inlines a dynamic `import(VAR)`
 * for optional `@opentelemetry/api` that Hermes refuses to parse.
 *
 * We rewrite that single expression to `Promise.resolve(null)` — tracing is an
 * opt-in feature (`tracePropagationOptions.enabled`) that we never enable.
 */
const upstream = require("@expo/metro-config/babel-transformer");

const SUPABASE_OTEL_RE =
  /otelModulePromise\s*=\s*import\s*\([\s\S]*?\)\s*\.catch\s*\(\s*\(\s*\)\s*=>\s*null\s*\)/g;

module.exports.transform = function transform(args) {
  const { filename, src } = args;

  if (
    typeof src === "string" &&
    filename &&
    filename.includes("@supabase") &&
    src.includes("otelModulePromise") &&
    src.includes("import(")
  ) {
    const patched = src.replace(
      SUPABASE_OTEL_RE,
      "otelModulePromise = Promise.resolve(null)"
    );
    return upstream.transform({ ...args, src: patched });
  }

  return upstream.transform(args);
};
