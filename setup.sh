#!/bin/bash
echo "Installing backend dependencies..."
cd /workspaces/DailyAIBird/backend
pip install -r requirements.txt
echo "✅ Dependencies installed!"
echo ""
echo "Now test the scrapers with:"
echo "  python /workspaces/DailyAIBird/test_scrapers.py --source openai-blog"
