# Variables and arguments handling

## Motivation
ApolloClient currently requires every variable that is defined to be provided in a query/mutation, and it does not support default values. 

## Proposed feature / solution
We should change ApolloClient to enforce only the presence of required variables, and set default values where they are provided. In order to still be
able to check required arguments, ApolloClient should throw an error if a variable is provided without having been declared.


## Implementation steps / changes needed
1. `storeUtils` should be used via graphql-anyhwere
2. In graphql-anywhere, storeUtils should not throw any more when a variable doesn't exist but assume it to be `undefined` instead.
3. The `graphql` function in graphql-anywhere should check the query to make sure all _required_ nonNull arguments are present or have a default.
4. The `graphql` function in graphql-anywhere should set variables to their specified default values if they haven't been provided.
5. The `graphql` function in graphql-anywhere should throw an error if a provided variable has not been declared.
6. We should consider updating `watchQuery`, `query`, `mutate` and `subscribe` in Apollo Client to do the same variable sanity-checking and setting of default variables.

## Changes to the external API
* ApolloClient will support not declaring optional arguments
* ApolloClient will support providing default values
* ApolloClient will throw an error if a variable is used without having been declared
