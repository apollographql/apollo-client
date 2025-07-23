import type { namedTypes } from "ast-types";
import type { ASTPath, Collection, Transform } from "jscodeshift";

type ImportKind = "type" | "value";

const transform: Transform = function transform(file, api) {
  const j = api.jscodeshift;
  const source = j(file.source);
  const combined: Record<string, boolean> = {};

  renameTypeSpecifier("QueryReference", "QueryRef", "@apollo/client");
  renameTypeSpecifier("QueryReference", "QueryRef", "@apollo/client/react");
  renameTypeSpecifier(
    "QueryReference",
    "QueryRef",
    "@apollo/client/react/internal"
  );

  renameTypeSpecifierToNamespace(
    "ApolloProviderProps",
    "ApolloProvider.Props",
    "@apollo/client"
  );
  renameTypeSpecifierToNamespace(
    "ApolloProviderProps",
    "ApolloProvider.Props",
    "@apollo/client/react"
  );
  renameTypeSpecifierToNamespace(
    "ErrorResponse",
    "ErrorLink.ErrorHandlerOptions",
    "@apollo/client/link/error"
  );
  renameTypeSpecifierToNamespace(
    "ErrorResponse",
    "PersistedQueryLink.DisableFunctionOptions",
    "@apollo/client/link/persisted-queries"
  );
  renameTypeSpecifierToNamespace(
    "ContextSetter",
    "SetContextLink.LegacyContextSetter",
    "@apollo/client/link/context"
  );
  moveSpecifiersToEntrypoint(
    REACT_IMPORTS_FROM_ROOT,
    "@apollo/client",
    "@apollo/client/react"
  );
  moveSpecifiersToEntrypoint(
    REACT_CONTEXT_IMPORTS,
    "@apollo/client/react/context",
    "@apollo/client/react"
  );
  moveSpecifiersToEntrypoint(
    ["QueryRef", "PreloadedQueryRef"],
    "@apollo/client/react/internal",
    "@apollo/client/react"
  );
  moveSpecifiersToEntrypoint(
    UTILITIES_INTERNAL_IMPORTS,
    "@apollo/client/utilities",
    "@apollo/client/utilities/internal"
  );
  moveSpecifierToEntrypoint(
    "__DEV__",
    "@apollo/client/utilities/global",
    "@apollo/client/utilities/environment"
  );
  moveSpecifiersToEntrypoint(
    ["invariant", "newInvariantError", "InvariantError"],
    "@apollo/client/utilities/global",
    "@apollo/client/utilities/invariant"
  );
  moveSpecifiersToEntrypoint(
    ["MockedProvider", "MockedProviderProps"],
    "@apollo/client/testing",
    "@apollo/client/testing/react"
  );

  moveAllSpecifiersToEntrypoint(
    "@apollo/client/react/hooks",
    "@apollo/client/react"
  );
  moveAllSpecifiersToEntrypoint("@apollo/client/core", "@apollo/client");
  moveAllSpecifiersToEntrypoint(
    "@apollo/client/link/core",
    "@apollo/client/link"
  );
  moveAllSpecifiersToEntrypoint(
    "@apollo/client/testing/core",
    "@apollo/client/testing"
  );

  return source.toSource();

  function isOnlySpecifier(
    name: string,
    entrypoint: string,
    importKind: ImportKind = "value"
  ) {
    if (!hasSpecifierWithKind(name, entrypoint, importKind)) {
      return false;
    }

    return (
      getImportWithKind(entrypoint, importKind)
        .find(j.ImportSpecifier)
        .size() === 1
    );
  }

  function renameTypeSpecifier(
    from: string,
    to: string,
    sourceEntrypoint: string
  ) {
    const specifier = getImport(sourceEntrypoint).find(j.ImportSpecifier, {
      imported: { name: from },
    });

    if (!specifier.size()) {
      return;
    }

    const alias = specifier.get("local", "name").value;
    const newIdentifier = j.identifier(to);

    specifier.find(j.Identifier, { name: from }).replaceWith(newIdentifier);

    if (alias === from) {
      source
        .find(j.Identifier, { name: from })
        .filter(({ parentPath }) => {
          return (
            j.TSTypeAnnotation.check(parentPath.value) ||
            j.TSTypeReference.check(parentPath.value)
          );
        })
        .replaceWith(newIdentifier);
    }
  }

  function renameTypeSpecifierToNamespace(
    from: string,
    namespace: `${string}.${string}`,
    sourceEntrypoint: string
  ) {
    const [to] = namespace.split(".");
    const sourceImports = getImport(sourceEntrypoint);

    const specifier = getSpecifier(from, sourceEntrypoint);

    if (!specifier.length) {
      return;
    }

    if (!hasSpecifier(to, sourceEntrypoint)) {
      sourceImports.insertAfter(
        j.importDeclaration(
          [j.importSpecifier(j.identifier(to))],
          j.literal(sourceEntrypoint),
          "type"
        )
      );
    }

    source
      .find(j.Identifier, { name: from })
      .filter(({ parentPath }) => {
        return (
          j.TSTypeReference.check(parentPath.value) ||
          j.TSTypeAnnotation.check(parentPath.value)
        );
      })
      .replaceWith(j.identifier(namespace));

    removeSpecifierIfUnused(specifier);
  }

  function moveSpecifiersToEntrypoint(
    specifiers: string[],
    sourceEntrypoint: string,
    targetEntrypoint: string
  ) {
    if (areAllSpecifiersFrom(specifiers, sourceEntrypoint)) {
      renameImport(sourceEntrypoint, targetEntrypoint);
    } else {
      specifiers.forEach((name) =>
        moveSpecifierToEntrypoint(name, sourceEntrypoint, targetEntrypoint)
      );
    }
  }

  function areAllSpecifiersFrom(specifiers: string[], moduleName: string) {
    return getImport(moduleName)
      .find(j.ImportSpecifier)
      .every((specifier) => {
        return specifiers.includes(specifier.value.imported.name.toString());
      });
  }

  function renameImport(from: string, to: string) {
    getImport(from).find(j.Literal).replaceWith(j.literal(to));
  }

  function moveSpecifierToEntrypoint(
    name: string,
    sourceEntrypoint: string,
    targetEntrypoint: string
  ) {
    moveSpecifier(name, "value", sourceEntrypoint, targetEntrypoint);
    moveSpecifier(name, "type", sourceEntrypoint, targetEntrypoint);
    removeImportIfEmpty(sourceEntrypoint);
  }

  function moveSpecifier(
    name: string,
    importKind: ImportKind,
    sourceEntrypoint: string,
    targetEntrypoint: string
  ) {
    combineImports(sourceEntrypoint);
    combineImports(targetEntrypoint);

    if (
      hasSpecifierWithKind(name, targetEntrypoint, importKind) ||
      !hasSpecifierWithKind(name, sourceEntrypoint, importKind)
    ) {
      return;
    }

    const specifier = getSpecifierWithKind(name, sourceEntrypoint, importKind);
    let targetImports = getImportWithKind(targetEntrypoint, importKind);

    if (!targetImports.size()) {
      const newModule = j.importDeclaration(
        [],
        j.literal(targetEntrypoint),
        importKind
      );
      getImportWithKind(sourceEntrypoint, importKind).insertAfter(newModule);
      targetImports = j(newModule);
    }

    targetImports.get("specifiers").push(specifier.paths()[0].value);
    specifier.remove();
  }

  function removeSpecifierIfUnused(
    specifier: Collection<namedTypes.ImportSpecifier>
  ) {
    if (!specifier.size()) {
      return;
    }

    const name = specifier.get("imported", "name").value;
    const isUsed = !!source
      .find(j.Identifier, { name })
      .filter((path) => {
        return path.parent.value !== specifier.get().value;
      })
      .size();

    if (!isUsed) {
      const importDeclaration = specifier.closest(j.ImportDeclaration);
      specifier.remove();
      if (importDeclaration.find(j.ImportSpecifier).size() === 0) {
        importDeclaration.remove();
      }
    }
  }

  function getImport(moduleName: string) {
    return source.find(j.ImportDeclaration, {
      source: { value: moduleName },
    });
  }

  function getImportWithKind(moduleName: string, importKind: ImportKind) {
    return source.find(j.ImportDeclaration, {
      importKind,
      source: { value: moduleName },
    });
  }

  function getSpecifierWithKind(
    name: string,
    moduleName: string,
    importKind: ImportKind
  ) {
    return getImportWithKind(moduleName, importKind).find(j.ImportSpecifier, {
      imported: { type: "Identifier", name },
    });
  }

  function getSpecifier(name: string, moduleName: string) {
    return getImport(moduleName).find(j.ImportSpecifier, {
      imported: { type: "Identifier", name },
    });
  }

  function hasSpecifier(name: string, moduleName: string) {
    return !!getSpecifier(name, moduleName).size();
  }

  function hasSpecifierWithKind(
    name: string,
    moduleName: string,
    importKind: ImportKind
  ) {
    return !!getSpecifierWithKind(name, moduleName, importKind).size();
  }

  function removeImportIfEmpty(moduleName: string) {
    const imports = getImport(moduleName);

    if (imports.size()) {
      imports.forEach((astPath) => {
        if (!astPath.value.specifiers?.length) {
          j(astPath).remove();
        }
      });
    }
  }

  function combineImports(moduleName: string) {
    if (combined[moduleName]) {
      return;
    }

    combined[moduleName] = true;

    const cache: Partial<
      Record<ImportKind, ASTPath<namedTypes.ImportDeclaration>>
    > = {};

    getImport(moduleName).forEach((astPath) => {
      const { importKind } = astPath.value;

      if (importKind !== "type" && importKind !== "value") {
        return;
      }

      const imports = (cache[importKind] ||= astPath);

      if (imports === astPath) {
        return;
      }

      astPath.value.specifiers?.forEach((specifier) => {
        imports.get("specifiers").push(specifier);
      });

      j(astPath).remove();
    });
  }

  function moveAllSpecifiersToEntrypoint(
    sourceEntrypoint: string,
    targetEntrypoint: string
  ) {
    (["value", "type"] as const).forEach((importKind) => {
      const imports = getImportWithKind(sourceEntrypoint, importKind);

      if (!imports.size()) {
        return;
      }

      imports
        .get("specifiers")
        .value.forEach((specifier: namedTypes.ImportSpecifier) => {
          moveSpecifier(
            specifier.imported.name.toString(),
            importKind,
            sourceEntrypoint,
            targetEntrypoint
          );
        });

      imports.remove();
    });
  }
};

