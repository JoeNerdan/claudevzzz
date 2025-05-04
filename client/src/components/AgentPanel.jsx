import React, { useState } from 'react';

const AgentPanel = ({ repo, issue, onAgentLaunch }) => {
  const [configType, setConfigType] = useState('basic');
  const [config, setConfig] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const generateConfig = async () => {
    setIsGenerating(true);
    setError(null);
    
    try {
      const response = await fetch('/api/generate-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          issue,
          configType
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate configuration');
      }
      
      const data = await response.json();
      setConfig(data.config);
    } catch (error) {
      console.error('Error generating config:', error);
      setError('Error generating configuration');
    } finally {
      setIsGenerating(false);
    }
  };

  const launchAgent = async () => {
    setIsLaunching(true);
    setError(null);
    setSuccess(null);
    
    try {
      let configObj;
      try {
        configObj = JSON.parse(config);
      } catch (parseError) {
        throw new Error('Invalid JSON configuration');
      }
      
      const response = await fetch('/api/launch-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          repo,
          issue,
          config: configObj,
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
      <h2 className="text-xl font-semibold mb-4">Agent Configuration</h2>
      
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
          Configuration Type
        </label>
        <div className="flex gap-4">
          <label className="inline-flex items-center">
            <input
              type="radio"
              name="configType"
              value="basic"
              checked={configType === 'basic'}
              onChange={() => setConfigType('basic')}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500"
            />
            <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Basic</span>
          </label>
          <label className="inline-flex items-center">
            <input
              type="radio"
              name="configType"
              value="detailed"
              checked={configType === 'detailed'}
              onChange={() => setConfigType('detailed')}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500"
            />
            <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Detailed</span>
          </label>
          <label className="inline-flex items-center">
            <input
              type="radio"
              name="configType"
              value="expert"
              checked={configType === 'expert'}
              onChange={() => setConfigType('expert')}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500"
            />
            <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Expert</span>
          </label>
        </div>
      </div>
      
      <div className="flex gap-2 mb-4">
        <button
          onClick={generateConfig}
          disabled={isGenerating}
          className="btn-primary"
        >
          {isGenerating ? 'Generating...' : 'Generate Config'}
        </button>
      </div>
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Configuration
        </label>
        <textarea
          value={config}
          onChange={(e) => setConfig(e.target.value)}
          className="w-full h-64 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-400 font-mono text-sm dark:bg-gray-700 dark:border-gray-600"
          placeholder="Configuration will appear here after generation"
        />
      </div>
      
      <div className="flex justify-end">
        <button
          onClick={launchAgent}
          disabled={!config || isLaunching}
          className="btn-secondary"
        >
          {isLaunching ? 'Launching...' : 'Launch Agent'}
        </button>
      </div>
    </div>
  );
};

export default AgentPanel;