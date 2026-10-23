@echo off
REM Windows: opens 3 windows (AI service, backend, frontend). MongoDB must already be running.
start "AI Service" cmd /k "cd ai-service && python -m uvicorn main:app --port 8000"
start "Backend"    cmd /k "cd backend && node src/server.js"
start "Frontend"   cmd /k "cd frontend && npm run dev"
echo Open http://localhost:5173 once all three windows show they are running.
