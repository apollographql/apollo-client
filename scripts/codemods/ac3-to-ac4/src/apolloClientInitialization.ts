import assert from "node:assert";

import type { namedTypes } from "ast-types";
import type * as j from "jscodeshift";

import type { IdentifierRename } from "./renames.js";
import type { UtilContext } from "./types.js";
import { findImportSpecifiersFor } from "./util/findImportSpecifiersFor.js";
import { findOrInsertImport } from "./util/findOrInsertImport.js";
import { findReferences } from "./util/findReferences.js";
import { getProperty } from "./util/getProperty.js";
import { monkeyPatchAstTypes } from "./util/monkeyPatchAstTypes.js";

const steps = {
  explicitLinkConstruction,
  clientAwareness,
  localState,
  devtoolsOption,
  prioritizeCacheValues,
  dataMasking,
  incrementalHandler,
} satisfies Record<string, (options: StepOptions) => void>;

export type Steps = keyof typeof steps | "removeTypeArguments";

const apolloClientInitializationTransform: j.Transform = function transform(
  file,
  api,
  options = {}
) {
  const j = api.jscodeshift;
  const source = j(file.source);
  const context = { j, source };

  monkeyPatchAstTypes(j);

  let modified = false;
  function onModified() {
    modified = true;
  }
  const enabledStepNames =
    Array.isArray(options.apolloClientInitialization) ?
      options.apolloClientInitialization
    : Object.keys(steps).concat("removeTypeArguments");
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
      file,
    };
    for (const step of Object.values(enabledSteps)) {
      step(options);
    }
  }

  // removes `TCacheShape` parameter from all `ApolloClient` usages, not just constructor calls
  if (enabledStepNames.includes("removeTypeArguments")) {
    for (const specPath of findImportSpecifiersFor({
      description: apolloClientDescription,
      context,
    }).paths()) {
      for (const refParent of findReferences({
        context,
        identifier: (specPath.node.local || specPath.node.imported).name + "",
        scope: specPath.scope,
      })
        .map((refPath) => {
          const parentPath = refPath.parentPath;
          return j.ImportSpecifier.check(parentPath.node) ? null : parentPath;
        })
        .paths()) {
        const typeParameters = refParent.get("typeParameters");
        if (typeParameters?.node?.params?.length) {
          modified = true;
          typeParameters.prune();
        }
      }
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
  file: j.FileInfo;
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

  if (resolversPath || typeDefsPath || fragmentMatcherPath) {
    onModified();
  }
  if (prop("localState")) {
    return;
  }
  onModified();
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
            properties: [resolvers].filter((prop) => !!prop),
          }),
        ],
      }),
      comments:
        resolvers ?
          []
        : [
            j.commentBlock.from({
              leading: true,
              value: `
Inserted by Apollo Client 3->4 migration codemod.
If you are not using the \`@client\` directive in your application,
you can safely remove this option.
`,
            }),
          ],
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

function dataMasking({
  context,
  context: { j, source },
  onModified,
  prop,
  file,
}: StepOptions) {
  if (!file.path.endsWith(".ts") && !file.path.endsWith(".tsx")) {
    // avoid inserting data masking types in non-TypeScript files
    return;
  }

  const dataMaskingPath = prop("dataMasking");
  const dataMasking = dataMaskingPath?.node;
  if (
    !dataMasking ||
    (j.BooleanLiteral.check(dataMasking.value) &&
      dataMasking.value.value === false) ||
    dataMasking.comments?.some((comment) =>
      CODEMOD_MARKER_REGEX("applied").test(comment.value)
    )
  ) {
    return;
  }

  onModified();
  dataMasking.comments ??= [];
  dataMasking.comments.push(
    j.commentBlock.from({
      leading: true,
      value: `
Inserted by Apollo Client 3->4 migration codemod.
Keep this comment here if you intend to run the codemod again,
to avoid changes from being reapplied.
Delete this comment once you are done with the migration.
${CODEMOD_MARKER} applied
`,
    })
  );

  insertTypeOverrideBlock({
    context,
    leadingComment: `Copy the contents of this block into a \`.d.ts\` file in your project
to enable data masking types.`,
    overridingType: {
      module: "@apollo/client/masking",
      namespace: "GraphQLCodegenDataMasking",
      identifier: "TypeOverrides",
    },
  });
}

