---
title: API Reference (apollo-client)
order: 11
description: The API for the apollo-client package
---

<h2 id="apollo-client">ApolloClient</h2>

The `ApolloClient` class is the core API for Apollo, and the one you'll need to  use no matter which integration you are using:

{% tsapibox ApolloClient.constructor %}
{% tsapibox ApolloClient.watchQuery %}
{% tsapibox ApolloClient.query %}
{% tsapibox ApolloClient.mutate %}
{% tsapibox ApolloClient.reducer %}
{% tsapibox ApolloClient.middleware %}
{% tsapibox ApolloClient.initStore %}
{% tsapibox ApolloClient.setStore %}
{% tsapibox ApolloClient.resetStore %}

<h2 id="ObservableQuery">ObservableQuery</h2>

{% tsapibox ObservableQuery.variables %}
{% tsapibox ObservableQuery.result %}
{% tsapibox ObservableQuery.currentResult %}
{% tsapibox ObservableQuery.refetch %}
{% tsapibox ObservableQuery.setOptions %}
{% tsapibox ObservableQuery.setVariables %}
{% tsapibox ObservableQuery.fetchMore %}
{% tsapibox ObservableQuery.updateQuery %}
{% tsapibox ObservableQuery.startPolling %}
{% tsapibox ObservableQuery.stopPolling %}

<h2 id="ApolloError">ApolloError</h2>
{% tsapibox ApolloError.constructor %}
{% tsapibox ApolloError.message %}
{% tsapibox ApolloError.graphQLErrors %}
{% tsapibox ApolloError.networkError %}
{% tsapibox ApolloError.extraInfo %}

<h2 id="utilities">Utilities</h2>

{% tsapibox createNetworkInterface %}
<!--  XXX: fix aliasing-->
{% tsapibox addTypenameToSelectionSet %}

<h2 id="types">Types</h2>

{% tsapibox ApolloQueryResult %}
{% tsapibox ApolloCurrentResult %}
{% tsapibox ApolloStore %}
{% tsapibox NetworkStatus %}
{% tsapibox NetworkInterface %}
{% tsapibox NetworkInterfaceOptions %}
{% tsapibox HTTPNetworkInterface %}
{% tsapibox BatchedNetworkInterface %}
{% tsapibox NormalizedCache %}
{% tsapibox ApolloReducerConfig %}
{% tsapibox MutationBehaviorReducerArgs %}
{% tsapibox MutationArrayInsertBehavior %}
{% tsapibox MutationArrayDeleteBehavior %}
{% tsapibox MutationDeleteBehavior %}
{% tsapibox Request %}
{% tsapibox StoreObject %}
{% tsapibox FragmentMap %}
