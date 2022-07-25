/**
 * This jscodeshift transform takes care of some of the rote things you'll
 * need to do while migrating from v3 to v4. See README.md for usage
 * instructions and further explanation.
 *
 */

// TODO: Improve this
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
    let modules = []
    
    pruneOldImports();

    return source.toSource();

    function pruneOldImports() {
        return source
        .find(j.ImportDeclaration)
        .filter(impDecNodePath => impDecNodePath.value.source.value === '@apollo/client')
        .forEach(impDecNodePathFiltered => {
          const apolloClientReact = getApolloClientReact(impDecNodePathFiltered);
          j(impDecNodePathFiltered)
            // find ImportSpecifier here instead of Identifier
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
            console.log("Not found!")
            apolloClientReact = j.importDeclaration([], j.literal('@apollo/client/react'))
             j(impDecNodePathFiltered).at(0).insertBefore(() => apolloClientReact);
             console.log(apolloClientReact)
        } else {
            console.log("Found!")
            apolloClientReact = apolloClientReact.at(0).at(0)
            console.log(apolloClientReact)
        }
        return apolloClientReact;
    }

    
    
  }
  