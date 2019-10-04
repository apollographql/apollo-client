import gql from 'graphql-tag';
import fetchMock from 'fetch-mock';

import { createOperation } from '../../utils/createOperation';
import { parseAndCheckHttpResponse } from '../parseAndCheckHttpResponse';

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

  const operations = [createOperation({}, { query })];

  it('throws a parse error with a status code on unparsable response', done => {
    const status = 400;
    fetchMock.mock('begin:/error', status);
    fetch('error')
      .then(parseAndCheckHttpResponse(operations))
      .then(done.fail)
      .catch(e => {
        expect(e.statusCode).toBe(status);
        expect(e.name).toBe('ServerParseError');
        expect(e).toHaveProperty('response');
        expect(e).toHaveProperty('bodyText');
        done();
      })
      .catch(done.fail);
  });

  it('throws a network error with a status code and result', done => {
    const status = 403;
    const body = { data: 'fail' }; //does not contain data or errors
    fetchMock.mock('begin:/error', {
      body,
      status,
    });
    fetch('error')
      .then(parseAndCheckHttpResponse(operations))
      .then(done.fail)
      .catch(e => {
        expect(e.statusCode).toBe(status);
        expect(e.name).toBe('ServerError');
        expect(e).toHaveProperty('response');
        expect(e).toHaveProperty('result');
        done();
      })
      .catch(done.fail);
  });

  it('throws a server error on incorrect data', done => {
    const data = { hello: 'world' }; //does not contain data or erros
    fetchMock.mock('begin:/incorrect', data);
    fetch('incorrect')
      .then(parseAndCheckHttpResponse(operations))
      .then(done.fail)
      .catch(e => {
        expect(e.statusCode).toBe(200);
        expect(e.name).toBe('ServerError');
        expect(e).toHaveProperty('response');
        expect(e.result).toEqual(data);
        done();
      })
      .catch(done.fail);
  });

  it('is able to return a correct GraphQL result', done => {
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
        done();
      })
      .catch(done.fail);
  });
});
