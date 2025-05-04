import React, { useState, useEffect, useRef } from 'react';
import RepoList from './RepoList';
import IssueList from './IssueList';
import IssueDetails from './IssueDetails';
import AgentPanel from './AgentPanel';

const Dashboard = () => {
  const [currentRepo, setCurrentRepo] = useState('');
  const [currentIssue, setCurrentIssue] = useState(null);
  const [agents, setAgents] = useState({});

  useEffect(() => {
    refreshAgents();
  }, []);

  const refreshAgents = async () => {
    try {
      const response = await fetch('/api/agents');
      const data = await response.json();
      setAgents(data);
    } catch (error) {
      console.error('Error refreshing agents:', error);
    }
  };

  const handleRepoSelect = (repo) => {
    setCurrentRepo(repo);
    setCurrentIssue(null);
  };

  const handleIssueSelect = (issue) => {
    setCurrentIssue(issue);
  };

  const handleAgentLaunch = async () => {
    await refreshAgents();
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Column - Repo List */}
        <div className="md:col-span-3">
          <RepoList currentRepo={currentRepo} onRepoSelect={handleRepoSelect} />
        </div>
        
        {/* Middle Column - Issue List */}
        <div className="md:col-span-4">
          <IssueList repo={currentRepo} currentIssue={currentIssue} onIssueSelect={handleIssueSelect} />
        </div>
        
        {/* Right Column - Issue Details & Agent Setup */}
        <div className="md:col-span-5">
          <IssueDetails issue={currentIssue} repo={currentRepo} />
          
          {currentIssue && (
            <AgentPanel 
              repo={currentRepo} 
              issue={currentIssue} 
              onAgentLaunch={handleAgentLaunch} 
            />
          )}
        </div>
      </div>
      
      {/* Agents Section */}
      <div className="mt-8">
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Active and Completed Agents</h2>
            <button onClick={refreshAgents} className="btn-outline">
              Refresh
            </button>
          </div>
          
          <div className="space-y-4">
            {Object.entries(agents).length > 0 ? (
              Object.entries(agents).map(([id, agent]) => (
                <AgentItem key={id} id={id} agent={agent} />
              ))
            ) : (
              <p className="text-gray-500 italic">No agents have been launched yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const AgentItem = ({ id, agent }) => {
  const [activeLogType, setActiveLogType] = useState('output');
  const [logs, setLogs] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const logContainerRef = useRef(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Function to fetch logs
  const fetchLogs = async (type) => {
    try {
      const response = await fetch(`/api/agent/${id}/logs?type=${type}`);
      const data = await response.json();
      setLogs(data.logs || 'No logs available');
      
      // Auto scroll to bottom if enabled
      if (autoScroll && logContainerRef.current) {
        setTimeout(() => {
          const container = logContainerRef.current;
          container.scrollTop = container.scrollHeight;
        }, 100);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
      setLogs('Error loading logs');
    }
  };
  
  // Handle view logs button click
  const viewLogs = (type) => {
    setActiveLogType(type);
    fetchLogs(type);
  };
  
  // Auto-refresh logs every 2 seconds
  useEffect(() => {
    let interval;
    
    if (autoRefresh && agent.status === 'running') {
      interval = setInterval(() => {
        fetchLogs(activeLogType);
      }, 2000);
    }
    
    // Initial load of logs
    fetchLogs(activeLogType);
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [id, activeLogType, autoRefresh, agent.status]);
  
  // Handle manual scrolling to disable auto-scroll
  const handleScroll = (e) => {
    const container = e.target;
    const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 50;
    setAutoScroll(isAtBottom);
  };

  let statusColor = 'bg-blue-100 text-blue-800';
  if (agent.status === 'completed') {
    statusColor = 'bg-green-100 text-green-800';
  } else if (agent.status === 'roadblock') {
    statusColor = 'bg-red-100 text-red-800';
  }

  return (
    <div className={`card ${agent.status === 'roadblock' ? 'border-red-300' : ''}`}>
      <h3 className="text-lg font-medium">Agent for Issue #{agent.issue}</h3>
      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="flex space-x-2 mb-2">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
              {agent.status}
            </span>
            <span className="text-sm text-gray-500">
              Started: {new Date(agent.started).toLocaleString()}
            </span>
          </div>
          
          {agent.pullRequestUrl && (
            <p className="text-sm">
              <strong>Pull Request:</strong>{' '}
              <a 
                href={agent.pullRequestUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary-600 hover:text-primary-700"
              >
                {agent.pullRequestUrl.split('/').pop()}
              </a>
            </p>
          )}
          
          {agent.roadblock && (
            <div className="mt-2 p-3 bg-red-50 text-red-700 rounded-md text-sm">
              <strong>Roadblock:</strong> {agent.roadblock}
            </div>
          )}
        </div>
        
        <div>
          <div className="flex justify-between mb-2">
            <div className="flex space-x-2">
              <button 
                className={`px-3 py-1 text-xs font-medium rounded-t-md ${activeLogType === 'output' ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-700'}`}
                onClick={() => viewLogs('output')}
              >
                Output Log
              </button>
              <button 
                className={`px-3 py-1 text-xs font-medium rounded-t-md ${activeLogType === 'error' ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-700'}`}
                onClick={() => viewLogs('error')}
              >
                Error Log
              </button>
              <button 
                className={`px-3 py-1 text-xs font-medium rounded-t-md ${activeLogType === 'claude' ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-700'}`}
                onClick={() => viewLogs('claude')}
              >
                Claude Code
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => fetchLogs(activeLogType)}
                className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-md"
                title="Refresh logs now"
              >
                ↻
              </button>
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={() => setAutoRefresh(!autoRefresh)}
                  className="form-checkbox h-3 w-3 text-blue-600"
                />
                <span className="ml-1 text-xs text-gray-700 dark:text-gray-300">
                  Auto-refresh
                </span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={() => setAutoScroll(!autoScroll)}
                  className="form-checkbox h-3 w-3 text-green-600"
                />
                <span className="ml-1 text-xs text-gray-700 dark:text-gray-300">
                  Auto-scroll
                </span>
              </label>
            </div>
          </div>
          
          <div
            ref={logContainerRef}
            className="bg-gray-900 text-gray-300 p-3 rounded-md text-sm font-mono h-64 overflow-y-auto"
            onScroll={handleScroll}
          >
            {logs ? (
              <div className="relative">
                {autoRefresh && agent.status === 'running' && (
                  <div className="absolute top-0 right-0 bg-blue-600 text-white text-xs px-2 py-1 rounded-bl-md">
                    Auto-refreshing...
                  </div>
                )}
                
                <pre className="whitespace-pre-wrap leading-relaxed">
                  {activeLogType === 'claude' 
                    ? logs.split('\n').map((line, index) => {
                        // Format JSON keys with different color for Claude output
                        const formattedLine = line.replace(/"([^"]+)":/g, '<span class="text-yellow-300">"$1":</span>');
                        return (
                          <div key={index} className="text-purple-300" dangerouslySetInnerHTML={{ __html: formattedLine }} />
                        );
                      })
                    : logs.split('\n').map((line, index) => {
                        // Extract timestamp if present in format [HH:MM:SS]
                        const timestampMatch = line.match(/\[(\d{2}:\d{2}:\d{2})\]/);
                        const timestamp = timestampMatch ? timestampMatch[1] : null;
                        
                        // Add colors for emojis and status messages
                        let className = '';
                        
                        if (activeLogType === 'error') {
                          className = 'text-red-300'; // Error logs are reddish
                        } else {
                          if (line.includes('✅')) {
                            className = 'text-green-400';
                          } else if (line.includes('❌')) {
                            className = 'text-red-400';
                          } else if (line.includes('🔄')) {
                            className = 'text-blue-400';
                          } else if (line.includes('📋')) {
                            className = 'text-yellow-400 font-bold';
                          }
                        }
                        
                        return (
                          <div key={index} className={className}>
                            {timestamp && (
                              <span className="text-gray-500 mr-2">{timestamp}</span>
                            )}
                            {line.replace(/\[\d{2}:\d{2}:\d{2}\]\s*/, '')}
                          </div>
                        );
                      })
                  }
                </pre>
              </div>
            ) : (
              <em>Click one of the log options above to view logs</em>
            )}
          </div>
          
          {agent.debugLogs && (
            <div className="mt-2">
              <div className="flex flex-wrap gap-2 mb-2">
                {agent.debugLogs["debug_log"] && (
                  <button 
                    className="px-3 py-1 text-xs font-medium rounded-md bg-purple-100 text-purple-700"
                    onClick={() => setLogs(agent.debugLogs.debug_log)}
                  >
                    Debug Log
                  </button>
                )}
                {agent.debugLogs["env_log"] && (
                  <button 
                    className="px-3 py-1 text-xs font-medium rounded-md bg-yellow-100 text-yellow-700"
                    onClick={() => setLogs(agent.debugLogs.env_log)}
                  >
                    Env Log
                  </button>
                )}
                {agent.debugLogs["auth_log"] && (
                  <button 
                    className="px-3 py-1 text-xs font-medium rounded-md bg-blue-100 text-blue-700"
                    onClick={() => setLogs(agent.debugLogs.auth_log)}
                  >
                    Auth Log
                  </button>
                )}
                {agent.debugLogs["output_log"] && (
                  <button 
                    className="px-3 py-1 text-xs font-medium rounded-md bg-green-100 text-green-700"
                    onClick={() => setLogs(agent.debugLogs.output_log)}
                  >
                    Full Output
                  </button>
                )}
                {agent.debugLogs["claude_test_json"] && (
                  <button 
                    className="px-3 py-1 text-xs font-medium rounded-md bg-indigo-100 text-indigo-700"
                    onClick={() => setLogs(agent.debugLogs.claude_test_json)}
                  >
                    Claude Test
                  </button>
                )}
                {agent.debugLogs["claude_output_json"] && (
                  <button 
                    className="px-3 py-1 text-xs font-medium rounded-md bg-pink-100 text-pink-700"
                    onClick={() => setLogs(agent.debugLogs.claude_output_json)}
                  >
                    Claude Output
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;