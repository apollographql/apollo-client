#!/bin/bash

cd ../

mv docs content

git clone https://github.com/apollographql/docs --branch tb/local-dev --single-branch

cd docs

npm i

cp -r ../content local

ls

ls local

DOCS_LOCAL=true npm run build
