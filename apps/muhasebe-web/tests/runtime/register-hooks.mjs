import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, extname, resolve as resolvePath } from "node:path";

import ts from "typescript";

const runtimeRoot = dirname(fileURLToPath(import.meta.url));
const appRoot = resolvePath(runtimeRoot, "..", "..");

const fixedResolutions = new Map([
  ["next/headers", pathToFileURL(resolvePath(runtimeRoot, "mocks", "next-headers.mjs")).href],
  ["next/server", pathToFileURL(resolvePath(runtimeRoot, "mocks", "next-server.mjs")).href],
  ["@/server/db", pathToFileURL(resolvePath(runtimeRoot, "mocks", "server-db.mjs")).href],
]);

export function load(url, context, nextLoad) {
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
}

export function resolve(specifier, context, nextResolve) {
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
}

function resolveAlias(relativePath) {
  const basePath = resolvePath(appRoot, relativePath);
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.mjs`,
    resolvePath(basePath, "index.ts"),
    resolvePath(basePath, "index.tsx"),
    resolvePath(basePath, "index.js"),
    resolvePath(basePath, "index.mjs"),
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
  const basePath = resolvePath(dirname(parentPath), specifier);
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
    resolvePath(basePath, "index.ts"),
    resolvePath(basePath, "index.tsx"),
    resolvePath(basePath, "index.js"),
    resolvePath(basePath, "index.mjs"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}
