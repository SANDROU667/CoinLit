const fs = require("fs");
const path = require("path");

const root = process.cwd();
const roots = ["app", "components", "lib", "data"];
const extensions = new Set([".ts", ".tsx", ".js", ".jsx", ".json", ".css", ".md", ".cjs"]);
const decoder1251 = new TextDecoder("windows-1251");
const cp1251Followers = new Set(Array.from(decoder1251.decode(Uint8Array.from(Array.from({ length: 64 }, (_, index) => index + 0x80)))));
const cyrR = "\u0420";
const cyrS = "\u0421";
const cyrV = "\u0412";
const commonCyrillicMojibake = new Set(["\u00ab", "\u00bb", "\u00a0", "\u00b7"]);

function hasMojibake(text) {
  if (text.includes("\uFFFD")) return true;
  if (text.includes("\u00e2\u20ac")) return true;

  for (let index = 0; index < text.length - 1; index += 1) {
    const current = text[index];
    const next = text[index + 1];
    const nextCode = next.charCodeAt(0);

    if ((current === cyrR || current === cyrS) && cp1251Followers.has(next)) return true;
    if (current === cyrV && commonCyrillicMojibake.has(next)) return true;
    if ((current === "\u00d0" || current === "\u00d1" || current === "\u00c2") && nextCode >= 0x80 && nextCode <= 0xbf) {
      return true;
    }
  }

  return false;
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && entry.name !== ".next") walk(fullPath, files);
      continue;
    }

    if (extensions.has(path.extname(entry.name))) files.push(fullPath);
  }

  return files;
}

const issues = [];
for (const folder of roots) {
  for (const file of walk(path.join(root, folder))) {
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      if (hasMojibake(line)) {
        issues.push({
          file: path.relative(root, file),
          line: index + 1,
          preview: line.trim().slice(0, 160)
        });
      }
    });
  }
}

if (issues.length > 0) {
  console.error("Encoding check failed. Possible mojibake was found:");
  for (const issue of issues.slice(0, 30)) {
    console.error(`${issue.file}:${issue.line} ${issue.preview}`);
  }
  if (issues.length > 30) console.error(`...and ${issues.length - 30} more`);
  process.exit(1);
}

console.log("Encoding check passed.");
