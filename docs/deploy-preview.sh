#!/bin/bash

mv docs content

git clone https://github.com/apollographql/docs --branch tb/local-dev --single-branch

cd docs

npm i

DOCS_PATH=../content npm run build
