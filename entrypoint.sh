#!/bin/bash

echo "🔄 Starting GitHub Issue Assistant..."

# Set up persistent credential directories
mkdir -p /data/.config/gh /data/.claude

# Make sure home directory exists and has permissions
mkdir -p $HOME ~/.config
chmod 755 $HOME ~/.config

# Remove any existing credential directories and set up symbolic links
rm -rf ~/.config/gh ~/.claude 2>/dev/null
ln -sf /data/.config/gh ~/.config/gh
ln -sf /data/.claude ~/.claude

# Check authentication status
echo "🔍 Checking authentication:"

# Check if GitHub is authenticated
if gh auth status </dev/null &>/dev/null; then
  echo "✅ GitHub CLI"
else
  echo "❌ GitHub CLI (run 'gh auth login')"
  GITHUB_AUTH_NEEDED=true
fi

# Check if Claude CLI is installed and authenticated
if command -v claude >/dev/null && claude auth status </dev/null &>/dev/null; then
  echo "✅ Claude CLI"
else
  echo "❌ Claude CLI (run 'claude auth login')"
  CLAUDE_AUTH_NEEDED=true
fi

# If auth is needed, drop to a shell
if [ "$GITHUB_AUTH_NEEDED" = true ] || [ "$CLAUDE_AUTH_NEEDED" = true ]; then
  echo "❗ Please authenticate the required services, then run: npm start"
  exec bash
else
  echo "✅ All services authenticated"
  
  if [ "$NODE_ENV" = "development" ]; then
    echo "🔄 Starting in development mode..."
    
    # Ensure credentials are accessible in dev mode
    if [ -d "/data/.config/gh" ]; then
        mkdir -p "$HOME/.config"
        cp -rf /data/.config/gh "$HOME/.config/"
        chmod -R 700 "$HOME/.config/gh"
    fi
    
    if [ -d "/data/.claude" ]; then
        cp -rf /data/.claude "$HOME/"
        chmod -R 700 "$HOME/.claude"
    fi
    
    # Run Vite in development mode in the background
    echo "🔄 Starting dev servers..."
    npm run client:dev &
    VITE_PID=$!
    
    # Wait a moment for Vite to start
    sleep 2
    
    echo "✅ Server running at http://localhost:3000"
    npx nodemon --watch server.js server.js
    
    # Kill the Vite process when the Express server exits
    kill $VITE_PID
  else
    # For production
    if [ ! -f "/app/public/dist/index.html" ]; then
      echo "🔄 Building React app..."
      npm run client:build
    fi
    echo "✅ Starting server at http://localhost:3000"
    npm start
  fi
fi