/**
 * This jscodeshift transform takes care of some of the rote
 * things you'll need to do while migrating from v2 to v3.
 * Currently it:
 *   - Replaces apollo-client imports with
 *     @apollo/client
 *   - Removes gql imports from graphql-tag and replaces them
 *     with an import from @apollo/client
 *   - Removes Observable import from apollo-link and moves
 *     it to @apollo/client
 *
 * Author: Dmitry Minkovsky <dminkovsky@gmail.com>
 */

export default function transformer(file, api) {
    const j = api.jscodeshift;

    const source = j(file.source);

    renameImport('apollo-client', '@apollo/client');

    moveSpecifiersToApolloClient('@apollo/react-hooks');
    moveSpecifiersToApolloClient('apollo-cache-inmemory', ['InMemoryCache']);
    moveSpecifiersToApolloClient('graphql-tag');
    moveSpecifiersToApolloClient('apollo-link');
    moveSpecifiersToApolloClient('apollo-link-http');
    moveSpecifiersToApolloClient('apollo-link-http-common');

    renameImport('@apollo/react-components', '@apollo/client/react/components');
    renameImport('@apollo/react-hoc', '@apollo/client/react/hoc');
    renameImport('@apollo/react-ssr', '@apollo/client/react/ssr');
    renameImport('@apollo/react-testing', '@apollo/client/testing');

    return source.toSource();

    function moveSpecifiersToApolloClient(
        moduleName,
        specifiers = [],
    ) {
        const moduleImport = getImport(moduleName);

        if (moduleImport.size()) {
            //
            const clientImports = getImport('@apollo/client');
            if (clientImports.size()) {
                clientImports.replaceWith(p => ({
                    ...p.value,
                    specifiers: [
                        ...p.value.specifiers,
                        ...(specifiers.length ? specifiers.map(importSpecifier) : moduleImport.get().value.specifiers),
                    ],
                }));
            }
        }

        moduleImport.remove();
    }

    function renameImport(oldModuleName, newModuleName) {
        getImport(oldModuleName)
            .find(j.Literal)
            .replaceWith(path => ({
                ...path.value,
                value: newModuleName,
            }));
    }

    function getImport(moduleName) {
        return source
            .find(j.ImportDeclaration)
            .filter(
                path => path.value.source.value === moduleName,
            );
    }
}

function importSpecifier(name) {
    return {
        type: 'ImportSpecifier',
        imported: {
            type: 'Identifier',
            name,
        },
    };
}
