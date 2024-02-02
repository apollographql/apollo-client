// The Apollo Client source that is published to npm is prepared via
// config/prepareDist.js.
//
// If a release is being manually published, npm run build (which in turn runs
// prepareDist.js via postbuild script) performs all of the necessary processing
// to prepare the release. However, if a release is being automatically
// published via Changesets, there are some additional required
// steps:
//
// - Copy the .changeset folder into "dist" so Changesets can pick up the
//   markdown changesets when generating the release.
// - Copy CHANGELOG.md into "dist" so Changesets can use it to generate release
//   notes.
// - Add both .changeset and CHANGELOG.md to an .npmignore so they are not
//   included in the published package.

const fs = require("fs");
const path = require("path");

const distRoot = `${__dirname}/../dist`;
const srcDir = `${__dirname}/..`;
const destDir = `${srcDir}/dist`;

// recursive copy function
function copyDir(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  let entries = fs.readdirSync(src, { withFileTypes: true });

  for (let entry of entries) {
    let srcPath = path.join(src, entry.name);
    let destPath = path.join(dest, entry.name);

    entry.isDirectory() ?
      copyDir(srcPath, destPath)
    : fs.copyFileSync(srcPath, destPath);
  }
}

fs.copyFileSync(`${srcDir}/CHANGELOG.md`, `${destDir}/CHANGELOG.md`);
copyDir(`${srcDir}/.changeset`, `${destDir}/.changeset`);
fs.writeFileSync(`${destDir}/.npmignore`, `.changeset\nCHANGELOG.md`);
