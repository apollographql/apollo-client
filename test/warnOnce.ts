import { assert, expect } from 'chai';
import { warnOnce } from '../src/util/warnOnce';

let lastWarning: string | null;
let numCalls = 0;
let oldConsoleWarn: any;

describe('warnOnce', () => {
  beforeEach( () => {
    numCalls = 0;
    lastWarning = null;
    oldConsoleWarn = console.warn;
    console.warn = (msg: any) => { numCalls++; lastWarning = msg; };
  });
  afterEach( () => {
    console.warn = oldConsoleWarn;
  });
  it('actually warns', () => {
    warnOnce('hi');
    assert(lastWarning === 'hi');
    expect(numCalls).to.equal(1);
  });

  it('does not warn twice', () => {
    warnOnce('ho');
    warnOnce('ho');
    expect(lastWarning).to.equal('ho');
    expect(numCalls).to.equal(1);
  });

  it('warns two different things once', () => {
    warnOnce('slow');
    expect(lastWarning).to.equal('slow');
    warnOnce('mo');
    expect(lastWarning).to.equal('mo');
    expect(numCalls).to.equal(2);
  });
});
