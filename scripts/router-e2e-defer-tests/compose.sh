#!/bin/bash

set -e

echo -------------------------------------------------------------------------------------------
( set -x; ${ROVER_BIN:-'rover'} supergraph compose --config ./supergraph.yaml > ./supergraph.graphql)
echo -------------------------------------------------------------------------------------------
