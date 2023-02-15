---
"@apollo/client": patch
---

Keep `__typename` fragment when it does not contain `@client` directive and strip out inline fragments which use a `@client` directive. Thanks @Gazler and @mtsmfm!
