---
"@apollo/client": major
---

Removes `ObservableQuery.result()` method. If you use this method and need similar functionality, use the `firstValueFrom` helper in RxJS.

```ts
import { firstValueFrom, from } from "rxjs";

// The `from` is necessary to turn `observableQuery` into an RxJS observable
const result = await firstValueFrom(from(observableQuery))
```
