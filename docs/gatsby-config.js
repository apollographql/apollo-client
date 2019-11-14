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
          '3.0 beta': 'release-3.0',
          2.5: 'version-2.5',
          2.4: 'version-2.4',
        },
        checkLinksOptions: {
          exceptions: [
            '/api/apollo-client/',
            '/v3.0-beta/api/core/',
            '/v2.5/api/apollo-client/',
            '/v2.4/api/apollo-client/',
          ],
        },
        typescriptApiBox: {
          data: require('./docs.json'),
          filepathPrefix: 'packages/apollo-client/src/',
        },
        sidebarCategories: {
          null: ['index', 'why-apollo', 'get-started'],
          'Fetching data': [
            'data/queries',
            'data/mutations',
            'data/local-state',
            'data/subscriptions',
            'data/pagination',
            'data/fragments',
            'data/error-handling',
          ],
          Caching: ['caching/cache-configuration', 'caching/cache-interaction'],
          'Development & Testing': [
            'development-testing/static-typing',
            'development-testing/testing',
            'development-testing/client-schema-mocking',
            'development-testing/developer-tooling',
            'development-testing/recompose',
          ],
          Performance: [
            'performance/performance',
            'performance/optimistic-ui',
            'performance/server-side-rendering',
            'performance/babel',
          ],
          Integrations: [
            'integrations/integrations',
            'integrations/react-native',
            'integrations/meteor',
            'integrations/webpack',
          ],
          Networking: ['networking/network-layer', 'networking/authentication'],
          'API Reference': [
            'api/apollo-client',
            'api/react-hooks',
            'api/react-ssr',
            'api/react-testing',
            'api/react-components',
            'api/react-hoc',
            'api/react-common',
          ],
          Migrating: ['migrating/hooks-migration', 'migrating/boost-migration'],
        },
      },
    },
  ],
};
