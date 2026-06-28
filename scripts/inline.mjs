// Inlines the Vite build into a single self-contained game.html that runs
// directly from the filesystem (double-click, no dev server needed).
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const assets = join(dist, "assets");

let html = readFileSync(join(dist, "index.html"), "utf8");
const files = readdirSync(assets);
const jsFile = files.find((f) => f.endsWith(".js"));
const cssFile = files.find((f) => f.endsWith(".css"));

const js = readFileSync(join(assets, jsFile), "utf8");
const css = readFileSync(join(assets, cssFile), "utf8");

// Inline the stylesheet (<link rel="stylesheet" ... href="...css">).
// NOTE: use replacer FUNCTIONS — a string replacement would interpret `$&`,
// `$1`, etc. inside the minified JS as special patterns and corrupt it.
html = html.replace(
  /<link[^>]*rel="stylesheet"[^>]*>/,
  () => `<style>\n${css}\n</style>`,
);

// Inline the module script (<script type="module" ... src="...js"></script>).
// Escape any literal </script> so the inline script can't be terminated early.
const safeJs = js.replace(/<\/script>/gi, "<\\/script>");
html = html.replace(
  /<script[^>]*type="module"[^>]*src="[^"]*"[^>]*><\/script>/,
  () => `<script type="module">\n${safeJs}\n</script>`,
);

const out = join(root, "game.html");
writeFileSync(out, html);
console.log(
  `Wrote ${out} (${(html.length / 1024).toFixed(0)} KB, self-contained)`,
);
