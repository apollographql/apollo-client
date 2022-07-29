import { useQuery, useMutation, ApolloClient } from '@apollo/client';

/*
Simple case where we move some react hooks from @apollo/client to a newly created @apollo/client/react import
Should result in the following:

import { ApolloClient } from '@apollo/client';
import { useQuery, useMutation } from '@apollo/client/react';
*/
