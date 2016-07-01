sleep 5
nodemon --watch lib --exec 'npm run testonly && npm run lint' --delay 0.5
