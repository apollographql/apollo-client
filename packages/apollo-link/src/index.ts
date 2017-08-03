import ApolloLink from 'apollo-link-core';

import HttpLink from 'apollo-link-http';
import RetryLink from 'apollo-link-retry';
import SetContextLink from 'apollo-link-set-context';
import PollingLink from 'apollo-link-polling';

export * from 'apollo-link-core';

export { HttpLink, RetryLink, SetContextLink, PollingLink };

export default ApolloLink;
