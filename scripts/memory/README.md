# Memory and Garbage Collection tests

This directory contains a few important memory-related tests that were
difficult to run within the usual Jest environment. Instead, these tests
run directly in Node.js, importing `@apollo/client` from the `../../dist`
directory, rather than from `../../src`.

## Running the tests

Run `npm install` in this directory, followed by `npm test`. Failure is
indicated by a non-zero exit code.
