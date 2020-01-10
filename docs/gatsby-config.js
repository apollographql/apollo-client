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
          '3.0 beta': 'master',
          '2.6': 'version-2.6',
          '2.5': 'version-2.5',
          '2.4': 'version-2.4',
        },
        checkLinksOptions: {
          exceptions: [
            '/api/core/',
            '/v2.4/api/',
            '/v2.5/api/',
            '/v2.6/api/',
            '/v3.0-beta/api/core/'
          ],
        },
        typescriptApiBox: {
          data: require('./docs.json'),
          filepathPrefix: 'src/',
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
          Networking: [
            'networking/network-layer',
            'networking/authentication',
          ],
          'Apollo Client API': [
            'api/core',
            'api/react-hooks',
            'api/react-testing',
            'api/react-ssr',
            'api/react-components',
            'api/react-hoc'
          ],
          Migrating: ['migrating/hooks-migration', 'migrating/boost-migration'],
        },
      },
    },
  ],
};
