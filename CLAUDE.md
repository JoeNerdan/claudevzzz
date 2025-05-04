# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands
- Start server: `npm start`
- Build Docker image: `docker build -t claudevzzz .`
- Run container: `docker run -it --rm -p 3000:3000 -v claudevzzz-data:/data claudevzzz`

## Code Style Guidelines
- Indentation: 4 spaces for all files (JS, HTML, CSS)
- Quotes: Single quotes for JS strings, double quotes for HTML attributes
- Semicolons: Required at end of statements
- Variables: Use `const` by default, `let` when necessary, avoid `var`
- Naming: camelCase for JS variables/functions, kebab-case for CSS classes
- Async: Use async/await pattern with proper error handling
- Error handling: Use try/catch blocks with specific error responses
- API endpoints: Follow RESTful patterns with proper HTTP status codes
- Comments: Use section headers and explain complex logic

## Project Structure
- server.js: Main Express server with API routes
- public/: Frontend HTML/CSS/JS files
- entrypoint.sh: Container startup script