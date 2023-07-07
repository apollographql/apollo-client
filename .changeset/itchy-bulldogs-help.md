---
'@apollo/client': patch
---

Store React.Context instance mapped by React.createContext instance, not React.version.
Using `React.version` can cause problems with `preact`, as multiple versions of `preact` will all identify themselves as React `17.0.2`.
