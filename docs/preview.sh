#!/bin/bash

cd ../

git clone https://github.com/apollographql/docs --branch tb/local-dev --single-branch monodocs

cd monodocs

npm i

cp -r ../docs local

DOCS_LOCAL=true npm run build
