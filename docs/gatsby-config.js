const themeOptions = require('gatsby-theme-apollo-docs/theme-options');

module.exports = {
  pathPrefix: '/docs/react',
  plugins: [
    {
      resolve: 'gatsby-theme-apollo-docs',
      options: {
        ...themeOptions,
        root: __dirname,
        subtitle: 'Client (React)',
        description: 'A guide to using the Apollo GraphQL Client with React',
        githubRepo: 'apollographql/apollo-client',
        defaultVersion: 2.6,
        versions: {
          2.5: 'version-2.5',
          2.4: 'version-2.4',
        },
        checkLinksOptions: {
          exceptions: [
            '/api/apollo-client/',
            '/v2.4/api/apollo-client/',
            '/v2.5/api/apollo-client/',
          ],
        },
        typescriptApiBox: {
          data: require('./docs.json'),
          filepathPrefix: 'packages/apollo-client/src/',
        },
        sidebarCategories: {
          null: [
            'index',
            'why-apollo',
            'essentials/get-started',
          ],
          'Fetching data': [
            'essentials/queries',
            'essentials/mutations',
            'advanced/subscriptions',
            'features/pagination',
            'advanced/fragments',
            'features/error-handling',
          ],
          'Managing local data': [
            'essentials/local-state',
            'advanced/caching',
          ],
          'Development & Testing': [
            'recipes/static-typing',
            'recipes/testing',
            'recipes/client-schema-mocking',
            'features/developer-tooling',
            'recipes/recompose',
          ],
          Performance: [
            'recipes/performance',
            'features/optimistic-ui',
            'features/server-side-rendering',
            'recipes/babel',
          ],
          Integrations: [
            'integrations',
            'recipes/react-native',
            'recipes/meteor',
            'recipes/webpack',
          ],
          Networking: [
            'advanced/network-layer',
            'recipes/authentication',
          ],
          'API Reference': [
            'api/apollo-client',
            'api/react-hooks',
            'api/react-ssr',
            'api/react-testing',
            'api/react-components',
            'api/react-hoc',
            'api/react-common',
          ],
          Migrating: [
            'hooks-migration',
            'advanced/boost-migration',
          ]
        },
      },
    },
  ],
};
