#!/bin/bash

# Generate environment file for cron
printenv \
  | sort \
  | awk -F= '{
      if ($1 == "HOME") {
          printf "export HOME='\''/app'\''\n"
      } else {
          printf "export %s='\''%s'\''\n", $1, $2
      }
  }' \
  > /app/.cron_env
chmod 600 /app/.cron_env
chown appuser:appgroup /app/.cron_env

# Start cron in foreground
echo "Starting Cron..."
cron -f
