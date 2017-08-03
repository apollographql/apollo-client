import { assert } from 'chai';
import * as sinon from 'sinon';
import * as Links from '../link';

const sampleQuery = `
query SampleQuery {
  stub{
    id
  }
}
`;

export function checkCalls<T>(
  calls: Array<sinon.SinonSpyCall>,
  results: Array<T>,
) {
  assert.deepEqual(calls.length, results.length);
  calls.map((call, i) => assert.deepEqual(call.args[0].data, results[i]));
}

export interface TestResultType {
  link: Links.ApolloLink;
  results?: any[];
  query?: string;
  done?: () => void;
  context?: any;
  variables?: any;
}

export function testLinkResults(params: TestResultType) {
  const { link, context, variables } = params;
  const results = params.results || [];
  const query = params.query || sampleQuery;
  const done = params.done || (() => void 0);

  const spy = sinon.spy();
  Links.execute(link, { query, context, variables }).subscribe({
    next: spy,
    error: error => {
      assert(error, results.pop());
      checkCalls(spy.getCalls(), results);
      if (done) {
        done();
      }
    },
    complete: () => {
      checkCalls(spy.getCalls(), results);
      if (done) {
        done();
      }
    },
  });
}
