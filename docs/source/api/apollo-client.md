---
title: Apollo Client
order: 11
description: Apollo Client API reference
---

<h2 id="apollo-client">ApolloClient</h2>

The `ApolloClient` class is the core API for Apollo, and the one you'll need to  use no matter which integration you are using:

{% tsapibox ApolloClient.constructor %}
{% tsapibox ApolloClient.watchQuery %}
{% tsapibox ApolloClient.query %}
{% tsapibox ApolloClient.mutate %}
{% tsapibox ApolloClient.readQuery %}
{% tsapibox ApolloClient.readFragment %}
{% tsapibox ApolloClient.writeQuery %}
{% tsapibox ApolloClient.writeFragment %}
{% tsapibox ApolloClient.resetStore %}
{% tsapibox ApolloClient.onResetStore %}

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

<h2 id="types">Types</h2>

{% tsapibox ApolloClientOptions %}
{% tsapibox DefaultOptions %}
{% tsapibox NetworkStatus %}
