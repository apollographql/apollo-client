import gql from 'graphql-tag';
import fetchMock from 'fetch-mock';

import { createOperation } from '../../utils/createOperation';
import { parseAndCheckHttpResponse } from '../parseAndCheckHttpResponse';
import { itAsync } from '../../../testing';
import { ServerError } from '../../utils';

const query = gql`
  query SampleQuery {
    stub {
      id
    }
  }
`;

describe('parseAndCheckResponse', () => {
  beforeEach(() => {
    fetchMock.restore();
  });

  const operations = [createOperation({}, { query, operationName:"SampleQuery" })];

  itAsync('throws a parse error with a status code on unparsable response', (resolve, reject) => {
    const status = 400;
    fetchMock.mock('begin:/error', status);
    fetch('error')
      .then(parseAndCheckHttpResponse(operations))
      .then(reject)
      .catch(e => {
        expect(e.statusCode).toBe(status);
        expect(e.name).toBe('ServerParseError');
        expect(e).toHaveProperty('response');
        expect(e).toHaveProperty('bodyText');
        resolve();
      })
      .catch(reject);
  });

  itAsync('returns a network error with a status code and result', (resolve, reject) => {
    const status = 403;
    const body = { data: 'fail' }; //does not contain data or errors
    fetchMock.mock('begin:/error', {
      body,
      status,
    });
    fetch('error')
      .then(parseAndCheckHttpResponse(operations))
      .then(({ data, error }) => {
        const e = error.networkError as ServerError
        expect(data).toEqual('fail');
        expect(e.name).toEqual("ServerError");
        expect(e.statusCode).toEqual(status);
        expect(e).toHaveProperty('response');
        expect(e.message).toEqual(`Response not successful: Received status code ${status}.`)
        expect(e.result).toEqual(undefined)
        resolve();
      })
      .catch(reject);
  });

  itAsync('returns a server error on incorrect data', (resolve, reject) => {
    const data = { hello: 'world' }; //does not contain data or erros
    const status = 200;
    fetchMock.mock('begin:/incorrect', data);
    fetch('incorrect')
      .then(parseAndCheckHttpResponse(operations))
      .then(({ data, error }) => {
        const e = error.networkError as ServerError
        expect(data).toEqual(undefined);
        expect(e.name).toEqual("ServerError");
        expect(e.statusCode).toEqual(status);
        expect(e).toHaveProperty('response');
        const message = `Server response was missing for query '${operations.map(op => op.operationName)}'.`;
        expect(e.message).toEqual(message)
        expect(e.result).toEqual(undefined)
        resolve();
      })
      .catch(reject);
  });

  itAsync('is able to return a correct GraphQL result', (resolve, reject) => {
    const errors = ['', '' + new Error('hi')];
    const data = { data: { hello: 'world' }, errors };

    fetchMock.mock('begin:/data', {
      body: data,
    });
    fetch('data')
      .then(parseAndCheckHttpResponse(operations))
      .then(({ data, errors: e }) => {
        expect(data).toEqual({ hello: 'world' });
        expect(e.length).toEqual(errors.length);
        expect(e).toEqual(errors);
        resolve();
      })
      .catch(reject);
  });
});