const REACT_IMPORTS_FROM_ROOT = [
  "ApolloConsumer",
  "ApolloProvider",
  "createQueryPreloader",
  "getApolloContext",
  "skipToken",
  "useApolloClient",
  "useBackgroundQuery",
  "useFragment",
  "useLazyQuery",
  "useLoadableQuery",
  "useMutation",
  "useQuery",
  "useQueryRefHandlers",
  "useSubscription",
  "useSuspenseFragment",
  "useSuspenseQuery",
  "useReactiveVar",
  "useReadQuery",

  // Types
  "ApolloContextValue",
  "BackgroundQueryHookFetchPolicy",
  "BackgroundQueryHookOptions",
  "LazyQueryExecFunction",
  "LazyQueryHookExecOptions",
  "LazyQueryHookOptions",
  "LazyQueryResult",
  "LazyQueryResultTuple",
  "LoadableQueryFetchPolicy",
  "LoadableQueryHookOptions",
  "LoadQueryFunction",
  "MutationFunctionOptions",
  "MutationHookOptions",
  "MutationResult",
  "MutationTuple",
  "OnDataOptions",
  "OnSubscriptionDataOptions",
  "PreloadedQueryRef",
  "PreloadQueryFetchPolicy",
  "PreloadQueryFunction",
  "PreloadQueryOptions",
  "QueryHookOptions",
  "QueryRef",
  "QueryResult",
  "SkipToken",
  "SubscriptionHookOptions",
  "SubscriptionResult",
  "SuspenseQueryHookFetchPolicy",
  "SuspenseQueryHookOptions",
  "UseBackgroundQueryResult",
  "UseFragmentOptions",
  "UseFragmentResult",
  "UseLoadableQueryResult",
  "UseQueryRefHandlersResult",
  "UseReadQueryResult",
  "UseSuspenseFragmentOptions",
  "UseSuspenseFragmentResult",
  "UseSuspenseQueryResult",
];

