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

// API endpoint for direct agent prompt functionality is no longer needed
// The prompt is now provided directly from the client

// API: Launch an agent for an issue
app.post('/api/launch-agent', (req, res) => {
    const { repo, issue, prompt, agentType } = req.body;

    if (!repo || !issue || !prompt || !agentType) {
        return res.status(400).json({ error: 'Repository, issue, prompt, and agent type are required' });
    }

    // Create workspace for the agent
    const workspaceId = `issue-${issue.number}-${Date.now()}`;
    const workspacePath = path.join('/data/workspaces', workspaceId);

    console.log(`[DEBUG] Creating workspace at: ${workspacePath}`);
    fs.mkdirSync(workspacePath, { recursive: true });
    fs.writeFileSync(path.join(workspacePath, 'prompt.txt'), prompt);
    fs.writeFileSync(path.join(workspacePath, 'issue.json'), JSON.stringify(issue));
    
    // Quick auth check with minimal output
    console.log('Verifying tool access...');
    try {
        const claudePath = require('child_process').execSync('which claude 2>/dev/null || echo "not found"', { timeout: 1000 }).toString().trim();
        if (claudePath !== "not found") {
            console.log('✅ Claude CLI detected');
        } else {
            console.log('❌ Claude CLI not found in PATH');
        }
    } catch (error) {
        console.log('❌ Error checking Claude CLI');
    }

    // Simplified agent command with minimal debug output
    const agentCommand = `cd ${workspacePath} && mkdir -p repo && 
    echo "📋 [$(date +%H:%M:%S)] Starting agent for issue #${issue.number}" >> ${workspacePath}/output.log && 
    echo "🔄 Cloning repository ${repo}..." >> ${workspacePath}/output.log && 
    gh repo clone ${repo} repo </dev/null >> ${workspacePath}/output.log 2>> ${workspacePath}/error.log && 
    cd repo && 
    echo "✅ Repository cloned" >> ${workspacePath}/output.log && 
    echo "🔄 Creating branch fix-issue-${issue.number}..." >> ${workspacePath}/output.log && 
    git checkout -b fix-issue-${issue.number} </dev/null >> ${workspacePath}/output.log 2>> ${workspacePath}/error.log && 
    echo "✅ Branch created" >> ${workspacePath}/output.log && 
    echo "🔄 Running Claude Code agent..." >> ${workspacePath}/output.log && 
    claude -p --output-format json "$(cat ${workspacePath}/prompt.txt)" </dev/null > ${workspacePath}/claude_output.json 2>> ${workspacePath}/error.log && 
    echo "✅ Agent process complete" >> ${workspacePath}/output.log`;

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
        
        // Check for authentication errors
        if (outputLog.includes('Invalid API key') || outputLog.includes('Please run /login')) {
            agentInfo.status = 'auth_error';
            agentInfo.errorDetails = 'Claude authentication failed. Check API key or run claude login.';
        }
        
        // Check error log for more details
        try {
            const errorLog = fs.readFileSync(path.join(agentInfo.workspace, 'error.log'), 'utf8');
            agentInfo.errorLog = errorLog;
        } catch (readError) {
            // Silently handle error log reading failures
        }
        
        // Read additional debug files if they exist
        try {
            const debugFiles = ['env.log', 'claude_output.json'];
            agentInfo.debugLogs = {};
            
            debugFiles.forEach(file => {
                const filePath = path.join(agentInfo.workspace, file);
                if (fs.existsSync(filePath)) {
                    const content = fs.readFileSync(filePath, 'utf8');
                    // Create a more user-friendly key for the frontend
                    const keyName = file.replace('.', '_');
                    agentInfo.debugLogs[keyName] = content;
                }
            });
            
            // Also add the full output.log for reference
            const outputLogPath = path.join(agentInfo.workspace, 'output.log');
            if (fs.existsSync(outputLogPath)) {
                agentInfo.debugLogs['output_log'] = fs.readFileSync(outputLogPath, 'utf8');
            }
        } catch (debugError) {
            // Silently handle debug file reading failures
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
    const { type = 'output' } = req.query; // 'output', 'error', or 'claude'

    if (!activeAgents[workspaceId]) {
        return res.status(404).json({ error: 'Agent not found' });
    }

    const agentInfo = activeAgents[workspaceId];
    
    let logPath;
    if (type === 'claude') {
        logPath = path.join(agentInfo.workspace, 'claude_output.json');
    } else {
        const logFile = type === 'error' ? 'error.log' : 'output.log';
        logPath = path.join(agentInfo.workspace, logFile);
    }

    try {
        if (fs.existsSync(logPath)) {
            const logContent = fs.readFileSync(logPath, 'utf8');
            
            // Format Claude output for better readability if it's JSON
            if (type === 'claude' && logContent.trim()) {
                try {
                    const claudeData = JSON.parse(logContent);
                    // Return formatted JSON or pretty-printed if parsing succeeds
                    res.json({ logs: JSON.stringify(claudeData, null, 2) });
                    return;
                } catch (jsonError) {
                    // If not valid JSON, just return as is
                    console.log('Error parsing Claude output as JSON:', jsonError);
                }
            }
            
            res.json({ logs: logContent });
        } else {
            res.status(404).json({ error: `Log file not found: ${logPath}` });
        }
    } catch (error) {
        res.status(500).json({ error: `Error reading log file: ${error.message} ` });
    }
});

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
    console.log(`✅ Server running at http://0.0.0.0:${port}`);
    if (process.env.NODE_ENV === 'development') {
        console.log('🔧 Running in development mode');
    }
});
