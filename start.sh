#!/bin/bash

# AI Schedule Agent Startup Script

echo "🤖 Starting AI Schedule Agent..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from template..."
    cp env.example .env
    echo "📝 Please edit .env file with your API keys before running again."
    echo "Required: OPENAI_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET"
    exit 1
fi

# Create data directory if it doesn't exist
mkdir -p data

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start the application
echo "🚀 Starting the application..."
npm start
