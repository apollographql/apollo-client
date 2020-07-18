const entryPoints = [
  { dirs: [], bundleName: "main" },
  { dirs: ['cache'] },
  { dirs: ['core'] },
  { dirs: ['errors'] },
  { dirs: ['link', 'batch'] },
  { dirs: ['link', 'batch-http'] },
  { dirs: ['link', 'context'] },
  { dirs: ['link', 'core'] },
  { dirs: ['link', 'error'] },
  { dirs: ['link', 'http'] },
  { dirs: ['link', 'retry'] },
  { dirs: ['link', 'schema'] },
  { dirs: ['link', 'utils'] },
  { dirs: ['link', 'ws'] },
  { dirs: ['react'] },
  { dirs: ['react', 'components'] },
  { dirs: ['react', 'context'] },
  { dirs: ['react', 'data'] },
  { dirs: ['react', 'hoc'] },
  { dirs: ['react', 'hooks'] },
  { dirs: ['react', 'parser'] },
  { dirs: ['react', 'ssr'] },
  { dirs: ['utilities'] },
  { dirs: ['testing'], extensions: [".js", ".jsx"] },
];

const lookupTrie = Object.create(null);
entryPoints.forEach(info => {
  let node = lookupTrie;
  info.dirs.forEach(dir => {
    const dirs = node.dirs || (node.dirs = Object.create(null));
    node = dirs[dir] || (dirs[dir] = { isEntry: false });
  });
  node.isEntry = true;
});

exports.forEach = function(callback, context) {
  entryPoints.forEach(callback, context);
};

exports.map = function map(callback, context) {
  return entryPoints.map(callback, context);
};

const path = require("path").posix;

exports.check = function (id, parentId) {
  const resolved = path.resolve(path.dirname(parentId), id);
  const resolvedParts = resolved.split(path.sep);
  const distIndex = resolvedParts.lastIndexOf("dist");

  if (distIndex >= 0) {
    let node = lookupTrie;

    for (let i = distIndex + 1;
         node && i < resolvedParts.length;
         ++i) {
      const dir = resolvedParts[i];
      node = node && node.dirs && node.dirs[dir];
    }

    return Boolean(node && node.isEntry);
  }

  return false;
};
