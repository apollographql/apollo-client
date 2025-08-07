#!/usr/bin/env bash
babelconfig () {
cat <<'EOF'
{
  "sourceType": "module",
  "allowImportExportEverywhere": true,
  "allowReturnOutsideFunction": true,
  "startLine": 1,
  "tokens": true,
  "plugins": [
    "typescript",
    "jsx",
    "asyncGenerators",
    "decoratorAutoAccessors",
    "bigInt",
    "classPrivateMethods",
    "classPrivateProperties",
    "classProperties",
    "decorators-legacy",
    "doExpressions",
    "dynamicImport",
    "exportDefaultFrom",
    "exportExtensions",
    "exportNamespaceFrom",
    "functionBind",
    "functionSent",
    "importAttributes",
    "importMeta",
    "nullishCoalescingOperator",
    "numericSeparator",
    "objectRestSpread",
    "optionalCatchBinding",
    "optionalChaining",
    ["pipelineOperator", { "proposal": "minimal" }],
    "throwExpressions",
    "explicitResourceManagement"
  ]
}
EOF
}

node --import ./src/devLoader.js ./src/cli.js --parser babylon --parser-config=<(babelconfig) ../../../${1:-src}
