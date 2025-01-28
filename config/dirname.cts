// workaround for `entryPoints.ts` that needs access to the current directory,
// but cannot use `import.meta` as the file is required by Jest, which transpiles
// the file to CommonJS - ending up with "SyntaxError: Cannot use 'import.meta' outside a module"
module.exports = __dirname;
