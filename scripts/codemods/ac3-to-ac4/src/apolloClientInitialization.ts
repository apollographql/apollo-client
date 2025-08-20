import assert from "node:assert";

import type { namedTypes } from "ast-types";
import type * as j from "jscodeshift";

import type { UtilContext } from "./types.js";
import { findImportSpecifiersFor } from "./util/findImportSpecifiersFor.js";
import { findOrInsertImport } from "./util/findOrInsertImport.js";
import { findReferences } from "./util/findReferences.js";
import { getProperty } from "./util/getProperty.js";

const steps = {
  explicitLinkConstruction,
  clientAwareness,
  localState,
  devtoolsOption,
  prioritizeCacheValues,
} satisfies Record<string, (options: StepOptions) => void>;

export type Steps = keyof typeof steps;

const apolloClientInitializationTransform: j.Transform = function transform(
  file,
  api,
  options = {}
) {
  const j = api.jscodeshift;
  const source = j(file.source);
  const context = { j, source };

  let modified = false;
  function onModified() {
    modified = true;
  }
  const enabledStepNames =
    Array.isArray(options.apolloClientInitialization) ?
      options.apolloClientInitialization
    : Object.keys(steps);
  const enabledSteps = Object.fromEntries(
    Object.entries(steps).filter(([name]) => enabledStepNames.includes(name))
  );

  for (const constructorCall of apolloClientConstructions({ context })) {
    const options = {
      context,
      onModified,
      constructorCall,
      prop: (name: string) =>
        getProperty({
          context,
          objectPath: constructorCall.optionsPath,
          name,
        }),
    };
    for (const step of Object.values(enabledSteps)) {
      step(options);
    }
  }

  return modified ? source.toSource() : undefined;
};
export default apolloClientInitializationTransform;

interface StepOptions {
  context: UtilContext;
  constructorCall: ConstructorCall;
  onModified: () => void;
  prop: (name: string) => j.ASTPath<namedTypes.ObjectProperty> | null;
}

function explicitLinkConstruction({
  context,
  context: { j },
  constructorCall: { optionsPath },
  onModified,
  prop,
}: StepOptions) {
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
    compatibleWith: "value",
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

function clientAwareness({
  context: { j },
  constructorCall: { optionsPath },
  onModified,
  prop,
}: StepOptions) {
  const namePath = prop("name");
  const name = namePath?.node;
  namePath?.replace();

  const versionPath = prop("version");
  const version = versionPath?.node;
  versionPath?.replace();

  if (!namePath && !versionPath) {
    return;
  }
  onModified();

  optionsPath.node.properties.push(
    j.objectProperty.from({
      key: j.identifier("clientAwareness"),
      value: j.objectExpression.from({
        properties: [name, version].filter((prop) => !!prop),
      }),
    })
  );
}

function localState({
  context,
  context: { j },
  constructorCall: { specPath, optionsPath },
  onModified,
  prop,
}: StepOptions) {
  const resolversPath = prop("resolvers");
  const resolvers = resolversPath?.node;
  resolversPath?.replace();

  const typeDefsPath = prop("typeDefs");
  typeDefsPath?.replace();

  const fragmentMatcherPath = prop("fragmentMatcher");
  fragmentMatcherPath?.replace();

  if (!resolversPath && !typeDefsPath && !fragmentMatcherPath) {
    return;
  }
  onModified();
  if (!resolvers) {
    return;
  }
  const localStateSpec = findOrInsertImport({
    context,
    description: {
      module: "@apollo/client/local-state",
      identifier: "LocalState",
    },
    compatibleWith: "value",
    after: j(specPath).closest(j.ImportDeclaration),
  });

  optionsPath.node.properties.push(
    j.objectProperty.from({
      key: j.identifier("localState"),
      value: j.newExpression.from({
        callee: localStateSpec.local || localStateSpec.imported,
        arguments: [
          j.objectExpression.from({
            properties: [resolvers],
          }),
        ],
      }),
    })
  );
}

function devtoolsOption({
  context: { j },
  constructorCall: { optionsPath },
  onModified,
  prop,
}: StepOptions) {
  const devtoolsPath = prop("connectToDevTools");
  const node = devtoolsPath?.node;
  devtoolsPath?.replace();
  if (!devtoolsPath) {
    return;
  }
  onModified();

  assert(node);

  if (node.shorthand) {
    node.value = node.key;
    node.shorthand = false;
  }
  node.key = j.identifier("enabled");
  optionsPath.node.properties.push(
    j.objectProperty.from({
      key: j.identifier("devtools"),
      value: j.objectExpression.from({
        properties: [node],
      }),
    })
  );
}

function prioritizeCacheValues({
  context: { j },
  onModified,
  prop,
}: StepOptions) {
  const devtoolsPath = prop("disableNetworkFetches");
  if (!devtoolsPath) {
    return;
  }
  onModified();

  const node = devtoolsPath.node;
  if (node.shorthand) {
    node.value = node.key;
    node.shorthand = false;
  }
  node.key = j.identifier("prioritizeCacheValues");
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
