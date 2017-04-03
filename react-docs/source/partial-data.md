---
title: Displaying Partial Data
---

Prefetching is an easy way to make your applications UI feel faster. You can use mouse events to predict the data that could be needed.
This works perfectly on the browser, but not on mobile devices. 

One solution would be to use fragments to preload even more data in a query, but loading huge amounts of data (that you probably never show to the user) is expensive.

An other way would be the splitting of huge queries into two smaller queries:
- The first one could load data which is already in the store. This means that it could be displayed instantly.
- The second query could load data which is not in the store yet.

This solution gives you the benefit of not fetching too much data, as well as the possibility to show some partial result before the server response.
