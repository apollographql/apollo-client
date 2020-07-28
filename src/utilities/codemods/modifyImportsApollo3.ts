import { Transform } from "jscodeshift";
import * as tsxParser from "jscodeshift/parser/tsx";
import type { types } from "recast";
import * as recast from "recast";

const b = recast.types.builders;

// TODO: recast's exports makes it hard to obtain assignable types.

// Ignore `ImportNamespaceSpecifier` for now.
type ImportSpecifierKind =
  | types.namedTypes.ImportSpecifier
  | types.namedTypes.ImportDefaultSpecifier;

type CommentKind =
  | types.namedTypes.Line
  | types.namedTypes.Block
  | types.namedTypes.CommentLine
  | types.namedTypes.CommentBlock;

// A simple dictionary of `imports` which have changed `from` their old location
// `to` their new location.
type ImportMapping = {
  from: string;
  to: string;
  imports: "*" | string[];
};

const importMappings: { [key: string]: ImportMapping[] } = {};
const importNames = new Set<string>();

// Construct a list of original import names and mappings of imports from the
// various Apollo modules to `@apollo/client`.
const addImportMapping = (mapping: ImportMapping) => {
  const { from } = mapping;
  importNames.add(from);
  (importMappings[from] || (importMappings[from] = [])).push(mapping);
};

// Import mappings obtained from
// https://www.apollographql.com/docs/react/migrating/apollo-client-3-migration/#updating-imports.
// Note: order of execution is important.

addImportMapping({ from: "@apollo/react-hooks", to: "@apollo/client", imports: "*" });

addImportMapping({
  from: "@apollo/react-components",
  to: "@apollo/client/react/components",
  imports: "*",
});

addImportMapping({ from: "@apollo/react-hoc", to: "@apollo/client/react/ssr", imports: "*" });

addImportMapping({ from: "@apollo/react-testing", to: "@apollo/client/testing", imports: "*" });

addImportMapping({
  from: "react-apollo",
  to: "@apollo/client",
  imports: ["ApolloProvider", "MutationFunction", "useQuery", "useLazyQuery", "useMutation"],
});

addImportMapping({
  from: "apollo-boost",
  to: "@apollo/client",
  imports: [
    "ApolloClient",
    "HttpLink",
    "InMemoryCache",
    "NormalizedCacheObject",
    "Resolvers",
    "defaultDataIdFromObject",
    "gql",
  ],
});

addImportMapping({
  from: "apollo-client",
  to: "@apollo/client",
  imports: "*",
});

addImportMapping({
  from: "apollo-cache",
  to: "@apollo/client/cache",
  imports: "*",
});

addImportMapping({
  from: "apollo-cache-inmemory",
  to: "@apollo/client/cache",
  imports: "*",
});

addImportMapping({
  from: "apollo-link",
  to: "@apollo/client/utilities",
  imports: ["getOperationName"],
});

addImportMapping({
  from: "apollo-link",
  to: "@apollo/client",
  imports: "*",
});

addImportMapping({
  from: "apollo-link-http",
  to: "@apollo/client",
  imports: "*",
});

addImportMapping({
  from: "apollo-link-http-common",
  to: "@apollo/client",
  imports: "*",
});

addImportMapping({
  from: "apollo-link-batch",
  to: "@apollo/client/link/batch",
  imports: "*",
});

addImportMapping({
  from: "apollo-link-batch-http",
  to: "@apollo/client/link/batch-http",
  imports: "*",
});

addImportMapping({
  from: "apollo-link-context",
  to: "@apollo/client/link/context",
  imports: "*",
});

addImportMapping({
  from: "apollo-link-error",
  to: "@apollo/client/link/error",
  imports: "*",
});

addImportMapping({
  from: "apollo-link-retry",
  to: "@apollo/client/link/retry",
  imports: "*",
});

addImportMapping({
  from: "apollo-link-ws",
  to: "@apollo/client/link/ws",
  imports: "*",
});

