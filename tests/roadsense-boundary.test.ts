// RoadSense's engine and components are exported to a standalone repository, so
// they may import only each other, React and Node builtins: nothing from the rest
// of DriveIQ ("@/…"), Next.js or Supabase.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const BOUNDARY = ["lib/roadsense", "components/roadsense"];

function sourceFiles(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && /\.(ts|tsx)$/.test(entry.name))
    .map((entry) => relative(ROOT, join(entry.parentPath, entry.name)).split(sep).join("/"));
}

/** Every module specifier a file imports, statically or dynamically. */
function specifiers(source: string): string[] {
  const found = [...source.matchAll(/(?:\bfrom\s+|\bimport\s*\(\s*|^\s*import\s+)["']([^"']+)["']/gm)];
  return found.map((match) => match[1]);
}

function allowed(file: string, specifier: string): boolean {
  if (specifier === "react" || specifier.startsWith("node:")) return true;
  if (!specifier.startsWith(".")) return false;
  const target = relative(ROOT, resolve(ROOT, dirname(file), specifier)).split(sep).join("/");
  return BOUNDARY.some((dir) => target === dir || target.startsWith(`${dir}/`));
}

test("lib/roadsense and components/roadsense import only each other, react and node builtins", () => {
  const files = BOUNDARY.flatMap(sourceFiles);
  assert.ok(files.includes("lib/roadsense/engine.ts") && files.includes("components/roadsense/RoadSenseApp.tsx"), "the scan sees both folders");
  const outside = files.flatMap((file) =>
    specifiers(readFileSync(join(ROOT, file), "utf8"))
      .filter((specifier) => !allowed(file, specifier))
      .map((specifier) => `${file} imports ${specifier}`),
  );
  assert.deepEqual(outside, []);
});

test("the scan reads every kind of import", () => {
  const source = 'import a from "next/link";\nimport type { B } from "@/lib/i18n";\nconst c = await import("@supabase/x");\nimport "./side";';
  assert.deepEqual(specifiers(source), ["next/link", "@/lib/i18n", "@supabase/x", "./side"]);
  assert.equal(allowed("components/roadsense/X.tsx", "../../lib/roadsense/types"), true);
  assert.equal(allowed("components/roadsense/X.tsx", "../../app/roadsense/copy"), false);
  assert.equal(allowed("lib/roadsense/x.ts", "node:crypto"), true);
});
