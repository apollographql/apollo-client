---
'@apollo/client': patch
---

Updates dependency versions in `package.json` by bumping:

- `@wry/context` to `^0.7.3`
- `@wry/equality` to `^0.5.6`
- `@wry/trie` to `^0.4.3`
- `optimism` to `^0.17.4`

to 1. [fix sourcemap warnings](https://github.com/benjamn/wryware/pull/497) and 2. a Codesandbox [sandpack (in-browser) bundler transpilation bug](https://github.com/codesandbox/sandpack/issues/940) with an [upstream optimism workaround](https://github.com/benjamn/optimism/pull/550).