addImportMapping({
  from: "apollo-utilities",
  to: "@apollo/client/utilities",
  imports: "*",
});

// Generate an `ImportDeclaration` given an import location and import specifiers.
const generateImportDeclarations = ([importLocation, importSpecifiers]: [
  string,
  ImportSpecifierKind[]
]) => {
  return b.importDeclaration.from({
    specifiers: importSpecifiers,
    source: b.literal(importLocation),
    // Assume no type imports for now.
    importKind: "value",
  });
};

// jscodeshift transform.
const transform: Transform = (fileInfo, api) => {
  // Parse AST with TSX parser.
  // TODO: this should probably be exposed by Recast as well.
  const ast = recast.parse(fileInfo.source, {
    parser: tsxParser.default(),
  });

  // Map of import location and import specifiers.
  const importDeclarationsToInsert: {
    [location: string]: ImportSpecifierKind[];
  } = {};
  // Source of the active import that we are traversing.
  let activeImportDeclarationSource = "";
  // List of comments to extract.
  let comments: CommentKind[] = [];

  // Convenience function to attach an `ImportSpecifier` to a new import location.
  const attachImportSpecifier = (location: string, importSpecifier: ImportSpecifierKind) => {
    const specifierList =
      importDeclarationsToInsert[location] || (importDeclarationsToInsert[location] = []);
    specifierList.push(importSpecifier);
  };

  const transformed = recast.visit(ast, {
    visitProgram(path) {
      // Traverse the body of the program and identify imports, ...
      this.traverse(path);

      // ... generate a new list of imports, and ...
      const newImports = Object.entries(importDeclarationsToInsert)
        .filter(([_, specifiers]) => !!specifiers.length)
        .map(generateImportDeclarations);

      // ... if there are any comments from any removed imports, we naively
      // attach them to the first new import, ...
      if (comments.length) {
        if (!newImports.length) {
          throw new Error("Comments should not have been removed if there are no new imports.");
        }

        newImports[0].comments = comments;
      }

      // ... then prepend the list of imports to the Program body.
      path.get("body").unshift(...newImports);
    },

    visitImportDeclaration(path) {
      activeImportDeclarationSource = (path.get("source", "value").value as unknown) as string;

      // We don't need to visit an `ImportDeclaration` if it's not in the list
      // of import mappings, so we return early.
      if (
        !importNames.has(activeImportDeclarationSource) &&
        // Special case for `import gql from "graphql-tag"`
        activeImportDeclarationSource !== "graphql-tag"
      ) {
        return false;
      }

      this.traverse(path);

      // If there are no longer any specifiers for the `ImportDeclaration`,
      // remove the whole AST node.
      if (!path.get("specifiers", "length").value) {
        // We do want to keep track of comments though.
        if (path.get("comments", "length").value) {
          comments = [...comments, ...path.node.comments!];
        }
        path.replace(undefined);
      }
    },

    visitImportSpecifier(path) {
      // For each import specifier, we check if the imported specifier name
      // has been shifted to a new location. The `imports` list contains an
      // array of imports which have shifted to the new module location.
      importMappings[activeImportDeclarationSource].some(({ to: newModuleLocation, imports }) => {
        const importName = path.get("imported", "name").value;

        if (imports === "*" || imports.includes(importName)) {
          attachImportSpecifier(newModuleLocation, path.node);
          path.prune();
          // Return `true` so `Array#some` exits early.
          return true;
        }

        return false;
      });

      // No need to traverse down the `ImportSpecifier` nodes.
      return false;
    },

    visitImportDefaultSpecifier(path) {
      // If there's a default specifier for `graphql-tag`, shift it to
      // `@apollo/client` as the `gql` import.
      if (activeImportDeclarationSource === "graphql-tag") {
        attachImportSpecifier(
          "@apollo/client",
          b.importSpecifier(b.identifier("gql"), path.get("local").value)
        );
        path.prune();
      }

      // No need to traverse down the `ImportDefaultSpecifier` node.
      return false;
    },
  });

  return recast.print(transformed).code;
};

export default transform;
