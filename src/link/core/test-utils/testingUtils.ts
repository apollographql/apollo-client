import gql from 'graphql-tag';
import { execute, ApolloLink } from '../link';

const sampleQuery = gql`
  query SampleQuery {
    stub {
      id
    }
  }
`;

export function checkCalls<T>(calls: any[] = [], results: Array<T>) {
  expect(calls.length).toBe(results.length);
  calls.map((call, i) => expect(call.data).toEqual(results[i]));
}

export interface TestResultType {
  link: ApolloLink;
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

  const spy = jest.fn();
  execute(link, { query, context, variables }).subscribe({
    next: spy,
    error: error => {
      expect(error).toEqual(results.pop());
      checkCalls(spy.mock.calls[0], results);
      if (done) {
        done();
      }
    },
    complete: () => {
      checkCalls(spy.mock.calls[0], results);
      if (done) {
        done();
      }
    },
  });
}