const REACT_CONTEXT_IMPORTS = [
  "ApolloConsumer",
  "getApolloContext",
  "ApolloProvider",

  // Types
  "ApolloContextValue",
];

const UTILITIES_INTERNAL_IMPORTS = [
  "AutoCleanedStrongCache",
  "AutoCleanedWeakCache",
  "argumentsObjectFromField",
  "canUseDOM",
  "checkDocument",
  "cloneDeep",
  "compact",
  "createFragmentMap",
  "createFulfilledPromise",
  "createRejectedPromise",
  "dealias",
  "decoratePromise",
  "DeepMerger",
  "getDefaultValues",
  "getFragmentFromSelection",
  "getFragmentQueryDocument",
  "getFragmentDefinition",
  "getFragmentDefinitions",
  "getGraphQLErrorsFromResult",
  "getOperationDefinition",
  "getOperationName",
  "getQueryDefinition",
  "getStoreKeyName",
  "graphQLResultHasError",
  "hasDirectives",
  "hasForcedResolvers",
  "isArray",
  "isDocumentNode",
  "isField",
  "isNonEmptyArray",
  "isNonNullObject",
  "isPlainObject",
  "makeReference",
  "makeUniqueId",
  "maybeDeepFreeze",
  "mergeDeep",
  "mergeDeepArray",
  "mergeOptions",
  "omitDeep",
  "preventUnhandledRejection",
  "removeDirectivesFromDocument",
  "resultKeyNameFromField",
  "shouldInclude",
  "storeKeyNameFromField",
  "stringifyForDisplay",
  "toQueryResult",
  "filterMap",
  "getApolloCacheMemoryInternals",
  "getApolloClientMemoryInternals",
  "getInMemoryCacheMemoryInternals",
  "registerGlobalCache",

  // Types
  "DecoratedPromise",
  "DeepOmit",
  "FragmentMap",
  "FragmentMapFunction",
  "FulfilledPromise",
  "IsAny",
  "NoInfer",
  "PendingPromise",
  "Prettify",
  "Primitive",
  "RejectedPromise",
  "RemoveIndexSignature",
  "VariablesOption",
];

export default transform;
