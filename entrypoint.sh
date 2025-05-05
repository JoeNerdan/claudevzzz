#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

echo "🔄 Starting GitHub Issue Assistant..."

# --- Credential Setup ---
# Ensure persistent directories exist on the host volume (/data)
mkdir -p /data/.config/gh /data/.claude

# Ensure the home directory and .config exist inside the container
# Use $HOME which is typically /root when running as root
mkdir -p "$HOME/.config"
mkdir -p "$HOME/.claude"
chmod 755 "$HOME" "$HOME/.config" "$HOME/.claude"

# Remove any existing potentially broken links or directories in HOME
rm -rf "$HOME/.config/gh" "$HOME/.claude"

# Create symbolic links from standard locations to persistent storage
# Tools like 'gh' and 'claude' will write to ~/.config/gh and ~/.claude,
# which will now point to the persistent /data volume.
ln -sf /data/.config/gh "$HOME/.config/gh"
# IMPORTANT: Link the entire .claude directory, not just contents
mkdir -p /data/.claude
ln -sf /data/.claude "$HOME/.claude"
echo "✅ Linked ~/.config/gh -> /data/.config/gh"
echo "✅ Linked ~/.claude -> /data/.claude"

# --- Authentication Checks ---
echo "🔍 Checking authentication:"
GITHUB_AUTH_NEEDED=false
CLAUDE_AUTH_NEEDED=false

# Check GitHub auth by looking for the configuration file.
# This is faster than running `gh auth status` but assumes the file means valid auth.
if [ -f "/data/.config/gh/hosts.yml" ] || [ -d "/data/.config/gh/hosts.yml.d" ]; then
  echo "✅ GitHub CLI (found config)"
else
  echo "❌ GitHub CLI needs authentication."
  GITHUB_AUTH_NEEDED=true
fi

# Check if Claude credentials exist
# Since HOME/.claude is now a symlink to /data/.claude, we only need to check one location
if [ -f "/data/.claude/credentials.json" ] || [ -d "/data/.claude/credentials" ]; then
  echo "✅ Claude CLI (found credentials)"
else
  echo "❌ Claude CLI needs authentication."
  CLAUDE_AUTH_NEEDED=true
fi

# --- Action Based on Auth Status ---
if [ "$GITHUB_AUTH_NEEDED" = true ] || [ "$CLAUDE_AUTH_NEEDED" = true ]; then
  echo "--------------------------------------------------"
  echo "❗ Authentication Required:"
  if [ "$GITHUB_AUTH_NEEDED" = true ]; then
    echo "   - Run: gh auth login"
  fi
  if [ "$CLAUDE_AUTH_NEEDED" = true ]; then
     echo "   - Run: claude"
     echo "   - IMPORTANT: This will start the login flow if not authenticated"
     echo "   - Your credentials will automatically be saved to the persistent storage"
     echo "   - No manual copying needed as ~/.claude is now linked to /data/.claude"
  fi
  echo "   After authenticating, exit this shell and restart the container,"
  echo "   or manually run 'npm start' or 'npm run dev' depending on your mode."
  echo "--------------------------------------------------"
  # Drop into a shell so the user can authenticate manually.
  # 'exec' replaces this script process with bash.
  exec bash
else
  echo "✅ All required services appear authenticated."

  # --- Development Mode ---
  if [ "$NODE_ENV" = "development" ]; then
    echo "🚀 Starting in DEVELOPMENT mode..."

    # Function to clean up background processes on exit
    cleanup() {
        echo "🧹 Cleaning up background processes..."
        # Check if VITE_PID is set and refers to a running process
        if [ -n "$VITE_PID" ] && ps -p $VITE_PID > /dev/null; then
            kill $VITE_PID
            wait $VITE_PID 2>/dev/null # Wait for it to actually terminate
        fi
        echo " R.I.P dev server"
    }

    # Trap signals to ensure cleanup runs
    trap cleanup SIGINT SIGTERM EXIT

    # Start the Vite client dev server in the background
    echo "🔄 Starting Vite client dev server..."
    npm run client:dev &
    VITE_PID=$!
    echo "   - Vite PID: $VITE_PID"

    # Give Vite a moment to start (optional, can be removed if proxy handles delays)
    # sleep 3 # Consider removing or making shorter

    echo "🔄 Starting Node.js backend server with nodemon..."
    # Use exec: nodemon will replace this script process.
    # When nodemon exits (or is killed), the container will stop.
    # The trap above ensures cleanup happens first.
    exec npx nodemon --watch server.js --watch routes --watch config server.js

  # --- Production Mode ---
  else
    echo "🚀 Starting in PRODUCTION mode..."
    # Ensure the client is built (this check might be redundant if build is part of Dockerfile)
    if [ ! -f "/app/public/dist/index.html" ]; then
      echo "🧱 Frontend not found, running build..."
      npm run client:build
      echo "✅ Frontend build complete."
    else
      echo "✅ Frontend already built."
    fi

    echo "🔄 Starting Node.js backend server..."
    # Use exec: The Node process replaces this script.
    # Signals like SIGTERM from 'docker stop' go directly to Node.
    exec npm start # Assumes 'npm start' runs 'node server.js'
  fi
fi