#!/bin/bash

git clone https://github.com/apollographql/docs --branch main --single-branch

cd docs

npm i

npm i -g netlify-cli

DOCS_PATH=../source netlify build --context=deploy-preview
