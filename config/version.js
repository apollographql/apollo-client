const fs = require('fs');
const path = require('path');
const distRoot = path.join(__dirname, "..", "dist");
const versionPath = path.join(distRoot, "version.js");
const pkgJsonPath = path.join(__dirname, "..", "package.json");

const { version } = JSON.parse(fs.readFileSync(pkgJsonPath));
if (typeof version !== "string") {
  throw new Error('"version" field missing from package.json');
}

const original = fs.readFileSync(versionPath, "utf8");
const modified = original.replace(/\blocal\b/, version);

if (original !== modified) {
  fs.writeFileSync(versionPath, modified);
} else {
  throw new Error("Could not update dist/version.js");
}
