import { TextDecoder, TextEncoder } from "node:util";

import JSDOMEnvironment from "jest-environment-jsdom";

// https://github.com/facebook/jest/blob/v29.4.3/website/versioned_docs/version-29.4/Configuration.md#testenvironment-string
export default class FixJSDOMEnvironment extends JSDOMEnvironment {
  constructor(...args) {
    super(...args);

    // FIXME https://github.com/jsdom/jsdom/issues/1724
    this.global.Headers = Headers;
    this.global.Request = Request;
    this.global.Response = Response;

    this.global.TextDecoder = TextDecoder;
    this.global.TextEncoder = TextEncoder;

    this.global.structuredClone = structuredClone;

    // FIXME: setting a global fetch breaks HttpLink tests
    // and setting AbortController breaks PersistedQueryLink tests, which may
    // indicate a memory leak
    // this.global.fetch = fetch;
    this.global.AbortController = AbortController;
  }
}
