module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { unstable_transformImportMeta: true }]],
    plugins: [
      // Strip dynamic `import(VAR)` calls that Hermes cannot parse.
      // Only targets dynamic imports whose specifier is NOT a string literal
      // (e.g. @supabase/supabase-js does `import(OTEL_PKG)` for optional OpenTelemetry).
      function stripNonLiteralDynamicImports() {
        return {
          name: "strip-non-literal-dynamic-imports",
          visitor: {
            CallExpression(path) {
              const callee = path.node.callee;
              const isDynamicImport =
                callee &&
                (callee.type === "Import" ||
                  (callee.type === "Identifier" && callee.name === "import"));
              if (!isDynamicImport) return;
              const arg = path.node.arguments[0];
              if (!arg) return;
              if (arg.type === "StringLiteral") return;
              path.replaceWithSourceString("Promise.resolve(null)");
            },
          },
        };
      },
    ],
  };
};
