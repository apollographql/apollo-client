#!/bin/bash

source "$(dirname $0)/subgraphs.sh"

echo "federation_version: 2"
echo "subgraphs:"
for subgraph in ${subgraphs[@]}; do
  url="url_$subgraph"
  schema="schema_$subgraph"
  echo "  ${subgraph}:"
  echo "    routing_url: ${!url}"
  echo "    schema:"
  echo "      file: ${!schema}"
done
