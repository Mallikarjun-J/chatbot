# Start Both Backend and Frontend Servers

Write-Host "🚀 Starting CampusAura Full Stack Application" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""

# Start Backend in new window
Write-Host "📡 Starting Backend Server (Port 3001)..." -ForegroundColor Yellow
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; Write-Host '🚀 Backend Server' -ForegroundColor Green; npm start"

Start-Sleep -Seconds 3

# Start Frontend in new window  
Write-Host "🎨 Starting Frontend App (Port 3000)..." -ForegroundColor Yellow
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; Write-Host '🎨 Frontend App' -ForegroundColor Cyan; npm run dev"

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "✅ Both servers are starting!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Server URLs:" -ForegroundColor Cyan
Write-Host "  Backend API:  http://localhost:3001" -ForegroundColor White
Write-Host "  Frontend App: http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "💡 Check the new terminal windows for server logs" -ForegroundColor Yellow
