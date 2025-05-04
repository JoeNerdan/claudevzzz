import React, { useState, useEffect } from 'react';

const RepoList = ({ currentRepo, onRepoSelect }) => {
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadRepos();
  }, []);

  const loadRepos = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/repos');
      if (!response.ok) {
        throw new Error('Failed to load repositories');
      }
      
      const data = await response.json();
      setRepos(data);
    } catch (error) {
      console.error('Error loading repositories:', error);
      setError('Error loading repositories. Make sure you are logged in to GitHub CLI.');
    } finally {
      setLoading(false);
    }
  };

  const filteredRepos = repos.filter(repo => 
    repo.nameWithOwner.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="card h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Repositories</h2>
        <button 
          onClick={loadRepos} 
          disabled={loading}
          className="btn-outline text-sm px-3 py-1"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>
      
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search repositories..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-400 dark:bg-gray-700 dark:border-gray-600"
        />
      </div>
      
      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded-md mb-4 text-sm">
          {error}
        </div>
      )}
      
      <div className="overflow-y-auto flex-grow">
        {filteredRepos.length > 0 ? (
          filteredRepos.map((repo) => (
            <div
              key={repo.nameWithOwner}
              className={`p-3 mb-2 rounded-md border cursor-pointer transition-colors ${
                currentRepo === repo.nameWithOwner
                  ? 'bg-primary-50 border-primary-200 dark:bg-primary-900/30 dark:border-primary-800'
                  : 'hover:bg-gray-50 border-gray-200 dark:hover:bg-gray-800/50 dark:border-gray-700'
              }`}
              onClick={() => onRepoSelect(repo.nameWithOwner)}
            >
              <div className="flex justify-between items-start">
                <div className="font-medium text-primary-700 dark:text-primary-400 flex items-center">
                  {repo.nameWithOwner}
                  {repo.isPrivate && (
                    <span className="ml-1 text-gray-500">🔒</span>
                  )}
                </div>
                <div className="text-sm text-yellow-600 dark:text-yellow-400">
                  ⭐ {repo.stargazerCount}
                </div>
              </div>
              {repo.description && (
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                  {repo.description}
                </p>
              )}
            </div>
          ))
        ) : (
          <div className="text-center text-gray-500 dark:text-gray-400 py-6">
            {loading ? 'Loading repositories...' : 'No repositories found'}
          </div>
        )}
      </div>
    </div>
  );
};

export default RepoList;