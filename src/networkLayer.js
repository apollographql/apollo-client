// ensure env has promise support
import { polyfill } from 'es6-promise';
polyfill();

import fetch from 'isomorphic-fetch';

import {
  isString,
  isArray,
} from 'lodash';

class NetworkLayer {

  constructor(uri, opts = {}) {
    if (!uri) {
<<<<<<< 77b78f46d5fba4d880874f20ef2283b3771e837b
      throw new Error('A remote endpoint is required for a newtork layer');
=======
      throw new Error('A remote enpdoint is required for a newtork layer');
>>>>>>> started working on network layer following pattern of Relay
    }

    if (!isString(uri)) {
      throw new Error('Uri must be a string');
    }

    this._uri = uri;
    this._opts = { ...opts };
  }

  query(requests) {
<<<<<<< 77b78f46d5fba4d880874f20ef2283b3771e837b
    if (!isArray(requests)) {
      throw new Error('Requests must be an array of requests');
    }

    const clonedRequests = [...requests];

=======
    let clonedRequests = [];

    if (!isArray(requests)) {
      clonedRequests = [requests];
    } else {
      clonedRequests = [...requests];
    }

>>>>>>> started working on network layer following pattern of Relay
    return Promise.all(clonedRequests.map(request => (
      this._query(request).then(
        result => result.json()
      ).then(payload => {
        if (payload.hasOwnProperty('errors')) {
          const error = new Error(
            `Server request for query '${request.getDebugName()}'
            failed for the following reasons:\n\n
            ${formatRequestErrors(request, payload.errors)}`
          );
          error.source = payload;
          throw error;
        } else if (!payload.hasOwnProperty('data')) {
          throw new Error(
            `Server response was missing for query '${request.getDebugName()}'.`
          );
        } else {
          return payload;
        }
      })
    )));
  }

  _query(request) {
    return fetch(this._uri, {
      ...this._opts,
      body: JSON.stringify({
        query: request.getQueryString(),
        variables: request.getVariables(),
      }),
      headers: {
        ...this._opts.headers,
        Accept: '*/*',
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });
  }

}

<<<<<<< 77b78f46d5fba4d880874f20ef2283b3771e837b
/*

  An easy way to breakdown the errors of a query
  from https://github.com/facebook/relay/blob/master/src/network-layer/default/RelayDefaultNetworkLayer.js#L174

*/
=======
>>>>>>> started working on network layer following pattern of Relay
function formatRequestErrors(request, errors) {
  const CONTEXT_BEFORE = 20;
  const CONTEXT_LENGTH = 60;

  const queryLines = request.getQueryString().split('\n');
  return errors.map(({ locations, message }, ii) => {
    const prefix = `${(ii + 1)}. `;
    const indent = ' '.repeat(prefix.length);

    // custom errors thrown in graphql-server may not have locations
    const locationMessage = locations ?
      (`\n${locations.map(({ column, line }) => {
        const queryLine = queryLines[line - 1];
        const offset = Math.min(column - 1, CONTEXT_BEFORE);
        return [
          queryLine.substr(column - 1 - offset, CONTEXT_LENGTH),
          `${' '.repeat(offset)}^^^`,
        ].map(messageLine => indent + messageLine).join('\n');
      }).join('\n')}`) :
      '';

    return prefix + message + locationMessage;
  }).join('\n');
}

export default NetworkLayer;
