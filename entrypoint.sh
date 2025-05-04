#!/bin/bash

echo "🔄 Checking persistent storage..."
if [ -d "/data" ] && touch /data/.storage_test 2>/dev/null; then
  echo "✅ Persistent storage connected and writable"
  rm /data/.storage_test
else
  echo "❌ WARNING: Persistent storage not connected or not writable!"
  echo "    Credentials will not persist between container restarts."
  echo "    Make sure to use '-v claudevzzz-data:/data' in your docker run command."
fi

# Set up persistent credential directories
mkdir -p /data/.config/gh
mkdir -p /data/.config/claude

# Make sure home directory exists and has permissions
mkdir -p $HOME
chmod 755 $HOME

# Remove any existing credential directories (they might be empty/incorrect)
rm -rf ~/.config/gh ~/.config/claude 2>/dev/null

# Create parent directories with proper permissions
mkdir -p ~/.config
chmod 755 ~/.config

# Create symlinks to credential locations
ln -sf /data/.config/gh ~/.config/gh
ln -sf /data/.config/claude ~/.config/claude

echo "🔄 Checking authentication status..."

# Debug Claude authentication locations
echo "🔍 Claude credential paths:"
echo "  Home directory: $HOME"
echo "  Checking ~/.config/claude:"
ls -la ~/.config/claude 2>/dev/null || echo "  Not found"
echo "  Checking /data/.config/claude:"
ls -la /data/.config/claude 2>/dev/null || echo "  Not found"
echo "-------------------------------------"

# Check if GitHub is authenticated
if gh auth status &>/dev/null; then
  echo "✅ GitHub CLI is authenticated"
else
  echo "❌ GitHub CLI is not authenticated. Please run: gh auth login"
  GITHUB_AUTH_NEEDED=true
fi

# Check if Claude CLI is authenticated - more thorough check
if [ -f "/data/.config/claude/credentials.json" ] || [ -d "/data/.config/claude" ]; then
  # First ensure permissions are correct
  chmod -R 700 /data/.config/claude 2>/dev/null
  
  # Try to run a simple test command to check if credentials work
  if claude --version >/dev/null 2>&1; then
    echo "✅ Claude CLI is authenticated"
  else
    # Try claude specific auth check if available
    if command -v claude >/dev/null && claude auth status >/dev/null 2>&1; then
      echo "✅ Claude CLI is authenticated"
    else
      echo "⚠️ Claude credentials exist but appear to be invalid"
      # Delete potentially corrupted credentials
      echo "   Removing potentially corrupted credentials..."
      rm -rf /data/.config/claude/* 2>/dev/null
      echo "❌ Claude CLI needs re-authentication. Please run: claude login"
      CLAUDE_AUTH_NEEDED=true
    fi
  fi
else
  echo "❌ Claude CLI is not authenticated. Please run: claude login"
  CLAUDE_AUTH_NEEDED=true
fi

# If auth is needed, drop to a shell
if [ "$GITHUB_AUTH_NEEDED" = true ] || [ "$CLAUDE_AUTH_NEEDED" = true ]; then
  echo "Please authenticate the required services, then start the web interface with: npm start"
  exec bash
else
  echo "All services authenticated, starting web interface..."
  echo "Credential files stored in persistent volume:"
  ls -la /data/.config/gh /data/.config/claude /data/.anthropic 2>/dev/null || echo "No credential files found yet"
  if [ "$NODE_ENV" = "development" ]; then
    echo "Starting server in development mode with hot reloading..."
    echo "Installing dependencies in mounted volume..."
    npm install
    
    # Run Vite in development mode in the background
    echo "Starting Vite development server..."
    npm run client:dev &
    VITE_PID=$!
    
    # Wait a moment for Vite to start
    sleep 3
    
    echo "Starting Express server with nodemon..."
    echo "Everything (UI and API) will be available at: http://localhost:3000"
    echo "The Express server will proxy frontend requests to the Vite dev server"
    npx nodemon --watch server.js server.js
    
    # Kill the Vite process when the Express server exits
    kill $VITE_PID
  else
    # For production, make sure the React app is properly built
    if [ ! -f "/app/public/dist/index.html" ]; then
      echo "⚠️ React app build not found. Building now..."
      npm run client:build
    else
      echo "✅ React app build found. Starting server..."
    fi
    npm start
  fi
fi