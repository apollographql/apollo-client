import type { namedTypes } from "ast-types";
import type * as j from "jscodeshift";

import type { IdentifierRename } from "./renames.js";
import type { UtilContext } from "./types.js";
import { findImportDeclarationFor } from "./util/findImportDeclarationFor.js";
import { findImportSpecifiersFor } from "./util/findImportSpecifiersFor.js";
import { findReferences } from "./util/findReferences.js";

const apolloClientInitializationTransform: j.Transform = function transform(
  file,
  api
) {
  const j = api.jscodeshift;
  const source = j(file.source);
  const context = { j, source };

  let modified = false;
  function onModified() {
    modified = true;
  }
  for (const constructorCall of apolloClientConstructions({ context })) {
    explicitLinkConstruction({ context, onModified, constructorCall });
  }

  return modified ? source.toSource() : undefined;
};
export default apolloClientInitializationTransform;

function explicitLinkConstruction({
  context,
  context: { j },
  constructorCall: { optionsPath },
  onModified,
}: {
  context: UtilContext;
  constructorCall: ConstructorCall;
  onModified: () => void;
}) {
  const prop = (name: string) => getProperty({ context, optionsPath, name });

  if (prop("link")) {
    return;
  }
  onModified();

  const uriPath = prop("uri");
  const uri = uriPath?.node;
  uriPath?.replace();

  const credentialsPath = prop("credentials");
  const credentials = credentialsPath?.node;
  credentialsPath?.replace();

  const headersPath = prop("headers");
  const headers = headersPath?.node;
  headersPath?.replace();

  const linkSpec = findOrInsertImport({
    context,
    description: {
      module: "@apollo/client/link/http",
      identifier: "HttpLink",
      alternativeModules: ["@apollo/client"],
    },
  });

  optionsPath.node.properties.push(
    j.objectProperty.from({
      key: j.identifier("link"),
      value: j.newExpression.from({
        callee: linkSpec.local || linkSpec.imported,
        arguments: [
          j.objectExpression.from({
            properties: [uri, credentials, headers].filter((prop) => !!prop),
          }),
        ],
      }),
    })
  );
}

function findOrInsertImport({
  context,
  context: { j, source },
  description,
}: {
  context: UtilContext;
  description: IdentifierRename["from"];
}) {
  const found = findImportSpecifiersFor({
    description,
    context,
    compatibleWith: "value",
  }).nodes()[0];
  if (found) {
    return found;
  }
  let addInto = findImportDeclarationFor({
    description,
    context,
    compatibleWith: "value",
  }).nodes()[0];
  if (!addInto) {
    addInto = j.importDeclaration([], j.literal(description.module));
    const program = source.find(j.Program).nodes()[0]!;
    program.body.unshift(addInto);
  }
  const spec = j.importSpecifier.from({
    imported: j.identifier(description.identifier),
  });
  (addInto.specifiers ??= []).push(spec);
  return spec;
}

function getProperty({
  context: { j },
  optionsPath,
  name,
}: {
  optionsPath: j.ASTPath<namedTypes.ObjectExpression>;
  context: UtilContext;
  name: string;
}): j.ASTPath<namedTypes.ObjectProperty> | null {
  return (
    (optionsPath.get("properties") as j.ASTPath).filter(
      (path: j.ASTPath) =>
        j.ObjectProperty.check(path.node) &&
        j.Identifier.check(path.node.key) &&
        path.node.key.name === name
    )[0] || null
  );
}

interface ConstructorCall {
  specPath: j.ASTPath<namedTypes.ImportSpecifier>;
  newExprPath: j.ASTPath<namedTypes.NewExpression>;
  optionsPath: j.ASTPath<namedTypes.ObjectExpression>;
}

function* apolloClientConstructions({
  context,
  context: { j },
}: {
  context: UtilContext;
}): Generator<ConstructorCall> {
  for (const specPath of findImportSpecifiersFor({
    description: {
      module: "@apollo/client",
      identifier: "ApolloClient",
      alternativeModules: ["@apollo/client/core"],
    },
    compatibleWith: "value",
    context,
  }).paths()) {
    for (const newExprPath of findReferences({
      context,
      identifier: (specPath.node.local || specPath.node.imported).name + "",
      scope: specPath.scope,
    })
      .map<namedTypes.NewExpression>((usage) =>
        j.NewExpression.check(usage.parentPath.node) ? usage.parentPath : null
      )
      .paths()) {
      const optionsPath = newExprPath.get("arguments", 0);
      if (optionsPath && j.ObjectExpression.check(optionsPath.node)) {
        yield {
          specPath,
          newExprPath,
          optionsPath: optionsPath as j.ASTPath<namedTypes.ObjectExpression>,
        };
      }
    }
  }
}
