---
"@apollo/client": major
---

`useLazyQuery` will no longer rerender with the loading state when calling the execute function the first time unless the `notifyOnNetworkStatusChange` option is set to `true` (which is the new default).

If you prefer the behavior from 3.x, rerender the component with
`notifyOnNetworkStatusChange` set to `false` after the execute function is
called the first time.

```ts
function MyComponent() {
  const [notifyOnNetworkStatusChange, setNotifyOnNetworkStatusChange] = useState(true);
  const [execute] = useLazyQuery(query, { notifyOnNetworkStatusChange });

  async function runExecute() {
    await execute();

    // Set to false after the initial fetch to stop receiving notifications
    // about changes to the loading states.
    setNotifyOnNetworkStatusChange(false);
  }

  // ...
}
```
