---
"@apollo/client": minor
---

You can now provide a callback function as the `context` option on the `mutate` function returned by `useMutation`. The callback function is called with the value of the `context` option provided to the `useMutation` hook. This is useful if you'd like to merge the context object provided to the `useMutation` hook with a value provided to the `mutate` function.


```ts
function MyComponent() {
  const [mutate, result] = useMutation(MUTATION, {
    context: { foo: true }
  });

  async function runMutation() {
    await mutate({
      // sends context as { foo: true, bar: true }
      context: (hookContext) => ({ ...hookContext, bar: true })
    });
  }

  // ...
}
```
