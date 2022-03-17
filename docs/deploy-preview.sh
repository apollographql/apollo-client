#!/bin/bash

git clone https://github.com/apollographql/docs --branch main --single-branch

cd docs

npm i

DOCS_PATH=../source netlify build --context=deploy-preview
