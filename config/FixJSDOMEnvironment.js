const { default: JSDOMEnvironment } = require("jest-environment-jsdom");

// https://github.com/facebook/jest/blob/v29.4.3/website/versioned_docs/version-29.4/Configuration.md#testenvironment-string
class FixJSDOMEnvironment extends JSDOMEnvironment {
  constructor(...args) {
    super(...args);

    // FIXME https://github.com/jsdom/jsdom/issues/1724
    this.global.Headers = Headers;
    this.global.Request = Request;
    this.global.Response = Response;

    // FIXME: setting a global fetch breaks HttpLink tests
    // and setting AbortController breaks PersistedQueryLink tests, which may
    // indicate a memory leak
    // this.global.fetch = fetch;
    this.global.AbortController = AbortController;
  }
}

module.exports = FixJSDOMEnvironment;
