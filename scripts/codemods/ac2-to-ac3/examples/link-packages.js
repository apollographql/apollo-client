import { ApolloLink, Observable } from 'apollo-link';
import { HttpLink } from 'apollo-link-http';
import { BatchLink } from 'apollo-link-batch';
import { BatchHttpLink } from 'apollo-link-batch-http';
import { setContext } from 'apollo-link-context';
import { ErrorLink } from 'apollo-link-error';
import {
  VERSION,
  createPersistedQueryLink,
} from 'apollo-link-persisted-queries';
import { RetryLink } from 'apollo-link-retry';
import { WebSocketLink } from 'apollo-link-ws';
// This package was unusual for having a default export.
import SchemaLink from 'apollo-link-schema';
