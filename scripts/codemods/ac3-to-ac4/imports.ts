import type { namedTypes } from "ast-types";
import type { ASTPath, Transform } from "jscodeshift";

type ImportKind = "type" | "value";

const transform: Transform = function transform(file, api) {
  const j = api.jscodeshift;
  const source = j(file.source);
  const combined: Record<string, boolean> = {};

  REACT_VALUE_IMPORTS.forEach((name) =>
    moveValueSpecifierToEntrypoint(
      name,
      "@apollo/client",
      "@apollo/client/react"
    )
  );

  REACT_TYPE_IMPORTS.forEach((name) => {
    moveTypeSpecifierToEntrypoint(
      name,
      "@apollo/client",
      "@apollo/client/react"
    );
    moveValueSpecifierToEntrypoint(
      name,
      "@apollo/client",
      "@apollo/client/react"
    );
  });

  // Move `gql` to `@apollo/client/react` if its the only one left
  if (
    isOnlySpecifier("gql", "@apollo/client") &&
    hasImport("@apollo/client/react")
  ) {
    moveValueSpecifierToEntrypoint(
      "gql",
      "@apollo/client",
      "@apollo/client/react"
    );
  }

  removeImportIfEmpty("@apollo/client");

  return source.toSource();

  function isOnlySpecifier(
    name: string,
    entrypoint: string,
    importKind: ImportKind = "value"
  ) {
    if (!hasSpecifier(name, entrypoint, importKind)) {
      return false;
    }

    return (
      getImportWithKind(entrypoint, importKind)
        .find(j.ImportSpecifier)
        .size() === 1
    );
  }

  function hasImport(moduleName: string, importKind: ImportKind = "value") {
    return getImportWithKind(moduleName, importKind).size() > 0;
  }

  function moveValueSpecifierToEntrypoint(
    name: string,
    sourcePath: string,
    targetPath: string
  ) {
    moveSpecifier(name, "value", sourcePath, targetPath);
  }

  function moveTypeSpecifierToEntrypoint(
    name: string,
    sourcePath: string,
    targetPath: string
  ) {
    moveSpecifier(name, "type", sourcePath, targetPath);
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
      hasSpecifier(name, targetEntrypoint, importKind) ||
      !hasSpecifier(name, sourceEntrypoint, importKind)
    ) {
      return;
    }

    const specifier = getSpecifierFrom(name, sourceEntrypoint, importKind);
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

  function getSpecifierFrom(
    name: string,
    moduleName: string,
    importKind: ImportKind
  ) {
    return source
      .find(j.ImportDeclaration, {
        importKind,
        source: { value: moduleName },
      })
      .find(j.ImportSpecifier, { imported: { type: "Identifier", name } });
  }

  function hasSpecifier(
    name: string,
    moduleName: string,
    importKind: ImportKind
  ) {
    return !!getSpecifierFrom(name, moduleName, importKind).size();
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
};

const REACT_VALUE_IMPORTS = [
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
];

const REACT_TYPE_IMPORTS = [
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

export default transform;
