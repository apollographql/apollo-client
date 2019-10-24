#!/bin/bash

tableRow() {
  printf "%-20s %-20s %-20s %-20s %-20s\n" "$1" "$2" "$3" "$4" "$5"
}

fileSize() {
  echo `ls -hl $1 | awk '{total += $5} END {print total}'`
  # echo `ls -lh $1 | awk '{print $5}'`
}

# No tree shaking - rollup, AC 3
cd ./no-tree-shaking/rollup-ac3
npm i
npm run build
noTree_Rollup_AC3_AppMinSize=$(fileSize "public/js/app-no-react.min.js")
noTree_Rollup_AC3_AppGzipSize=$(fileSize "public/js/app-no-react.min.js.gz")

# No tree shaking - rollup, AC 3, no React
cd ../rollup-ac3-no-react
npm i
npm run build
noTree_Rollup_AC3_NoReact_AppMinSize=$(fileSize "public/js/app.min.js")
noTree_Rollup_AC3_NoReact_AppGzipSize=$(fileSize "public/js/app.min.js.gz")

# No tree shaking - rollup, AC 2
cd ../rollup-ac2
npm i
npm run build
noTree_Rollup_AC2_AppMinSize=$(fileSize "public/js/app-no-react.min.js")
noTree_Rollup_AC2_AppGzipSize=$(fileSize "public/js/app-no-react.min.js.gz")

# Tree shaking - rollup, AC 3
cd ../../tree-shaking/rollup-ac3
npm i
npm run build
tree_Rollup_AC3_AppMinSize=$(fileSize "public/js/app-no-react.min.js")
tree_Rollup_AC3_AppGzipSize=$(fileSize "public/js/app-no-react.min.js.gz")
tree_Rollup_AC3_React_AppMinSize=$(fileSize "public/js/app.min.js")
tree_Rollup_AC3_React_AppGzipSize=$(fileSize "public/js/app.min.js.gz")

# Tree shaking - rollup, AC 3, no React
cd ../rollup-ac3-no-react
npm i
npm run build
tree_Rollup_AC3_NoReact_AppMinSize=$(fileSize "public/js/app.min.js")
tree_Rollup_AC3_NoReact_AppGzipSize=$(fileSize "public/js/app.min.js.gz")

# Tree shaking - rollup, AC 2
cd ../rollup-ac2
npm i
npm run build
tree_Rollup_AC2_AppMinSize=$(fileSize "public/js/app-no-react.min.js")
tree_Rollup_AC2_AppGzipSize=$(fileSize "public/js/app-no-react.min.js.gz")

# Tree shaking - webpack, AC 3
cd ../webpack-ac3
npm i
npm run build
tree_Webpack_AC3_React_AppMinSize=$(fileSize "build/static/js/*.chunk.js")
tree_Webpack_AC3_React_AppGzipSize=$(fileSize "build/static/js/*.chunk.js.gz")

# Results
clear
echo "# Apollo Client application bundle sizes"
echo ""
echo '## Sample React app (deps: @apollo/client, graphql, graphql-tag, react, react-dom)';
echo ""
echo '1. Sizes excluding "react" and "react-dom":'
echo ""
tableRow "Apollo Client" "Build Tool" "Tree Shaking" "Minified (K)" "Gzipped (K)"
tableRow "-" "-" "-" "-" "-"
tableRow "v3" "Rollup" "Yes" $tree_Rollup_AC3_AppMinSize $tree_Rollup_AC3_AppGzipSize
tableRow "v2" "Rollup" "Yes" $tree_Rollup_AC2_AppMinSize $tree_Rollup_AC2_AppGzipSize
tableRow "-" "-" "-" "-" "-"
tableRow "v3" "Rollup" "No" $noTree_Rollup_AC3_AppMinSize $noTree_Rollup_AC3_AppGzipSize
tableRow "v2" "Rollup" "No" $noTree_Rollup_AC2_AppMinSize $noTree_Rollup_AC2_AppGzipSize
echo ""
echo '2. Sizes including "react" and "react-dom":'
echo ""
tableRow "Apollo Client" "Build Tool" "Tree Shaking" "Minified (K)" "Gzipped (K)"
tableRow "-" "-" "-" "-" "-"
tableRow "v3" "Rollup" "Yes" $tree_Rollup_AC3_React_AppMinSize $tree_Rollup_AC3_React_AppGzipSize
tableRow "v3" "Webpack" "Yes" $tree_Webpack_AC3_React_AppMinSize $tree_Webpack_AC3_React_AppGzipSize
echo ""
echo "## Sample no view app (deps: @apollo/client, graphql, graphql-tag)"
echo ""
tableRow "Apollo Client" "Build Tool" "Tree Shaking" "Minified (K)" "Gzipped (K)"
tableRow "-" "-" "-" "-" "-"
tableRow "v3" "Rollup" "Yes" $tree_Rollup_AC3_NoReact_AppMinSize $tree_Rollup_AC3_NoReact_AppGzipSize
tableRow "v3" "Rollup" "No" $noTree_Rollup_AC3_NoReact_AppMinSize $noTree_Rollup_AC3_NoReact_AppGzipSize
