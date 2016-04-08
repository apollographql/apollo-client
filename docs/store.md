# How the store works

One of our main design goals for the Apollo Client is to make it easy to understand what is going on in your app. To this end, we want to format of the Redux store used to be clear, easy to work with manually when you need to, and relatively stable once we release a 1.0 version.

Like other GraphQL clients with built-in caching and other fancy features, the Apollo Client stores GraphQL results in a normalized format. It also keeps track of the various queries you have asked for.

## Store format

The Apollo Client store has three root keys:

- `data` The normalized response data, which is a union of all data that has been returned from fetched queries.
- `queries` A record of all queries currently being watched using `watchQuery`, and their current status.
- `mutations` A record of all mutations currently in progress, and their status. XXX do we remove mutations from the store once they are done?

XXX write more
