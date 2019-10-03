import gql from 'graphql-tag';
import fetchMock from 'fetch-mock';

import { createOperation } from '../../utils/createOperation';

import {
  parseAndCheckHttpResponse,
  checkFetcher,
  selectHttpOptionsAndBody,
  selectURI,
  serializeFetchParameter,
  fallbackHttpConfig,
} from '../common';

const query = gql`
  query SampleQuery {
    stub {
      id
    }
  }
`;

describe('Common Http functions', () => {
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

  describe('selectHttpOptionsAndBody', () => {
    it('includeQuery allows the query to be ignored', () => {
      const { options, body } = selectHttpOptionsAndBody(
        createOperation({}, { query }),
        { http: { includeQuery: false } },
      );
      expect(body).not.toHaveProperty('query');
    });

    it('includeExtensions allows the extensions to be added', () => {
      const extensions = { yo: 'what up' };
      const { options, body } = selectHttpOptionsAndBody(
        createOperation({}, { query, extensions }),
        { http: { includeExtensions: true } },
      );
      expect(body).toHaveProperty('extensions');
      expect((body as any).extensions).toEqual(extensions);
    });

    it('the fallbackConfig is used if no other configs are specified', () => {
      const defaultHeaders = {
        accept: '*/*',
        'content-type': 'application/json',
      };

      const defaultOptions = {
        method: 'POST',
      };

      const extensions = { yo: 'what up' };
      const { options, body } = selectHttpOptionsAndBody(
        createOperation({}, { query, extensions }),
        fallbackHttpConfig,
      );

      expect(body).toHaveProperty('query');
      expect(body).not.toHaveProperty('extensions');

      expect(options.headers).toEqual(defaultHeaders);
      expect(options.method).toEqual(defaultOptions.method);
    });

    it('allows headers, credentials, and setting of method to function correctly', () => {
      const headers = {
        accept: 'application/json',
        'content-type': 'application/graphql',
      };

      const credentials = {
        'X-Secret': 'djmashko',
      };

      const opts = {
        opt: 'hi',
      };

      const config = { headers, credentials, options: opts };

      const extensions = { yo: 'what up' };

      const { options, body } = selectHttpOptionsAndBody(
        createOperation({}, { query, extensions }),
        fallbackHttpConfig,
        config,
      );

      expect(body).toHaveProperty('query');
      expect(body).not.toHaveProperty('extensions');

      expect(options.headers).toEqual(headers);
      expect(options.credentials).toEqual(credentials);
      expect(options.opt).toEqual('hi');
      expect(options.method).toEqual('POST'); //from default
    });
  });

  describe('selectURI', () => {
    it('returns a passed in string', () => {
      const uri = '/somewhere';
      const operation = createOperation({ uri }, { query });
      expect(selectURI(operation)).toEqual(uri);
    });

    it('returns a fallback of /graphql', () => {
      const uri = '/graphql';
      const operation = createOperation({}, { query });
      expect(selectURI(operation)).toEqual(uri);
    });

    it('returns the result of a UriFunction', () => {
      const uri = '/somewhere';
      const operation = createOperation({}, { query });
      expect(selectURI(operation, () => uri)).toEqual(uri);
    });
  });

  describe('serializeFetchParameter', () => {
    it('throws a parse error on an unparsable body', () => {
      const b = {};
      const a = { b };
      (b as any).a = a;

      expect(() => serializeFetchParameter(b, 'Label')).toThrow(/Label/);
    });

    it('returns a correctly parsed body', () => {
      const body = { no: 'thing' };

      expect(serializeFetchParameter(body, 'Label')).toEqual('{"no":"thing"}');
    });
  });

  describe('checkFetcher', () => {
    let oldFetch;
    beforeEach(() => {
      oldFetch = window.fetch;
      delete window.fetch;
    });

    afterEach(() => {
      window.fetch = oldFetch;
    });

    it('throws if no fetch is present', () => {
      expect(() => checkFetcher(undefined)).toThrow(
        /fetch is not found globally/,
      );
    });

    it('does not throws if no fetch is present but a fetch is passed', () => {
      expect(() => checkFetcher(() => {})).not.toThrow();
    });
  });
});
