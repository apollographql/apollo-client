# Change log


### vNext

### 1.1.3
- dependency updates
- Added getDirectivesFromDocument utility function
[PR#2974](https://github.com/apollographql/apollo-client/pull/2974)

### 1.1.2
- Add client, rest, and export directives to list of known directives [PR#2949](https://github.com/apollographql/apollo-client/pull/2949)

### 1.1.1
- Fix typo in error message for invalid argument being passed to @skip or @include directives [PR#2867](https://github.com/apollographql/apollo-client/pull/2867)

### 1.1.0
- update `getStoreKeyName` to support custom directives

### 1.0.5
- package dependency updates

### 1.0.4
- package dependency updates

### 1.0.3
- package dependency updates

### 1.0.2
- improved rollup builds

### 1.0.1
- Added config to remove selection set of directive matches test

### 1.0.0
- Added utilities from hermes cache
- Added removeDirectivesFromDocument to allow cleaning of client only directives
- Added hasDirectives to recurse the AST and return a boolean for an array of directive names
- Improved performance of common store actions by memoizing addTypename and removeConnectionDirective
