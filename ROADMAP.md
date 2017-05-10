# Apollo Client

This is the high-level roadmap for Apollo Client that lists our priorities for the next months.

Currently, there are three high-level priorities:

1. **Unified Apollo API for JS, iOS and Android**
    * Apollo Store with imperative GraphQL interface (design in progress)
    * Lower-level key-value store (design in progress)
    * React Native to native bridge (not started yet)

2. **Live queries**
    * Unified Apollo Network Interface (initial draft [here](https://github.com/apollographql/apollo-network-interface))
    * Unified Transport (work in progress [here](https://github.com/apollographql/subscriptions-transport-ws/pull/108))
    
3. **First-class offline support**
    * Cache invalidation, deletion & memory management (design needed)
    * Persistent storage and state (overlaps with Apollo Store)
    * Automatic retries on connectivity issues (overlaps with Unified Network Interface)
    
    
If you are interested in helping with any of the above, join the #contributing channel on the 
[Apollo Slack](http://www.apollodata.com/#slack) and let us know you're interested in becoming a contributor!
 

While the above goals are our feature focus, we are also always looking to improve developer ergonomics and performance.
If you see something that could be improved, please do not hesitate to open an issue or make a PR!
