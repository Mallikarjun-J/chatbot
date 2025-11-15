# Start Backend
Write-Host "🚀 Starting CampusAura Backend..." -ForegroundColor Cyan

# Activate virtual environment
if (Test-Path ".\venv\Scripts\Activate.ps1") {
    Write-Host "📦 Activating virtual environment..." -ForegroundColor Yellow
    & ".\venv\Scripts\Activate.ps1"
    Write-Host "✅ Virtual environment activated" -ForegroundColor Green
} else {
    Write-Host "⚠️  No virtual environment found, using global Python" -ForegroundColor Yellow
}

# Start the backend
Write-Host "🔧 Starting FastAPI server on port 3001..." -ForegroundColor Yellow
python main.py
