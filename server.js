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

// API: Generate agent configuration with Claude
app.post('/api/generate-config', (req, res) => {
    const { issue, configType } = req.body;
    
    if (!issue || !configType) {
        return res.status(400).json({ error: 'Issue and config type are required' });
    }
    
    // Build prompt for Claude to generate config
    const prompt = `Generate a ${configType} configuration for GitHub issue #${issue.number}: ${issue.title}
Issue description: ${issue.body}
Please create a configuration that would help an AI agent understand and fix this issue.`;
    
    exec(`claude "${prompt}"`, (error, stdout, stderr) => {
        if (error) {
            return res.status(500).json({ error: stderr || error.message });
        }
        
        res.json({ config: stdout });
    });
});

// API: Launch an agent for an issue
app.post('/api/launch-agent', (req, res) => {
    const { repo, issue, config, agentType } = req.body;
    
    if (!repo || !issue || !config || !agentType) {
        return res.status(400).json({ error: 'Repository, issue, config, and agent type are required' });
    }
    
    // Create workspace for the agent
    const workspaceId = `issue-${issue.number}-${Date.now()}`;
    const workspacePath = path.join('/data/workspaces', workspaceId);
    
    fs.mkdirSync(workspacePath, { recursive: true });
    fs.writeFileSync(path.join(workspacePath, 'config.json'), JSON.stringify(config));
    fs.writeFileSync(path.join(workspacePath, 'issue.json'), JSON.stringify(issue));
    
    // Command to run the Claude Code agent
    const agentCommand = `cd ${workspacePath} && gh repo clone ${repo} . && git checkout -b fix-issue-${issue.number} && claude code --config ./config.json`;
    
    // Launch the agent as a separate process
    const agentProcess = spawn('bash', ['-c', agentCommand], {
        detached: true,
        stdio: ['ignore', 
                fs.openSync(path.join(workspacePath, 'output.log'), 'w'),
                fs.openSync(path.join(workspacePath, 'error.log'), 'w')]
    });
    
    // Store the agent info
    activeAgents[workspaceId] = {
        pid: agentProcess.pid,
        issue: issue.number,
        started: new Date().toISOString(),
        status: 'running',
        workspace: workspacePath
    };
    
    // Don't wait for the process to finish
    agentProcess.unref();
    
    res.json({ 
        workspaceId,
        message: `Agent launched for issue #${issue.number}`
    });
});

// API: Check agent status
app.get('/api/agent/:workspaceId', (req, res) => {
    const { workspaceId } = req.params;
    
    if (!activeAgents[workspaceId]) {
        return res.status(404).json({ error: 'Agent not found' });
    }
    
    const agentInfo = activeAgents[workspaceId];
    
    // Check if the process is still running
    try {
        process.kill(agentInfo.pid, 0);
        // Process exists, still running
    } catch (e) {
        // Process no longer exists, agent has finished
        agentInfo.status = 'completed';
        
        // Check for pull request creation in output logs
        const outputLog = fs.readFileSync(path.join(agentInfo.workspace, 'output.log'), 'utf8');
        if (outputLog.includes('Pull request created')) {
            const prMatch = outputLog.match(/Pull request created: (https:\/\/github\.com\/.*\/pull\/\d+)/);
            if (prMatch) {
                agentInfo.pullRequestUrl = prMatch[1];
            }
        }
        
        // Check for roadblocks
        if (outputLog.includes('ROADBLOCK:')) {
            agentInfo.status = 'roadblock';
            const roadblockMatch = outputLog.match(/ROADBLOCK: (.*)/);
            if (roadblockMatch) {
                agentInfo.roadblock = roadblockMatch[1];
            }
        }
    }
    
    res.json(agentInfo);
});

// API: List all agents
app.get('/api/agents', (req, res) => {
    res.json(activeAgents);
});

// API: Get agent logs
app.get('/api/agent/:workspaceId/logs', (req, res) => {
    const { workspaceId } = req.params;
    const { type = 'output' } = req.query; // 'output' or 'error'
    
    if (!activeAgents[workspaceId]) {
        return res.status(404).json({ error: 'Agent not found' });
    }
    
    const agentInfo = activeAgents[workspaceId];
    const logFile = type === 'error' ? 'error.log' : 'output.log';
    const logPath = path.join(agentInfo.workspace, logFile);
    
    try {
        if (fs.existsSync(logPath)) {
            const logContent = fs.readFileSync(logPath, 'utf8');
            res.json({ logs: logContent });
        } else {
            res.status(404).json({ error: 'Log file not found' });
        }
    } catch (error) {
        res.status(500).json({ error: `Error reading log file: ${error.message}` });
    }
});

// Setup to handle both development and production environments
if (process.env.NODE_ENV === 'development') {
    // In development mode, proxy non-API requests to the Vite dev server
    console.log('Development mode: Proxying front-end requests to Vite dev server');
    app.use('/', 
        createProxyMiddleware({
            target: 'http://localhost:5173',
            changeOrigin: true,
            // Don't proxy API requests, those will be handled by Express
            filter: (pathname) => !pathname.startsWith('/api'),
            // Log errors for easier debugging
            onError: (err, req, res) => {
                console.error('Proxy error:', err);
                res.status(500).send('Proxy error: ' + err.message);
            },
            logLevel: 'debug'
        })
    );
} else {
    // In production mode, serve static files from the public directory
    console.log('Production mode: Serving static files');
    
    // First serve React app files from the dist directory
    app.use(express.static(path.join(__dirname, 'public/dist')));
    
    // Then serve any other static files from the public directory
    app.use(express.static('public'));
}

// Track active agents
const activeAgents = {};

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
    console.log(`Server running at http://0.0.0.0:${port}`);
    console.log(`Development mode: ${process.env.NODE_ENV === 'development'}`);
});