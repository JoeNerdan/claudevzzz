import React, { useState } from 'react';

const AgentPanel = ({ repo, issue, onAgentLaunch }) => {
  const [prompt, setPrompt] = useState(
    `Fix issue #${issue?.number}. Use gh to get the information. Fix the issue and open a PR. If you cannot fix it, add a comment. NEVER stop working without either a PR or a comment.`
  );
  const [isLaunching, setIsLaunching] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const launchAgent = async () => {
    setIsLaunching(true);
    setError(null);
    setSuccess(null);
    
    try {
      const response = await fetch('/api/launch-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          repo,
          issue,
          prompt,
          agentType: 'claude-code'
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to launch agent');
      }
      
      const data = await response.json();
      setSuccess(`Agent launched: ${data.message}`);
      
      // Notify parent component that an agent was launched
      if (onAgentLaunch) {
        onAgentLaunch();
      }
    } catch (error) {
      console.error('Error launching agent:', error);
      setError(`Error launching agent: ${error.message}`);
    } finally {
      setIsLaunching(false);
    }
  };

  return (
    <div className="card">
      <h2 className="text-xl font-semibold mb-4">Agent Prompt</h2>
      
      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded-md mb-4 text-sm">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-100 text-green-700 p-3 rounded-md mb-4 text-sm">
          {success}
        </div>
      )}
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Agent Prompt
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="w-full h-64 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-400 font-mono text-sm dark:bg-gray-700 dark:border-gray-600"
          placeholder="Enter the prompt for Claude agent"
        />
      </div>
      
      <div className="flex justify-end">
        <button
          onClick={launchAgent}
          disabled={!prompt || isLaunching}
          className="btn-secondary"
        >
          {isLaunching ? 'Launching...' : 'Launch Agent'}
        </button>
      </div>
    </div>
  );
};

export default AgentPanel;