import { useQuery, useMutation, ApolloClient } from '@apollo/client';
import { ApolloProvider, ApolloClientOptions } from '@apollo/client';
import useSubscription from '@apollo/client/react';

/*
More complicated case involving multiple apollo/client imports and an already-existing client/react import
Should result in the following:

import { ApolloClient } from '@apollo/client';
import { ApolloClientOptions } from '@apollo/client';
import useSubscription, { useQuery, useMutation, ApolloProvider } from '@apollo/client/react';
*/
