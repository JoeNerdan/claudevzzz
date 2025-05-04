import React from 'react';

const IssueDetails = ({ issue, repo }) => {
  if (!issue) {
    return (
      <div className="card h-full flex flex-col mb-6">
        <h2 className="text-xl font-semibold mb-4">Issue Details</h2>
        <div className="text-center py-6 text-gray-500">
          Select an issue to view its details
        </div>
      </div>
    );
  }

  return (
    <div className="card mb-6">
      <div className="flex justify-between items-start mb-4">
        <h2 className="text-xl font-semibold">Issue Details</h2>
        <a
          href={`https://github.com/${repo}/issues/${issue.number}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400"
        >
          View on GitHub
        </a>
      </div>
      
      <div className="mb-4">
        <h3 className="text-lg font-medium">
          #{issue.number}: {issue.title}
        </h3>
        {issue.assignees && issue.assignees.length > 0 && (
          <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            <strong>Assigned to:</strong>{' '}
            {issue.assignees.map(assignee => assignee.login).join(', ')}
          </div>
        )}
      </div>
      
      {issue.labels && issue.labels.length > 0 && (
        <div className="mb-4">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Labels:
          </div>
          <div className="flex flex-wrap gap-1">
            {issue.labels.map((label) => (
              <span 
                key={label.name}
                className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
              >
                {label.name}
              </span>
            ))}
          </div>
        </div>
      )}
      
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <div className="bg-gray-50 p-4 rounded-md border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
          {issue.body ? (
            <pre className="whitespace-pre-wrap font-sans">{issue.body}</pre>
          ) : (
            <p className="italic text-gray-500">No description provided</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default IssueDetails;