function incrementalHandler({
  context,
  context: { j, source },
  constructorCall: { specPath, optionsPath },
  onModified,
  prop,
  file,
}: StepOptions) {
  if (prop("incrementalHandler")) {
    return;
  }
  onModified();

  const deferHandlerSpec = findOrInsertImport({
    context,
    description: {
      module: "@apollo/client/incremental",
      identifier: "Defer20220824Handler",
    },
    compatibleWith: "value",
    after: j(specPath).closest(j.ImportDeclaration),
  });

  optionsPath.node.properties.push(
    j.objectProperty.from({
      key: j.identifier("incrementalHandler"),
      value: j.newExpression.from({
        callee: deferHandlerSpec.local || deferHandlerSpec.imported,
        arguments: [],
      }),
      comments: [
        j.commentBlock.from({
          leading: true,
          value: `
Inserted by Apollo Client 3->4 migration codemod.
If you are not using the \`@defer\` directive in your application,
you can safely remove this option.
`,
        }),
      ],
    })
  );

  if (!file.path.endsWith(".ts") && !file.path.endsWith(".tsx")) {
    // avoid inserting defer types in non-TypeScript files
    return;
  }

  insertTypeOverrideBlock({
    context,
    leadingComment: `Copy the contents of this block into a \`.d.ts\` file in your project to enable correct response types in your custom links.
If you do not use the \`@defer\` directive in your application, you can safely remove this block.`,
    overridingType: {
      module: "@apollo/client/incremental",
      namespace: "Defer20220824Handler",
      identifier: "TypeOverrides",
    },
  });
}

function insertTypeOverrideBlock({
  context: { source, j },
  leadingComment,
  overridingType: { identifier, module, namespace },
}: {
  context: UtilContext;
  leadingComment: string;
  overridingType: Required<
    Pick<IdentifierRename["to"], "module" | "namespace" | "identifier">
  >;
}) {
  const program = source.find(j.Program).nodes()[0]!;
  program.body.push(
    j.emptyStatement.from({
      comments: [
        j.commentBlock.from({
          leading: true,
          value: `
Start: Inserted by Apollo Client 3->4 migration codemod.
${leadingComment}
`,
        }),
      ],
    }),
    j.importDeclaration.from({ source: j.literal("@apollo/client") }),
    j.importDeclaration.from({
      specifiers: [
        j.importSpecifier.from({
          imported: j.identifier(namespace),
        }),
      ],
      source: j.literal(module),
    }),
    j.tsModuleDeclaration.from({
      id: j.stringLiteral("@apollo/client"),
      declare: true,
      body: j.tsModuleBlock.from({
        body: [
          j.exportNamedDeclaration.from({
            declaration: j.tsInterfaceDeclaration.from({
              id: j.identifier("TypeOverrides"),
              extends: [
                j.tsExpressionWithTypeArguments.from({
                  expression: j.tsQualifiedName.from({
                    left: j.identifier(namespace),
                    right: j.identifier(identifier),
                  }),
                }),
              ],
              body: j.tsInterfaceBody.from({ body: [] }),
            }),
          }),
        ],
      }),
    }),
    j.emptyStatement.from({
      comments: [
        j.commentBlock.from({
          leading: true,
          value: `
End: Inserted by Apollo Client 3->4 migration codemod.
`,
        }),
      ],
    })
  );
}

function* apolloClientConstructions({
  context,
  context: { j },
}: {
  context: UtilContext;
}): Generator<ConstructorCall> {
  for (const specPath of findImportSpecifiersFor({
    description: apolloClientDescription,
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

const CODEMOD_MARKER = `@apollo/client-codemod-migrate-3-to-4`;
const CODEMOD_MARKER_REGEX = (keyword: string) =>
  new RegExp(`^\\s*(?:[*]?\\s*)${CODEMOD_MARKER} ${keyword}\\s*$`, "m");

const apolloClientDescription = {
  module: "@apollo/client",
  identifier: "ApolloClient",
  alternativeModules: [
    "@apollo/client/core",
    "@apollo/client-react-streaming",
    "@apollo/experimental-nextjs-app-support",
    "@apollo/client-integration-nextjs",
    "@apollo/client-integration-react-router",
    "@apollo/client-integration-tanstack-start",
  ],
};
