import {
  Document,
  FragmentDefinition,
} from 'graphql';

export interface WatchQueryOptions {
  query: Document;
  variables?: { [key: string]: any };
  forceFetch?: boolean;
  returnPartialData?: boolean;
  noFetch?: boolean;
  pollInterval?: number;
  fragments?: FragmentDefinition[];
}
