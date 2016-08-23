---
title: apollo-client
order: 20
---

<h2 id="apollo-client">ApolloClient</h2>

{% tsapibox ApolloClient.constructor %}
{% tsapibox ApolloClient.watchQuery %}
{% tsapibox ApolloClient.query %}
{% tsapibox ApolloClient.mutate %}
{% tsapibox ApolloClient.reducer %}
{% tsapibox ApolloClient.middleware %}
{% tsapibox ApolloClient.initStore %}
{% tsapibox ApolloClient.setStore %}

<h2 id="utilities">Utilities</h2>

{% tsapibox createNetworkInterface %}
{% tsapibox createApolloStore %}
{% tsapibox createApolloReducer %}
{% tsapibox addQueryMerging %}
{% tsapibox readQueryFromStore %}
<!--  XXX: fix aliasing-->
{% tsapibox addTypenameToSelectionSet %}
{% tsapibox writeQueryToStore %}
{% tsapibox writeFragmentToStore %}
<!-- { tsapibox print %} -->

<h2 id="types">Types</h2>

{% tsapibox ApolloError %}
{% tsapibox QuerySubscription %}
{% tsapibox ApolloStore %}
{% tsapibox NetworkInterface %}
{% tsapibox NormalizedCache %}
{% tsapibox ApolloReducerConfig %}
{% tsapibox MutationBehaviorReducerArgs %}
{% tsapibox MutationArrayInsertBehavior %}
{% tsapibox MutationArrayDeleteBehavior %}
{% tsapibox MutationDeleteBehavior %}
{% tsapibox Request %}
{% tsapibox StoreObject %}
{% tsapibox FragmentMap %}
