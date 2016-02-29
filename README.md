# Apollo client

A simple but functional GraphQL client built on Redux for a great development experience.

In the planning stage.

--------

## Goals

### Properties

1. A simple cache format that can be understood by every user
2. A simple query AST that can be operated on to do useful things
3. No specific build tool requirement
4. A frontend-agnostic query aggregation component

### Features

1. Run any GraphQL query once, just like [Lokka](https://github.com/kadirahq/lokka)
2. Run a GraphQL query with the ability to reactively receive updates via refetching and optimistic UI
3. Optimistic updates for mutations by operating directly on the GraphQL cache
4. Ability to refetch any GraphQL query or fragment
5. Query aggregation like Relay, but without having to use a specific router or view rendering framework

### Eventual desired integrations

1. Routers
  1. Flow router
  2. React router
  3. Angular UI router
2. View layers
  1. React
  2. Blaze
  3. Angular
  4. Angular 2
  5. ... documentation for easy integration with other desired view technologies: Vue, Ember, Riot, etc
3. Data management systems
  1. Redux
  2. Tracker
  3. ... documentation for easy integration with other data management systems
