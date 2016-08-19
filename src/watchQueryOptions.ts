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

export interface FetchMoreQueryOptions {
  query?: Document;
  variables?: { [key: string]: any };
}
 export interface SubscriptionOptions {
  query: Document;
  variables?: { [key: string]: any };
  fragments?: FragmentDefinition[];
  handler: (error: Object, result: Object) => void;
};

export interface GraphQLSubscriptionOptions {
  subscription: Document;
  variables?: { [key: string]: any };
  fragments?: FragmentDefinition[];
  updateFunction: (previousQueryResult: Object, options: {
    subscriptionResult: Object,
    queryVariables: Object,
  }) => Object;
};
