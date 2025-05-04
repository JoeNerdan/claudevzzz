import React, { useState, useEffect } from 'react';
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

  const viewLogs = async (type) => {
    try {
      const response = await fetch(`/api/agent/${id}/logs?type=${type}`);
      const data = await response.json();
      setLogs(data.logs || 'No logs available');
      setActiveLogType(type);
    } catch (error) {
      console.error('Error fetching logs:', error);
      setLogs('Error loading logs');
    }
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
          <div className="flex space-x-2 mb-2">
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
          </div>
          
          <div className="bg-gray-900 text-gray-300 p-3 rounded-md text-xs font-mono h-32 overflow-y-auto">
            {logs ? (
              <pre className="whitespace-pre-wrap">{logs}</pre>
            ) : (
              <em>Click one of the log options above to view logs</em>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;