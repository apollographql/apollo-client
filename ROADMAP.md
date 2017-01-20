# Apollo Client Roadmap to version 1.0
expected by January 2017

This roadmap serves as a rough guide of features and changes we hope to accomplish until Apollo Client 1.0. There will almost certainly be things in version 1.0 that are not in this list, and there may be the odd thing on this list that doesn't make it into version 1.0.

Since version 0.5 Apollo Client is already being used in production by many people, including Meteor Development Group. Version 1.0 will mark the point where we think we've reached a stable external API that will not see any breaking changes until version 2.0.

As a reminder, here are the goals of Apollo Client as stated in the readme file:

1. **Incrementally adoptable**, so that you can drop it into an existing JavaScript app and start using GraphQL for just part of your UI.
2. **Universally compatible**, so that Apollo works with any build setup, any GraphQL server, and any GraphQL schema.
3. **Simple to get started with**, you can start loading data right away and learn about advanced features later.
4. **Inspectable and understandable**, so that you can have great developer tools to understand exactly what is happening in your app.
5. **Built for interactive apps**, so your users can make changes and see them reflected in the UI immediately.
6. **Small and flexible**, so you don't get stuff you don't need. The core is under 40kb compressed.
7. **Community driven**, Apollo is driven by the community and serves a variety of use cases. Everything is planned and developed in the open.

By and large Apollo Client already does a very good job in all these dimensions. For version 1.0 we want to put special focus to deliver top of the class developer ergonomics. That means further improvements to **ease of adoption/use**, **simplicity** and **understandability**.

As stated before, the list below is not exhaustive. **Apollo Client is a community effort, so if there are features you would like to see in 1.0 that are not listed below, or would like to contribute to one of the items below, please say so by posting on the appropriate issue or opening a new one for discussion!**

## Features planned for 1.0

### Error handling:
- [ ] More nuanced ways of dealing with GraphQL errors, eg. the ability to deliver partial results with errors
- [ ] Useful error messages and stack traces for every error thrown by Apollo Client
- [ ] Sanity checks (and useful error messages) for all input arguments to Apollo Client

### Client-side data store integration
- [ ] Computed fields + custom resolvers to seamlessly integrate server and client-only data
- [ ] Result reducers that can work with any action dispatched to the store
- [ ] Convenience methods for interacting directly with the store (eg. get object by id)

### UI integration ergonomics
- [ ] Immutable results
- [ ] Deep-freezing of results in development mode
- [ ] `fetchMore` network status

### Performance
- [x] Query deduplication

### GraphQL features
* support for custom scalars
* fragment matching for unions + interface types
* detect cache collisions and provide warning / fix


## Refactors planned for 1.0
- [x] Simplify how polling queries work
- [x] Remove fragment handling from Apollo Client (and put it in graphql-tag)
- [ ] Streamline network interface and API for middlewares and afterwares
- [ ] Simplify core and push view-layer integration logic to the edge
- [x] Remove stopped queries from the store without breaking storeReset (#902)
- [ ] Remove custom build step to move files around before publishing to npm
- [x] Find low-hanging fruit to reduce bundle size (#684)


## Version 0.6
- [x] Completely remove fragment logic (it's in graphql-tag now)
- [ ] Refactoring of error handling
