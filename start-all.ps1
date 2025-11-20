# CampusAura - Start All Services
Write-Host "🚀 Starting CampusAura Application..." -ForegroundColor Cyan
Write-Host ""

# Check if MongoDB is running
Write-Host "📦 Checking MongoDB..." -ForegroundColor Yellow
$mongoProcess = Get-Process mongod -ErrorAction SilentlyContinue
if ($mongoProcess) {
    Write-Host "✅ MongoDB is running" -ForegroundColor Green
} else {
    Write-Host "⚠️  MongoDB not detected. Please start MongoDB manually if needed." -ForegroundColor Yellow
}
Write-Host ""

# Start Backend with virtual environment
Write-Host "🔧 Starting Backend (Python FastAPI with venv)..." -ForegroundColor Yellow
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd backend-python; .\start.ps1" -WindowStyle Normal
Start-Sleep -Seconds 3

# Start Frontend
Write-Host "🎨 Starting Frontend (React + Vite)..." -ForegroundColor Yellow
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev" -WindowStyle Normal

Write-Host ""
Write-Host "✅ All services started!" -ForegroundColor Green
Write-Host ""
Write-Host "📱 Access the application:" -ForegroundColor Cyan
Write-Host "   Frontend: http://localhost:3000" -ForegroundColor White
Write-Host "   Backend:  http://localhost:3001" -ForegroundColor White
Write-Host "   API Docs: http://localhost:3001/docs" -ForegroundColor White
Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
