#!/bin/bash
# Script to access bash shell in first running Docker container

CONTAINER_ID=$(docker ps -q | head -n1)

if [ -z "$CONTAINER_ID" ]; then
    echo "No running Docker containers found."
    exit 1
fi

echo "Connecting to container: $CONTAINER_ID"
docker exec -it $CONTAINER_ID bash