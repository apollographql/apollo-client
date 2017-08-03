import { execute, ApolloLink } from './link';
export { makePromise } from './linkUtils';
export * from './types';

import Observable from 'zen-observable-ts';

export default ApolloLink;
export { Observable, ApolloLink, execute };
