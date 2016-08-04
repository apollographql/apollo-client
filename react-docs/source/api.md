---
title: API
order: 6
---

<h2 id="core">Core API</h2>

{% tsapibox ApolloClient.constructor %}
{% tsapibox createNetworkInterface %}
{% tsapibox createApolloStore %}
{% tsapibox createApolloReducer %}

<h2 id="utilities">Utilities</h2>

{% tsapibox addQueryMerging %}
{% tsapibox readQueryFromStore %}
<!--  XXX: fix aliasing-->
{% tsapibox addTypenameToSelectionSet %}
{% tsapibox writeQueryToStore %}
{% tsapibox writeFragmentToStore %}
<!-- { tsapibox print %} -->

<h2 id="types">Types</h2>

{% tsapibox NetworkInterface %}
{% tsapibox NormalizedCache %}
{% tsapibox ApolloReducerConfig %}
{% tsapibox IdGetter %}
{% tsapibox MutationBehaviorReducerMap %}
{% tsapibox Request %}
