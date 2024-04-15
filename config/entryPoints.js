const entryPoints = [
  { dirs: [], bundleName: "main" },
  { dirs: ["cache"] },
  { dirs: ["core"] },
  { dirs: ["dev"] },
  { dirs: ["errors"] },
  { dirs: ["link", "batch"] },
  { dirs: ["link", "batch-http"] },
  { dirs: ["link", "context"] },
  { dirs: ["link", "core"] },
  { dirs: ["link", "error"] },
  { dirs: ["link", "http"] },
  { dirs: ["link", "persisted-queries"] },
  { dirs: ["link", "retry"] },
  { dirs: ["link", "remove-typename"] },
  { dirs: ["link", "schema"] },
  { dirs: ["link", "subscriptions"] },
  { dirs: ["link", "utils"] },
  { dirs: ["link", "ws"] },
  { dirs: ["react"] },
  { dirs: ["react", "components"] },
  { dirs: ["react", "context"] },
  { dirs: ["react", "hoc"] },
  { dirs: ["react", "hooks"] },
  { dirs: ["react", "internal"] },
  { dirs: ["react", "parser"] },
  { dirs: ["react", "ssr"] },
  { dirs: ["testing"], extensions: [".js", ".jsx"] },
  { dirs: ["testing", "core"] },
  { dirs: ["testing", "experimental"] },
  { dirs: ["utilities"] },
  { dirs: ["utilities", "subscriptions", "relay"] },
  { dirs: ["utilities", "subscriptions", "urql"] },
  { dirs: ["utilities", "globals"], sideEffects: true },
];

const lookupTrie = Object.create(null);
entryPoints.forEach((info) => {
  let node = lookupTrie;
  info.dirs.forEach((dir) => {
    const dirs = node.dirs || (node.dirs = Object.create(null));
    node = dirs[dir] || (dirs[dir] = { isEntry: false });
  });
  node.isEntry = true;
});

exports.forEach = function (callback, context) {
  entryPoints.forEach(callback, context);
};

exports.map = function map(callback, context) {
  return entryPoints.map(callback, context);
};

const path = require("path").posix;

exports.check = function (id, parentId) {
  const resolved = path.resolve(path.dirname(parentId), id);
  const importedParts = partsAfterDist(resolved);

  if (importedParts) {
    const entryPointIndex = lengthOfLongestEntryPoint(importedParts);
    if (entryPointIndex === importedParts.length) {
      return true;
    }

    if (entryPointIndex >= 0) {
      const parentParts = partsAfterDist(parentId);
      const parentEntryPointIndex = lengthOfLongestEntryPoint(parentParts);
      const sameEntryPoint =
        entryPointIndex === parentEntryPointIndex &&
        arraysEqualUpTo(importedParts, parentParts, entryPointIndex);

      // If the imported ID and the parent ID have the same longest entry
      // point prefix, then this import is safely confined within that
      // entry point. Returning false lets Rollup know this import is not
      // external, and can be bundled into the CJS bundle that we build
      // for this shared entry point.
      if (sameEntryPoint) {
        return false;
      }

      console.warn(
        `Risky cross-entry-point nested import of ${id} in ${partsAfterDist(
          parentId
        ).join("/")}`
      );
    }
  }

  return false;
};

function partsAfterDist(id) {
  const parts = id.split(path.sep);
  const distIndex = parts.lastIndexOf("dist");
  if (/^index.jsx?$/.test(parts[parts.length - 1])) {
    parts.pop();
  }
  if (distIndex >= 0) {
    return parts.slice(distIndex + 1);
  }
}

exports.getEntryPointDirectory = function (file) {
  const parts = partsAfterDist(file) || file.split(path.sep);
  const len = lengthOfLongestEntryPoint(parts);
  if (len >= 0) return parts.slice(0, len).join(path.sep);
};

function lengthOfLongestEntryPoint(parts) {
  let node = lookupTrie;
  let longest = -1;
  for (let i = 0; node && i < parts.length; ++i) {
    if (node.isEntry) longest = i;
    node = node.dirs && node.dirs[parts[i]];
  }
  if (node && node.isEntry) {
    return parts.length;
  }
  return longest;
}

function arraysEqualUpTo(a, b, end) {
  for (let i = 0; i < end; ++i) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

exports.buildDocEntryPoints = () => {
  const dist = path.resolve(__dirname, "../dist");
  const entryPoints = exports.map((entryPoint) => {
    return `export * from "${dist}/${entryPoint.dirs.join("/")}/index.d.ts";`;
  });
  entryPoints.push(
    `export * from "${dist}/react/types/types.documentation.ts";`
  );
  return entryPoints.join("\n");
};
