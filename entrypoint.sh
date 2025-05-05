#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

echo "🔄 Starting GitHub Issue Assistant..."

# --- Verify Persistent Storage ---
if [ -d "/data" ] && touch /data/.storage_test 2>/dev/null; then
  echo "✅ Persistent storage connected and writable"
  rm /data/.storage_test
else
  echo "❌ WARNING: Persistent storage not connected or not writable!"
  echo "    Credentials will not persist between container restarts."
  echo "    Make sure to use '-v claudevzzz-data:/data' in your docker run command."
fi

# --- Credential Setup ---
# Ensure persistent directories exist on the host volume (/data)
mkdir -p /data/.config/gh /data/.claude

# Ensure the home directory exists in the container
# Use $HOME which is typically /root when running as root
mkdir -p "$HOME/.config"
chmod 755 "$HOME" "$HOME/.config"

# STEP 1: Remove any existing credential files and directories to start clean
# This ensures we don't have stale or corrupted files
rm -rf "$HOME/.config/gh" "$HOME/.claude" "$HOME/.claude.json"

# STEP 2: Create symbolic links for GitHub credentials
ln -sf /data/.config/gh "$HOME/.config/gh"
echo "✅ Linked ~/.config/gh -> /data/.config/gh"

# STEP 3: Handle Claude credentials
# Create directories if they don't exist
mkdir -p "$HOME/.claude"
chmod 700 "$HOME/.claude"

# Copy config file if it exists
if [ -f "/data/.claude.json" ]; then
  cp -f /data/.claude.json "$HOME/.claude.json"
  chmod 600 "$HOME/.claude.json"
  echo "✅ Copied Claude config from /data/.claude.json"
fi

# Copy all files from persistent Claude directory
if [ -d "/data/.claude" ]; then
  # Remove destination directory contents without removing the directory itself
  rm -rf "$HOME/.claude"/* 2>/dev/null || true
  
  # Copy all files from persistent storage
  cp -rf /data/.claude/. "$HOME/.claude/"
  chmod -R 700 "$HOME/.claude"
  # Set stricter permissions on sensitive files
  chmod 600 "$HOME/.claude"/*.json 2>/dev/null || true
  chmod 600 "$HOME/.claude/.credentials.json" 2>/dev/null || true
  echo "✅ Copied Claude credentials from /data/.claude/"
  
  # Debug output to help diagnose issues
  echo "  - Claude credential files:"
  ls -la "$HOME/.claude/" 2>/dev/null || echo "  (No files found)"
fi

# Add a cleanup function to save credentials back to the volume on exit
save_credentials() {
  echo "🔄 Saving credentials before exit..."
  
  # Save Claude files back to volume
  if [ -d "$HOME/.claude" ] && [ -n "$(ls -A "$HOME/.claude" 2>/dev/null)" ]; then
    # Ensure destination directory exists
    mkdir -p /data/.claude
    
    # Copy all files, preserving permissions
    cp -rf "$HOME/.claude/." /data/.claude/
    chmod -R 700 /data/.claude
    # Set stricter permissions on sensitive files
    chmod 600 /data/.claude/*.json 2>/dev/null || true
    chmod 600 /data/.claude/.credentials.json 2>/dev/null || true
    echo "✅ Saved Claude credentials to /data/.claude/"
  fi
  
  # Save main config file if it exists
  if [ -f "$HOME/.claude.json" ]; then
    cp -f "$HOME/.claude.json" /data/.claude.json
    chmod 600 /data/.claude.json
    echo "✅ Saved Claude main config to /data/.claude.json"
  fi
}

# Register the save function to run on exit
trap save_credentials EXIT HUP INT TERM

echo "✅ Credentials setup complete"

# --- Authentication Checks ---
echo "🔍 Checking authentication:"
GITHUB_AUTH_NEEDED=false
CLAUDE_AUTH_NEEDED=false

# Check GitHub auth by looking for the configuration file.
if [ -f "$HOME/.config/gh/hosts.yml" ] || [ -d "$HOME/.config/gh/hosts.yml.d" ]; then
  echo "✅ GitHub CLI (found config)"
else
  echo "❌ GitHub CLI needs authentication."
  GITHUB_AUTH_NEEDED=true
fi

# Check if Claude credentials exist in any of the possible locations
if [ -f "$HOME/.claude/.credentials.json" ] || [ -f "$HOME/.claude.json" ]; then
  echo "✅ Claude CLI (found credentials)"
  # List credential files for debugging
  echo "  - Credential files:"
  find "$HOME/.claude" -type f -name "*.json" 2>/dev/null | xargs ls -la 2>/dev/null || echo "  No JSON files found in $HOME/.claude"
  if [ -f "$HOME/.claude.json" ]; then
    echo "  - Main config: $HOME/.claude.json"
  fi
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
     echo "   - Run: claude auth login"
     echo "   - IMPORTANT: This will start the login flow"
     echo "   - Your credentials will be automatically saved on container exit"
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

    # Modify the cleanup function to include dev server shutdown before credential backup
    dev_cleanup() {
        echo "🧹 Cleaning up background processes..."
        # Check if VITE_PID is set and refers to a running process
        if [ -n "$VITE_PID" ] && ps -p $VITE_PID > /dev/null; then
            kill $VITE_PID
            wait $VITE_PID 2>/dev/null # Wait for it to actually terminate
        fi
        echo " R.I.P dev server"
        
        # Run the original save_credentials function to ensure credentials are saved
        save_credentials
    }

    # Update the trap to use our combined cleanup function
    trap dev_cleanup EXIT HUP INT TERM

    # Start the Vite client dev server in the background
    echo "🔄 Starting Vite client dev server..."
    npm run client:dev &
    VITE_PID=$!
    echo "   - Vite PID: $VITE_PID"

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