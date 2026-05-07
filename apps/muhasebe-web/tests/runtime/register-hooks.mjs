import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, extname, resolve } from "node:path";
import { registerHooks } from "node:module";

import ts from "../../node_modules/typescript/lib/typescript.js";

const runtimeRoot = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(runtimeRoot, "..", "..");

const fixedResolutions = new Map([
  ["next/headers", pathToFileURL(resolve(runtimeRoot, "mocks", "next-headers.mjs")).href],
  ["next/server", pathToFileURL(resolve(runtimeRoot, "mocks", "next-server.mjs")).href],
  ["@/server/db", pathToFileURL(resolve(runtimeRoot, "mocks", "server-db.mjs")).href],
]);

registerHooks({
  load(url, context, nextLoad) {
    if (url.startsWith("file:")) {
      const extension = extname(fileURLToPath(url));

      if (extension === ".ts" || extension === ".tsx") {
        const source = readFileSync(new URL(url), "utf8");
        const transpiled = ts.transpileModule(source, {
          compilerOptions: {
            jsx: extension === ".tsx" ? ts.JsxEmit.ReactJSX : ts.JsxEmit.Preserve,
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ES2022,
          },
          fileName: fileURLToPath(url),
        });

        return {
          format: "module",
          shortCircuit: true,
          source: transpiled.outputText,
        };
      }
    }

    return nextLoad(url, context);
  },
  resolve(specifier, context, nextResolve) {
    const fixed = fixedResolutions.get(specifier);

    if (fixed) {
      return { shortCircuit: true, url: fixed };
    }

    if (specifier.startsWith("@/")) {
      const resolved = resolveAlias(specifier.slice(2));
      return { shortCircuit: true, url: resolved };
    }

    if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL) {
      const resolved = resolveRelativeSpecifier(specifier, context.parentURL);

      if (resolved) {
        return { shortCircuit: true, url: resolved };
      }
    }

    return nextResolve(specifier, context);
  },
});

function resolveAlias(relativePath) {
  const basePath = resolve(appRoot, relativePath);
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.mjs`,
    resolve(basePath, "index.ts"),
    resolve(basePath, "index.tsx"),
    resolve(basePath, "index.js"),
    resolve(basePath, "index.mjs"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return pathToFileURL(candidate).href;
    }
  }

  throw new Error(`Unable to resolve alias @/${relativePath}`);
}

function resolveRelativeSpecifier(specifier, parentUrl) {
  const parentPath = fileURLToPath(parentUrl);
  const basePath = resolve(dirname(parentPath), specifier);
  const resolved = resolveWithKnownExtensions(basePath);

  return resolved ? pathToFileURL(resolved).href : null;
}

function resolveWithKnownExtensions(basePath) {
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.mjs`,
    resolve(basePath, "index.ts"),
    resolve(basePath, "index.tsx"),
    resolve(basePath, "index.js"),
    resolve(basePath, "index.mjs"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}
