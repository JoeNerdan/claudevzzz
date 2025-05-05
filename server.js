const express = require('express');
const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');
const app = express();
const port = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Define API routes BEFORE proxy setup to ensure they're handled by Express

// API: List user's GitHub repositories
app.get('/api/repos', (req, res) => {
    exec('gh repo list --json name,nameWithOwner,url,description,isPrivate,stargazerCount --limit 100', (error, stdout, stderr) => {
        if (error) {
            console.error('Error fetching repos:', error, stderr);
            return res.status(500).json({ error: stderr || error.message });
        }

        try {
            const data = JSON.parse(stdout);
            res.json(data);
        } catch (parseError) {
            console.error('Error parsing repo data:', parseError, stdout);
            res.status(500).json({ error: 'Failed to parse repository data', details: stdout });
        }
    });
});

// API: List GitHub issues
app.get('/api/issues', (req, res) => {
    const { repo } = req.query;

    if (!repo) {
        return res.status(400).json({ error: 'Repository is required' });
    }

    exec(`gh issue list --repo ${repo} --json number,title,state,labels`, (error, stdout, stderr) => {
        if (error) {
            return res.status(500).json({ error: stderr || error.message });
        }

        res.json(JSON.parse(stdout));
    });
});

// API: Get issue details
app.get('/api/issues/:number', (req, res) => {
    const { repo } = req.query;
    const { number } = req.params;

    if (!repo) {
        return res.status(400).json({ error: 'Repository is required' });
    }

    exec(`gh issue view ${number} --repo ${repo} --json number,title,body,labels,assignees`, (error, stdout, stderr) => {
        if (error) {
            return res.status(500).json({ error: stderr || error.message });
        }

        res.json(JSON.parse(stdout));
    });
});

// --- Claude features removed ---
// API: Launch an agent for an issue - REMOVED

// API: Check agent status - REMOVED

// API: List all agents - REMOVED

// API: Get agent logs - REMOVED

// Track active agents - Not needed as agent functionality removed
const activeAgents = {};

// Setup to handle both development and production environments
if (process.env.NODE_ENV === 'development') {
    // In development mode, proxy non-API requests to the Vite dev server
    console.log('🔄 Proxying frontend requests to Vite dev server');
    app.use('/',
        createProxyMiddleware({
            target: 'http://localhost:5173',
            changeOrigin: true,
            // Don't proxy API requests, those will be handled by Express
            filter: (pathname) => !pathname.startsWith('/api'),
            // Log errors for easier debugging
            onError: (err, req, res) => {
                console.error('❌ Proxy error:', err.message);
                res.status(500).send('Proxy error: ' + err.message);
            },
            logLevel: 'error'
        })
    );
} else {
    // In production mode, serve static files from the public directory
    console.log('📁 Serving static files from public directory');

    // First serve React app files from the dist directory
    app.use(express.static(path.join(__dirname, 'public/dist')));

    // Then serve any other static files from the public directory
    app.use(express.static('public'));
}

// Serve React app for all other routes (SPA routing)
app.get('*', (req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/api')) return next();

    // In production mode, serve the React app for all non-API routes
    if (process.env.NODE_ENV !== 'development') {
        const indexPath = path.join(__dirname, 'public/dist/index.html');
        if (fs.existsSync(indexPath)) {
            res.sendFile(indexPath);
        } else {
            console.error('React app not built yet. Index.html not found in public/dist/');
            res.status(404).send(
                'React app not built yet. Please rebuild the Docker image with: npm run docker:build'
            );
        }
    }
    // In development, the proxy middleware will handle non-API routes
});

// Start the server
app.listen(port, '0.0.0.0', () => {
    console.log(`✅ Server running at http://0.0.0.0:${port}`);
    if (process.env.NODE_ENV === 'development') {
        console.log('🔧 Running in development mode');
    }
});