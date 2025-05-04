import React, { useState, useEffect } from 'react';

const IssueList = ({ repo, currentIssue, onIssueSelect }) => {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [customRepo, setCustomRepo] = useState('');

  useEffect(() => {
    if (repo) {
      loadIssues();
    } else {
      // Clear issues if no repo is selected
      setIssues([]);
    }
  }, [repo]);

  const loadIssues = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/issues?repo=${encodeURIComponent(repo)}`);
      if (!response.ok) {
        throw new Error('Failed to load issues');
      }
      
      const data = await response.json();
      setIssues(data);
    } catch (error) {
      console.error('Error loading issues:', error);
      setError('Error loading issues. Make sure the repository exists and you have access to it.');
    } finally {
      setLoading(false);
    }
  };

  const handleIssueClick = async (issueNumber) => {
    try {
      const response = await fetch(`/api/issues/${issueNumber}?repo=${encodeURIComponent(repo)}`);
      if (!response.ok) {
        throw new Error('Failed to load issue details');
      }
      
      const issue = await response.json();
      onIssueSelect(issue);
    } catch (error) {
      console.error('Error loading issue details:', error);
    }
  };

  const handleCustomRepoSubmit = (e) => {
    e.preventDefault();
    if (customRepo.trim()) {
      onIssueSelect(null);
      onRepoSelect(customRepo.trim());
    }
  };

  return (
    <div className="card h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Issues</h2>
        {repo && (
          <div className="text-sm font-medium text-primary-600 dark:text-primary-400">
            {repo}
          </div>
        )}
      </div>
      
      {!repo ? (
        <div className="text-center py-6 text-gray-500">
          <p className="mb-4">Select a repository from the list</p>
          <p className="text-sm mb-2">Or enter a repository manually:</p>
          <form onSubmit={handleCustomRepoSubmit} className="flex">
            <input
              type="text"
              placeholder="owner/repo"
              value={customRepo}
              onChange={(e) => setCustomRepo(e.target.value)}
              className="flex-grow px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-primary-400 dark:bg-gray-700 dark:border-gray-600"
            />
            <button 
              type="submit"
              className="btn-primary rounded-l-none"
            >
              Load
            </button>
          </form>
        </div>
      ) : (
        <>
          {error && (
            <div className="bg-red-100 text-red-700 p-3 rounded-md mb-4 text-sm">
              {error}
            </div>
          )}
          
          <div className="overflow-y-auto flex-grow">
            {loading ? (
              <div className="text-center py-6 text-gray-500">
                Loading issues...
              </div>
            ) : issues.length > 0 ? (
              <div className="space-y-2">
                {issues.map((issue) => (
                  <div
                    key={issue.number}
                    className={`p-3 rounded-md border cursor-pointer transition-colors ${
                      currentIssue && currentIssue.number === issue.number
                        ? 'bg-primary-50 border-primary-200 dark:bg-primary-900/30 dark:border-primary-800'
                        : 'hover:bg-gray-50 border-gray-200 dark:hover:bg-gray-800/50 dark:border-gray-700'
                    }`}
                    onClick={() => handleIssueClick(issue.number)}
                  >
                    <div className="flex items-start">
                      <span className="text-gray-500 mr-2">#{issue.number}</span>
                      <span className="font-medium">{issue.title}</span>
                    </div>
                    
                    {issue.labels && issue.labels.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {issue.labels.map((label) => (
                          <span 
                            key={label.name}
                            className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                          >
                            {label.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500">
                No issues found in this repository
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default IssueList;