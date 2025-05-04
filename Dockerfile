FROM alpine:latest

# Install dependencies
RUN apk add --no-cache \
    curl \
    git \
    python3 \
    py3-pip \
    nodejs \
    npm \
    bash \
    coreutils

# Install GitHub CLI
RUN apk add --no-cache libc6-compat wget
RUN wget https://github.com/cli/cli/releases/download/v2.40.1/gh_2.40.1_linux_amd64.tar.gz -O /tmp/gh.tar.gz && \
    tar -xzf /tmp/gh.tar.gz -C /tmp && \
    mv /tmp/gh_*_linux_amd64/bin/gh /usr/local/bin/ && \
    rm -rf /tmp/gh*

# Install Claude Code
RUN npm install -g @anthropic-ai/claude-code

# Set up work directory
WORKDIR /app

# Install Express and other needed packages
COPY package.json .
RUN npm install

# Copy application files
COPY . .

# Create data directory for agent workspaces
RUN mkdir -p /data/workspaces

# Expose port for web interface
EXPOSE 3000

# Entrypoint script to check auth and start web interface
RUN chmod +x /app/entrypoint.sh

ENTRYPOINT ["/app/entrypoint.sh"]