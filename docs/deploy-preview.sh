#!/bin/bash

git clone https://github.com/apollographql/docs --branch tb/local-dev --single-branch monodocs

cd monodocs

npm i

DOCS_PATH=../docs npm run build
