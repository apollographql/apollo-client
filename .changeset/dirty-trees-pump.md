---
"@apollo/client": major
_tags:
  - ObservableQuery
_superseded: "by retain"
---

Unusubscribing from `ObservableQuery` while a request is in flight will no longer terminate the request by unsubscribing from the link observable.
