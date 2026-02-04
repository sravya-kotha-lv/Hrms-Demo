const fs = require("fs");
const path = require("path");

const ROUTES_ROOT = path.join(__dirname, "..", "modules");

const AUTHORIZE_REGEX = /authorize\(\s*["'`]([^"'`]+)["'`]\s*\)/g;

const walk = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".routes.js")) {
      files.push(fullPath);
    }
  }

  return files;
};

const toTitle = (code) =>
  code
    .toLowerCase()
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");

exports.extractPermissionsFromRoutes = () => {
  const routeFiles = walk(ROUTES_ROOT);
  const codeToMeta = new Map();

  for (const file of routeFiles) {
    const content = fs.readFileSync(file, "utf8");
    const moduleName = path.basename(path.dirname(file));

    let match;
    while ((match = AUTHORIZE_REGEX.exec(content)) !== null) {
      const code = match[1];
      if (!codeToMeta.has(code)) {
        codeToMeta.set(code, {
          code,
          name: toTitle(code),
          module: moduleName
        });
      }
    }
  }

  return Array.from(codeToMeta.values());
};
