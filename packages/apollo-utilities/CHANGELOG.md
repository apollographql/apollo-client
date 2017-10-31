# Change log

### 1.0.1
- Added config to remove selection set of directive matches test

### 1.0.0
- Added utilities from hermes cache
- Added removeDirectivesFromDocument to allow cleaning of client only directives
- Added hasDirectives to recurse the AST and return a boolean for an array of directive names
- Improved performance of common store actions by memoizing addTypename and removeConnectionDirective
