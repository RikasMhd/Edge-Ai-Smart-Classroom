# Smart Classroom Edge AI System — Start Script
# Run this from the project root: s:\EdegAi Project

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Smart Classroom Edge AI System" -ForegroundColor Cyan
Write-Host "  Starting all services..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Start Flask Backend
Write-Host "`n[1/2] Starting Flask Backend on http://localhost:5000 ..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; python backend\app.py" -WindowStyle Normal

# Wait 3 seconds for backend to initialize
Start-Sleep -Seconds 3

# Start React Frontend (dev server)
Write-Host "[2/2] Starting React Dashboard on http://localhost:5173 ..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; npm run dev" -WindowStyle Normal

# Wait 4 seconds for frontend to boot
Start-Sleep -Seconds 4

# Open Dashboard in Browser
Write-Host "`n Opening Dashboard in browser..." -ForegroundColor Green
Start-Process "http://localhost:5173"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  SYSTEM READY!" -ForegroundColor Green
Write-Host ""
Write-Host "  Dashboard:   http://localhost:5173" -ForegroundColor White
Write-Host "  Backend API: http://localhost:5000" -ForegroundColor White
Write-Host ""
Write-Host "  API Endpoints:" -ForegroundColor Gray
Write-Host "    GET  /api/status     - Live system status" -ForegroundColor Gray
Write-Host "    POST /api/simulate   - Simulate occupancy" -ForegroundColor Gray
Write-Host "    POST /api/infer      - Run ONNX AI inference" -ForegroundColor Gray
Write-Host "    GET  /api/history    - Occupancy history log" -ForegroundColor Gray
Write-Host "    POST /api/reset_timer - Reset AC timer" -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor Cyan
