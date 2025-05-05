#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

echo "🔄 Starting GitHub Issue Assistant..."

# --- Credential Setup ---
# Ensure persistent directories exist on the host volume (/data)
mkdir -p /data/.config/gh /data/.config/claude /data/.claude

# Ensure the home directory and configuration directories exist inside the container
# Use $HOME which is typically /root when running as root
mkdir -p "$HOME/.config" "$HOME/.claude"
chmod 755 "$HOME" "$HOME/.config" "$HOME/.claude"

# Remove any existing credential files and directories to start clean
rm -rf "$HOME/.config/gh" "$HOME/.config/claude" "$HOME/.claude"/* "$HOME/.claude.json"

# --- First-time data cleanup (if needed) ---
# If we have multiple credential files, clean them up to ensure consistency
if [ -f "/data/.claude.json" ] && [ -f "/data/.claude/config.json" ] && [ -d "/data/.claude/credentials" ]; then
  echo "🔍 Found multiple Claude config files, cleaning up for consistency..."
  
  # Extract the user ID from the main config file
  USER_ID=$(grep -o '"userID": "[^"]*"' /data/.claude.json | head -1 | cut -d'"' -f4 || echo "")
  
  if [ -n "$USER_ID" ]; then
    echo "✅ Using userID: ${USER_ID:0:8}... (truncated for security)"
    
    # Update the userID in config.json to match
    if [ -f "/data/.claude/config.json" ]; then
      # Use sed to replace the userID
      sed -i "s/\"userID\": \"[^\"]*\"/\"userID\": \"$USER_ID\"/" /data/.claude/config.json
      echo "✅ Updated userID in /data/.claude/config.json"
    fi
  fi
fi

# Create symbolic links from standard locations to persistent storage
# Tools like 'gh' and 'claude' will write to ~/.config/gh, ~/.config/claude and ~/.claude
# which will now point to the persistent /data volume.
ln -sf /data/.config/gh "$HOME/.config/gh"
ln -sf /data/.config/claude "$HOME/.config/claude"
ln -sf /data/.claude "$HOME/.claude"

# Copy the .claude.json file if it exists
if [ -f "/data/.claude.json" ]; then
  cp -f /data/.claude.json "$HOME/.claude.json"
  chmod 600 "$HOME/.claude.json"
fi

# Set CLAUDE_CONFIG_DIR environment variable to point to the config directory
export CLAUDE_CONFIG_DIR="$HOME/.config/claude"
echo "✅ Linked ~/.config/gh -> /data/.config/gh"
echo "✅ Linked ~/.config/claude -> /data/.config/claude"
echo "✅ Linked ~/.claude -> /data/.claude"
echo "✅ Set CLAUDE_CONFIG_DIR=$CLAUDE_CONFIG_DIR"

# Set up a trap to backup credentials on container exit or script termination
cleanup_and_backup() {
  echo "🔄 Backing up credentials to persistent storage..."
  
  # Backup GitHub credentials
  if [ -d "$HOME/.config/gh" ]; then
    mkdir -p /data/.config
    cp -rf "$HOME/.config/gh" /data/.config/
    echo "✅ GitHub credentials backed up to /data/.config/gh"
  fi
  
  # Backup Claude credentials (all possible locations)
  if [ -f "$HOME/.claude.json" ]; then
    cp -f "$HOME/.claude.json" /data/.claude.json
    echo "✅ Claude config backed up to /data/.claude.json"
  fi
  
  if [ -d "$HOME/.claude" ]; then
    cp -rf "$HOME/.claude/"* /data/.claude/ 2>/dev/null || true
    echo "✅ Claude credentials backed up to /data/.claude/"
  fi
  
  if [ -d "$HOME/.config/claude" ]; then
    mkdir -p /data/.config
    cp -rf "$HOME/.config/claude" /data/.config/
    echo "✅ Claude config backed up to /data/.config/claude"
  fi
}

trap cleanup_and_backup EXIT HUP INT TERM

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

# Check if Claude credentials exist in any of the possible locations
if [ -f "$CLAUDE_CONFIG_DIR/.credentials.json" ] || [ -f "$CLAUDE_CONFIG_DIR/credentials.json" ] || \
   [ -f "$HOME/.claude/.credentials.json" ] || [ -f "$HOME/.claude/credentials.json" ] || \
   [ -d "$HOME/.claude/credentials" ] || [ -f "$HOME/.claude.json" ]; then
  
  # Try to actually verify the credentials by checking the Claude version (more reliable)
  if command -v claude >/dev/null && claude --version >/dev/null 2>&1; then
    echo "✅ Claude CLI (credentials verified)"
  else
    echo "✅ Claude CLI (found credentials, but not verified)"
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
     echo "   - After login, run: cp ~/.claude.json /data/.claude.json (if the file exists)"
     echo "   - Your credentials will be synchronized across container restarts"
     echo "   - We manage ~/.claude, ~/.claude.json, and ~/.config/claude for persistence"
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
        
        # Run the original cleanup_and_backup function to ensure credentials are saved
        cleanup_and_backup
    }

    # Update the trap to use our combined cleanup function
    trap dev_cleanup EXIT HUP INT TERM

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