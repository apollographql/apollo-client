import type { namedTypes } from "ast-types";
import type { ASTPath, Transform } from "jscodeshift";

type ImportKind = "type" | "value";

const transform: Transform = function transform(file, api) {
  const j = api.jscodeshift;
  const source = j(file.source);
  const combined: Record<string, boolean> = {};

  [
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
  ].forEach((name) => moveValueSpecifierToEntrypoint(name, "/", "/react"));

  // Types
  [
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
  ].forEach((name) => {
    moveTypeSpecifierToEntrypoint(name, "/", "/react");
    moveValueSpecifierToEntrypoint(name, "/", "/react");
  });

  // Move `gql` to `@apollo/client/react` if its the only one left
  if (isOnlySpecifier("gql", "/") && hasImport(getEntrypoint("/react"))) {
    moveValueSpecifierToEntrypoint("gql", "/", "/react");
  }

  removeImportIfEmpty("@apollo/client");

  return source.toSource();

  function isOnlySpecifier(name: string, path: string) {
    const entrypoint = getEntrypoint(path);

    if (!hasSpecifier(name, entrypoint)) {
      return false;
    }

    return getImport(entrypoint).find(j.ImportSpecifier).size() === 1;
  }

  function hasImport(moduleName: string) {
    return getImport(moduleName).size() > 0;
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
    sourcePath: string,
    targetPath: string
  ) {
    const sourceEntrypoint = getEntrypoint(sourcePath);
    const targetEntrypoint = getEntrypoint(targetPath);

    combineImports(sourceEntrypoint);
    combineImports(targetEntrypoint);

    if (
      hasSpecifier(name, targetEntrypoint, importKind) ||
      !hasSpecifier(name, sourceEntrypoint, importKind)
    ) {
      return;
    }

    const specifier = getImportSpecifier(name, source);
    let targetImports = getImportWithKind(target, importKind);

    if (!targetImports.size()) {
      const newModule = j.importDeclaration([], j.literal(target), importKind);
      getImport(source).insertAfter(newModule);
      targetImports = j(newModule);
    }

    targetImports
      .get("specifiers")
      .push(createSpecifier(name, specifier.get("local", "name").value));

    specifier.remove();
  }

  function getImport(moduleName: string) {
    return source.find(j.ImportDeclaration, {
      source: { value: moduleName },
    });
  }

  function getImportWithKind(moduleName: string, importKind: "type" | "value") {
    return source.find(j.ImportDeclaration, {
      importKind,
      source: { value: moduleName },
    });
  }

  function getImportSpecifier(name: string, moduleName: string) {
    const imports = getImport(moduleName);

    return imports.find(j.ImportSpecifier, {
      imported: { type: "Identifier", name },
    });
  }

  function hasSpecifier(name: string, moduleName: string) {
    return !!getImport(moduleName)
      .find(j.ImportSpecifier, { imported: { type: "Identifier", name } })
      .size();
  }

  function createSpecifier(name: string, local?: string) {
    return j.importSpecifier(j.identifier(name), j.identifier(local ?? name));
  }

  function getEntrypoint(path: string) {
    return "@apollo/client" + (path === "/" ? "" : path);
  }

  function removeImportIfEmpty(moduleName: string) {
    const imports = getImport(moduleName);

    if (imports.size() && !imports.get("specifiers", "length").value) {
      imports.remove();
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

export default transform;
