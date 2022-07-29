/**
 * This jscodeshift transform takes care of some of the rote things you'll
 * need to do while migrating from v3 to v4. See README.md for usage
 * instructions and further explanation.
 *
 */

// List of exports from @apollo/client/react.
const ReactImports = new Set([
    "ApolloProvider",
    "ApolloConsumer",
    "getApolloContext",
    "resetApolloContext",
    "useApolloClient",
    "useLazyQuery",
    "useMutation",
    "useQuery",
    "useSubscription",
    "useReactiveVar",
    "DocumentType",
    "operationName",
    "parser"
])

export default function transformer(file, api) {
    const j = api.jscodeshift;

    const source = j(file.source);

    pruneOldImports();

    return source.toSource();

    function pruneOldImports() {
        return source
        .find(j.ImportDeclaration)
        .filter(impDecNodePath => impDecNodePath.value.source.value === '@apollo/client')
        .forEach(impDecNodePathFiltered => {
          const apolloClientReact = getApolloClientReact(impDecNodePathFiltered);
          j(impDecNodePathFiltered)
            .find(j.ImportSpecifier)
            .forEach(impSpecNodePath => {
                const moduleName = impSpecNodePath.node.imported.name;
                if (ReactImports.has(moduleName)) {
                    j(impSpecNodePath).remove();
                    apolloClientReact.specifiers.push(j.importSpecifier(j.identifier(moduleName)));
                }
            });
        });
    }
    function getApolloClientReact(impDecNodePathFiltered) {
        let apolloClientReact = source
        .find(j.ImportDeclaration)
        .filter(impDecNodePath => impDecNodePath.value.source.value === '@apollo/client/react')
        if (!apolloClientReact.size()) {
            apolloClientReact = j.importDeclaration([], j.literal('@apollo/client/react'))
             j(impDecNodePathFiltered).at(0).insertBefore(() => apolloClientReact);
        } else {
            apolloClientReact = apolloClientReact.paths()[0].value
        }
        return apolloClientReact;
    }
  }
