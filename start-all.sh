#!/bin/bash
# Mac/Linux: starts AI service, backend and frontend together. MongoDB must already be running.
cd "$(dirname "$0")"
(cd ai-service && python3 -m uvicorn main:app --port 8000) &
(cd backend && node src/server.js) &
(cd frontend && npm run dev) &
trap 'kill 0' EXIT
wait
