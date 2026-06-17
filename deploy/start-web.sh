#!/bin/bash
set -euo pipefail
cd /opt/workshop-ai-link/dist/server
rm -rf /opt/workshop-ai-link/.wrangler
exec /opt/workshop-ai-link/node_modules/.bin/wrangler dev --local --port 3011 --ip 127.0.0.1
