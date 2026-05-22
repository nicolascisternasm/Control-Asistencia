const { getDefaultConfig } = require("expo/metro-config");
const { withRorkMetro } = require("@rork-ai/toolkit-sdk/metro");
const fs = require("fs");
const path = require("path");

/**
 * Patch @supabase/supabase-js to remove the dynamic `import(OTEL_PKG)` that
 * Hermes (used by EAS release builds) cannot parse.
 *
 * Supabase 2.106+ inlines an optional OpenTelemetry tracing loader that uses
 * a variable specifier dynamic import. Hermes only supports literal-string
 * dynamic imports, so the release bundler fails with exit code 2.
 *
 * We never enable tracing (`tracePropagationOptions.enabled` is off by
 * default), so it's safe to replace with `Promise.resolve(null)`.
 */
function patchSupabaseOtel() {
  const candidates = [
    path.join(__dirname, "node_modules/@supabase/supabase-js/dist/index.mjs"),
    path.join(__dirname, "node_modules/@supabase/supabase-js/dist/index.cjs"),
  ];

  for (const file of candidates) {
    try {
      if (!fs.existsSync(file)) continue;
      const src = fs.readFileSync(file, "utf8");
      if (!src.includes("otelModulePromise")) continue;
      if (src.includes("/* rork-otel-patched */")) continue;

      const patched = src.replace(
        /otelModulePromise\s*=\s*import\s*\([\s\S]*?\)\s*\.catch\s*\(\s*\(\s*\)\s*=>\s*null\s*\)/g,
        "otelModulePromise = Promise.resolve(null) /* rork-otel-patched */"
      );

      if (patched !== src) {
        fs.writeFileSync(file, patched, "utf8");
        console.log("[rork] patched supabase OTEL dynamic import in", path.relative(__dirname, file));
      }
    } catch (e) {
      console.warn("[rork] failed to patch", file, e && e.message);
    }
  }
}

patchSupabaseOtel();

const config = getDefaultConfig(__dirname);

module.exports = withRorkMetro(config);
