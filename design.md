# Design principles of the Apollo Client

If we are building a client-side GraphQL client and cache, we should have some goals that carve out our part of that space. These are the competitive advantages we believe this library will have over others that implement a similar set of functionality.

## Principles

1. Functional - the application developer should get real value out of using this library. This benefits both the application developer and the end user to achieve performance, usability, and simplicity of app implementation. It should have more features than [Lokka](https://github.com/kadirahq/lokka) but less than [Relay](https://github.com/facebook/relay). 
1. Transparent - a developer should be able to keep everything the Apollo Client is doing in their mind at once. They don't necessarily need to understand every part of the implementation, but nothing it's doing should be a surprise. This should take precedence over fine-grained performance optimizations.
1. Standalone - the published library should not depend on any specific build or runtime environment, view framework, router, philosophy, or other. When you install it via NPM, the batteries are included. Anything that isn't included, like certain polyfills, is clearly documented.
1. Compatible - the Apollo Client should be compatible with as many GraphQL schemas, transports, and execution models as possible. There might be optimizations that rely on specific server-side features, but as much as possible it should "just work".
1. Usable - given the above, developer experience should be a priority. The API for the developer should have a simple mental model, a minimal surface area, and be clearly documented.

## Implementation

I think the principles above place the following constraints on the implementation:

### Necessary features

I think there is a "minimum viable" set of features for a good GraphQL client. Almost all GraphQL clients that aren't Relay don't have some of these features, and the necessity to have them is what requires people to buy into all of Relay. Based on talking to some developers, I believe that list includes:

1. Optimistic UI for mutations
2. A cache so that you don't refetch data you already have
3. The ability to manually refetch data when you know it has changed
4. The ability to preload data you might need later
5. Minimal server roundtrips to render the initial UI
6. Query aggregation from your UI tree

### Stateless, well-documented store format

All state of the GraphQL cache should be kept in a single immutable state object (referred to as the "store"), and every operation on the cache should be implemented as a function from the previous store object to a new one. The store format should be easy to understand by the application developer, rather than an implementation detail of the library.

This will have many benefits compared to other approaches:

1. Simple debugging/testing both of the Apollo client itself and apps built with it, by making it possible to analyze the store contents directly and step through the different states
2. Trivial optimistic UI using time-traveling and reordering of actions taken on the store
3. Easy integration of extensions/middlewares by sharing a common data interchange format

To enable this, we need to have clear documentation about the format of this store object, so that people can write extensions around it and be sure that they will remain compatible.

### Lowest-common-denominator APIs between modules

APIs between the different parts of the library should be in simple, standard, easy-to-understand formats. We should avoid creating Apollo-specific representations of queries and data, and stick to the tools available - GraphQL strings, the standard GraphQL AST, selection sets, etc.

If we do invent new data interchange APIs, they need to be clearly documented, have a good and documented reason for existing, and be stable so that plugins and extensions can use them.

### Simple modules, each with a clear purpose

There are many utilities that any smart GraphQL cache will need around query diffing, reading a cache, etc. These should be written in a way that it would make sense to use them in any GraphQL client. In short, this is a set of libraries, not a framework.

Each module should have minimal dependencies on the runtime environment. For example, the network layer can assume HTTP, but not any other part.
