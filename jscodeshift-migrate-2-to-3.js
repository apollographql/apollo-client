/**
 * This jscodeshift transform takes care of some of the rote
 * things you'll need to do while migrating from v2 to v3.
 * Currently it:
 *   - Replaces @apollo/react-hooks imports with
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

    // Replace `apollo-client` with `@apollo/client`
    renameImport('apollo-client', '@apollo/client');

    // TODO: Create if @apollo/client doesn't exist.
    // source.find(j.Program).replaceWith(p => ({
    //     ...p.value,
    //     body: [
    //         {
    //             type: 'ImportDeclaration',
    //             specifiers: specifiers.map(
    //                 importSpecifier,
    //             ),
    //             source: {
    //                 type: 'Literal',
    //                 value: '@apollo/client',
    //             },
    //         },
    //         ...p.value.body,
    //     ],
    // }));

    moveSpecifiersToApolloClient('@apollo/react-hooks', []);
    moveSpecifiersToApolloClient('apollo-cache-inmemory', ['InMemoryCache']);
    moveSpecifiersToApolloClient('graphql-tag', []);
    moveSpecifiersToApolloClient('apollo-link', []);
    moveSpecifiersToApolloClient('apollo-link-http', []);
    moveSpecifiersToApolloClient('apollo-link-http-common', []);

    renameImport('@apollo/react-components', '@apollo/client/react/components');
    renameImport('@apollo/react-hoc', '@apollo/client/react/hoc');
    renameImport('@apollo/react-ssr', '@apollo/client/react/ssr');
    renameImport('@apollo/react-testing', '@apollo/client/testing');

    return source.toSource();

    function moveSpecifiersToApolloClient(
        moduleName,
        specifiers,
    ) {
        const moduleImport = getImport(moduleName);
        moduleImport.remove();
        if (moduleImport.size()) {
            const clientImports = getImport('@apollo/client');
            if (clientImports.size()) {
                clientImports.replaceWith(p => ({
                    ...p.value,
                    specifiers: [
                        ...specifiers.map(importSpecifier),
                        ...p.value.specifiers,
                    ],
                }));
            }
        }
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

// Warn about apollo-boost?
// Warn about graphql-anywhere?
// Warn about graphql-tag?
