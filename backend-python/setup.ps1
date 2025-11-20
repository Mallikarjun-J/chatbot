# Quick Start Script for CampusAura Python Backend
# Run this script to set up everything automatically

Write-Host "🚀 CampusAura Python Backend Setup" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""

# Check Python version
Write-Host "Checking Python installation..." -ForegroundColor Yellow
$pythonVersion = python --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Python not found! Please install Python 3.10+" -ForegroundColor Red
    exit 1
}
Write-Host "✅ $pythonVersion" -ForegroundColor Green

# Create virtual environment
Write-Host ""
Write-Host "Creating virtual environment..." -ForegroundColor Yellow
if (Test-Path "venv") {
    Write-Host "Virtual environment already exists" -ForegroundColor Gray
} else {
    python -m venv venv
    Write-Host "✅ Virtual environment created" -ForegroundColor Green
}

# Activate virtual environment
Write-Host ""
Write-Host "Activating virtual environment..." -ForegroundColor Yellow
& .\venv\Scripts\Activate.ps1
Write-Host "✅ Virtual environment activated" -ForegroundColor Green

# Install dependencies
Write-Host ""
Write-Host "Installing dependencies (this may take a few minutes)..." -ForegroundColor Yellow
pip install --upgrade pip
pip install -r requirements.txt
Write-Host "✅ Dependencies installed" -ForegroundColor Green

# Download NLP models
Write-Host ""
Write-Host "Downloading NLP models..." -ForegroundColor Yellow
python -m spacy download en_core_web_sm
Write-Host "✅ NLP models downloaded" -ForegroundColor Green

# Setup environment file
Write-Host ""
Write-Host "Setting up environment configuration..." -ForegroundColor Yellow
if (Test-Path ".env") {
    Write-Host ".env already exists" -ForegroundColor Gray
} else {
    Copy-Item ".env.example" ".env"
    Write-Host "✅ Created .env from template" -ForegroundColor Green
    Write-Host ""
    Write-Host "⚠️  IMPORTANT: Edit .env with your configuration!" -ForegroundColor Red
    Write-Host "   - Set MONGODB_URI (use same as Node.js backend)" -ForegroundColor Yellow
    Write-Host "   - Set JWT_SECRET (MUST match Node.js backend)" -ForegroundColor Yellow
    Write-Host "   - Set GEMINI_API_KEY" -ForegroundColor Yellow
    Write-Host ""
    $edit = Read-Host "Open .env in notepad now? (Y/n)"
    if ($edit -ne "n") {
        notepad .env
    }
}

# Create required directories
Write-Host ""
Write-Host "Creating required directories..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path "uploads" | Out-Null
New-Item -ItemType Directory -Force -Path "app/ml/models" | Out-Null
New-Item -ItemType File -Force -Path "uploads/.gitkeep" | Out-Null
Write-Host "✅ Directories created" -ForegroundColor Green

# Test MongoDB connection
Write-Host ""
Write-Host "Testing MongoDB connection..." -ForegroundColor Yellow
$mongoTest = mongo --eval "db.version()" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  MongoDB not running or not installed" -ForegroundColor Yellow
    Write-Host "   Please start MongoDB before running the server" -ForegroundColor Yellow
} else {
    Write-Host "✅ MongoDB is running" -ForegroundColor Green
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "✅ Setup Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host "   1. Ensure .env is configured correctly" -ForegroundColor White
Write-Host "   2. Start MongoDB (if not running)" -ForegroundColor White
Write-Host "   3. Run: python main.py" -ForegroundColor White
Write-Host ""
Write-Host "📚 Documentation:" -ForegroundColor Cyan
Write-Host "   - README.md - Full documentation" -ForegroundColor White
Write-Host "   - MIGRATION_GUIDE.md - Migration from Node.js" -ForegroundColor White
Write-Host "   - http://localhost:3001/docs - API documentation" -ForegroundColor White
Write-Host ""
Write-Host "🚀 Ready to start the server!" -ForegroundColor Green
Write-Host ""

$start = Read-Host "Start the server now? (Y/n)"
if ($start -ne "n") {
    Write-Host ""
    Write-Host "Starting CampusAura Python Backend..." -ForegroundColor Cyan
    python main.py
}
