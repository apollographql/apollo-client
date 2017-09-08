# Change log

### vNEXT
- Added utilities from hermes cache
- Added removeDirectivesFromDocument to allow cleaning of client only directives
- Added hasDirectives to recurse the AST and return a boolean for an array of directive names
- Improved performance of common store actions by memoizing addTypename and removeConnectionDirective
