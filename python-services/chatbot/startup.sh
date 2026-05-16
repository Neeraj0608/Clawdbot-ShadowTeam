#!/bin/bash
echo "Starting CoE AI Chatbot on port 8001..."
cd "$(dirname "$0")"
uvicorn main:app --host 0.0.0.0 --port 8001 --workers 1
