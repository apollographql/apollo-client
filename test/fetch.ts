import { assert } from 'chai';

describe('fetch', () => {
  it('will warn on startup if no global implementation exists', () => {
    const origWarn = console.warn;
    const origFetch = (global as any).fetch;

    const warnCalls: Array<Array<any>> = [];

    console.warn = (...args: Array<any>) => warnCalls.push(args);

    delete (global as any).fetch;

    assert.equal(warnCalls.length, 0);

    delete require.cache[require.resolve('../src/fetch')];
    require('../src/fetch');

    assert.equal(warnCalls.length, 1);
    assert.equal(warnCalls[0].length, 1);
    assert.equal(typeof warnCalls[0][0], 'string');

    // Put everything back the way it was.
    console.warn = origWarn;
    (global as any).fetch = origFetch;
    delete require.cache[require.resolve('../src/fetch')];
    require('../src/fetch');
  });
});
