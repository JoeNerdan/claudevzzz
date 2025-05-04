import React from 'react';
import { Link } from 'react-router-dom';

const Navbar = () => {
  return (
    <nav className="bg-white shadow-sm dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <span className="text-xl font-bold text-primary-600 dark:text-primary-400">Claudevzzz</span>
            </div>
            <div className="ml-2 text-gray-500 dark:text-gray-400">
              GitHub Issue Assistant
            </div>
          </div>
          <div className="flex items-center">
            <a 
              href="https://github.com/anthropics/claude-code" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
            >
              Powered by Claude Code
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;