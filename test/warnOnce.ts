import { assert, expect } from 'chai';
import { warnOnceInDevelopment } from '../src/util/warnOnce';

let lastWarning: string | null;
let keepEnv: string;
let numCalls = 0;
let oldConsoleWarn: any;

describe('warnOnce', () => {
  beforeEach( () => {
    keepEnv = process.env.NODE_ENV;
    numCalls = 0;
    lastWarning = null;
    oldConsoleWarn = console.warn;
    console.warn = (msg: any) => { numCalls++; lastWarning = msg; };
  });
  afterEach( () => {
    process.env.NODE_ENV = keepEnv;
    console.warn = oldConsoleWarn;
  });
  it('actually warns', () => {
    process.env.NODE_ENV = 'development';
    warnOnceInDevelopment('hi');
    assert(lastWarning === 'hi');
    expect(numCalls).to.equal(1);
  });

  it('does not warn twice', () => {
    process.env.NODE_ENV = 'development';
    warnOnceInDevelopment('ho');
    warnOnceInDevelopment('ho');
    expect(lastWarning).to.equal('ho');
    expect(numCalls).to.equal(1);
  });

  it('warns two different things once each', () => {
    process.env.NODE_ENV = 'development';
    warnOnceInDevelopment('slow');
    expect(lastWarning).to.equal('slow');
    warnOnceInDevelopment('mo');
    expect(lastWarning).to.equal('mo');
    expect(numCalls).to.equal(2);
  });

  it('does not warn in production', () => {
    process.env.NODE_ENV = 'production';
    warnOnceInDevelopment('lo');
    warnOnceInDevelopment('lo');
    expect(numCalls).to.equal(0);
  });

  it('warns many times in test', () => {
    process.env.NODE_ENV = 'test';
    warnOnceInDevelopment('yo');
    warnOnceInDevelopment('yo');
    expect(lastWarning).to.equal('yo');
    expect(numCalls).to.equal(2);
  });

});
