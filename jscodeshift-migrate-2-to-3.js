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

    // Replace `@apollo/react-hooks` with `@apollo/client`

    source
        .find(j.ImportDeclaration)
        .filter(
            path =>
                path.value.source.value ===
                '@apollo/react-hooks',
        )
        .find(j.Literal)
        .replaceWith(path => ({
            ...path.value,
            value: '@apollo/client',
        }));

    // Move import specifiers from `gql` and `apollo-link`
    // modules to `@apollo/client`:

    moveSpecifiersToApolloClient('graphql-tag', ['gql']);
    moveSpecifiersToApolloClient('apollo-link', ['Observable']);

    return source.toSource();

    function moveSpecifiersToApolloClient(
        moduleName,
        specifiers,
    ) {
        const moduleImport = getImport(moduleName);
        moduleImport.remove();
        if (moduleImport.size()) {
            const clientImports = source
                .find(j.ImportDeclaration)
                .filter(
                    path =>
                        path.value.source.value ===
                        '@apollo/client',
                );
            if (clientImports.size()) {
                clientImports.replaceWith(p => ({
                    ...p.value,
                    specifiers: [
                        ...specifiers.map(importSpecifier),
                        ...p.value.specifiers,
                    ],
                }));
            } else {
                source.find(j.Program).replaceWith(p => ({
                    ...p.value,
                    body: [
                        {
                            type: 'ImportDeclaration',
                            specifiers: specifiers.map(
                                importSpecifier,
                            ),
                            source: {
                                type: 'Literal',
                                value: '@apollo/client',
                            },
                        },
                        ...p.value.body,
                    ],
                }));
            }
        }
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
