#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

echo "🔄 Starting GitHub Issue Assistant..."

# --- Credential Setup ---
# Ensure persistent directories exist on the host volume (/data)
mkdir -p /data/.config/gh /data/.claude

# Ensure the home directory exists in the container
# Use $HOME which is typically /root when running as root
mkdir -p "$HOME/.config"
chmod 755 "$HOME" "$HOME/.config"

# STEP 1: Remove any existing credential files and directories to start clean
rm -rf "$HOME/.config/gh" "$HOME/.claude" "$HOME/.claude.json"

# STEP 2: Create symbolic links for GitHub credentials
ln -sf /data/.config/gh "$HOME/.config/gh"
echo "✅ Linked ~/.config/gh -> /data/.config/gh"

# STEP 3: Handle Claude credentials with care (fixed approach)
# Handle the main configuration file first - direct copy instead of symlink
if [ -f "/data/.claude.json" ]; then
  cp -f /data/.claude.json "$HOME/.claude.json"
  chmod 600 "$HOME/.claude.json"
  echo "✅ Copied Claude config from /data/.claude.json to $HOME/.claude.json"
fi

# Only create ~/.claude directory if it doesn't exist
if [ ! -d "$HOME/.claude" ]; then
  mkdir -p "$HOME/.claude"
  chmod 700 "$HOME/.claude"
  echo "✅ Created ~/.claude directory"
fi

# Copy individual credential files from persistent storage instead of symlinking the directory
if [ -f "/data/.claude/.credentials.json" ]; then
  cp -f /data/.claude/.credentials.json "$HOME/.claude/.credentials.json" 
  chmod 600 "$HOME/.claude/.credentials.json"
  echo "✅ Copied Claude credentials from /data/.claude/.credentials.json"
fi

# Add a cleanup function to save credentials back to the volume on exit
save_credentials() {
  echo "🔄 Saving credentials before exit..."
  
  # Save Claude config back to volume
  if [ -f "$HOME/.claude.json" ]; then
    cp -f "$HOME/.claude.json" /data/.claude.json
    chmod 600 /data/.claude.json
    echo "✅ Saved Claude config to /data/.claude.json"
  fi
  
  # Save Claude credentials back to volume
  if [ -f "$HOME/.claude/.credentials.json" ]; then
    # Ensure the destination directory exists
    mkdir -p /data/.claude
    cp -f "$HOME/.claude/.credentials.json" /data/.claude/.credentials.json
    chmod 600 /data/.claude/.credentials.json
    echo "✅ Saved Claude credentials to /data/.claude/.credentials.json"
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
if [ -f "/data/.config/gh/hosts.yml" ] || [ -d "/data/.config/gh/hosts.yml.d" ]; then
  echo "✅ GitHub CLI (found config)"
else
  echo "❌ GitHub CLI needs authentication."
  GITHUB_AUTH_NEEDED=true
fi

# Check if Claude credentials exist in any of the possible locations
if [ -f "$HOME/.claude/.credentials.json" ] || [ -f "$HOME/.claude.json" ]; then
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