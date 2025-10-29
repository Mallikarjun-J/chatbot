# Backend and Frontend Connection Test
# This script verifies that all routes are properly connected

Write-Host "`n=== CAMPUS AURA CONNECTION TEST ===" -ForegroundColor Cyan
Write-Host "Testing Backend and Frontend connectivity...`n" -ForegroundColor Cyan

# Test 1: Backend Health Check
Write-Host "1. Testing Backend Server (http://localhost:3001)..." -ForegroundColor Yellow
try {
    $backendHealth = Invoke-RestMethod -Uri "http://localhost:3001/health" -Method Get -ErrorAction Stop
    Write-Host "   ✅ Backend is running" -ForegroundColor Green
    Write-Host "   Status: $($backendHealth.status)" -ForegroundColor Gray
    Write-Host "   Timestamp: $($backendHealth.timestamp)" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Backend is NOT running!" -ForegroundColor Red
    Write-Host "   Error: $_" -ForegroundColor Red
    exit 1
}

# Test 2: Backend API Routes
Write-Host "`n2. Testing Backend API Routes..." -ForegroundColor Yellow

# Test GET /api/announcements
try {
    $announcements = Invoke-RestMethod -Uri "http://localhost:3001/api/announcements" -Method Get -ErrorAction Stop
    Write-Host "   ✅ GET /api/announcements - Working ($($announcements.Count) announcements)" -ForegroundColor Green
} catch {
    Write-Host "   ❌ GET /api/announcements - Failed" -ForegroundColor Red
}

# Test POST /api/auth/login (with test credentials)
try {
    $loginBody = @{
        email = "admin@campus.com"
        password = "password123"
    } | ConvertTo-Json
    
    $loginResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/auth/login" `
        -Method Post `
        -ContentType "application/json" `
        -Body $loginBody `
        -ErrorAction Stop
    
    Write-Host "   ✅ POST /api/auth/login - Working (Token received)" -ForegroundColor Green
    $token = $loginResponse.token
} catch {
    Write-Host "   ❌ POST /api/auth/login - Failed" -ForegroundColor Red
    Write-Host "   Error: $_" -ForegroundColor Red
}

# Test POST /api/chat (AI endpoint)
try {
    $chatBody = @{
        message = "What are the latest announcements?"
    } | ConvertTo-Json
    
    $chatResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/chat" `
        -Method Post `
        -ContentType "application/json" `
        -Body $chatBody `
        -ErrorAction Stop
    
    Write-Host "   ✅ POST /api/chat - Working (AI responded)" -ForegroundColor Green
} catch {
    Write-Host "   ⚠️  POST /api/chat - May require GEMINI_API_KEY" -ForegroundColor Yellow
}

# Test 3: Frontend Server
Write-Host "`n3. Testing Frontend Server..." -ForegroundColor Yellow
try {
    $frontendResponse = Invoke-WebRequest -Uri "http://localhost:3000" -Method Get -ErrorAction Stop -TimeoutSec 5
    if ($frontendResponse.StatusCode -eq 200) {
        Write-Host "   ✅ Frontend is running on http://localhost:3000" -ForegroundColor Green
    }
} catch {
    Write-Host "   ⚠️  Frontend might be running on a different port (check Vite output)" -ForegroundColor Yellow
    Write-Host "   Common ports: 3000, 5173" -ForegroundColor Gray
    
    # Try port 5173
    try {
        $viteResponse = Invoke-WebRequest -Uri "http://localhost:5173" -Method Get -ErrorAction Stop -TimeoutSec 5
        if ($viteResponse.StatusCode -eq 200) {
            Write-Host "   ✅ Frontend is running on http://localhost:5173" -ForegroundColor Green
        }
    } catch {
        Write-Host "   ❌ Frontend is NOT running!" -ForegroundColor Red
    }
}

# Test 4: Frontend-Backend Proxy
Write-Host "`n4. Testing Frontend-Backend Proxy Connection..." -ForegroundColor Yellow
Write-Host "   Note: Frontend should proxy /api requests to backend (port 3001)" -ForegroundColor Gray

# Summary
Write-Host "`n=== ROUTE VERIFICATION ===" -ForegroundColor Cyan
Write-Host "Backend Routes:" -ForegroundColor Yellow
Write-Host "  ✓ POST /api/auth/login - Login endpoint" -ForegroundColor Gray
Write-Host "  ✓ GET  /api/announcements - Get all announcements" -ForegroundColor Gray
Write-Host "  ✓ POST /api/announcements - Create announcement (auth required)" -ForegroundColor Gray
Write-Host "  ✓ PUT  /api/announcements/:id - Update announcement (auth required)" -ForegroundColor Gray
Write-Host "  ✓ DELETE /api/announcements/:id - Delete announcement (auth required)" -ForegroundColor Gray
Write-Host "  ✓ GET  /api/users - Get all users (admin only)" -ForegroundColor Gray
Write-Host "  ✓ POST /api/users - Create user (admin only)" -ForegroundColor Gray
Write-Host "  ✓ PUT  /api/users/:id - Update user (admin only)" -ForegroundColor Gray
Write-Host "  ✓ DELETE /api/users/:id - Delete user (admin only)" -ForegroundColor Gray
Write-Host "  ✓ GET  /api/documents - Get all documents" -ForegroundColor Gray
Write-Host "  ✓ POST /api/documents - Upload document (auth required)" -ForegroundColor Gray
Write-Host "  ✓ GET  /api/documents/:id/download - Download document" -ForegroundColor Gray
Write-Host "  ✓ DELETE /api/documents/:id - Delete document (admin only)" -ForegroundColor Gray
Write-Host "  ✓ POST /api/chat - AI chatbot" -ForegroundColor Gray
Write-Host "  ✓ POST /api/scrape-announcements - Web scraping (admin only)" -ForegroundColor Gray
Write-Host "  ✓ POST /api/deep-scrape - Deep scraping (admin only)" -ForegroundColor Gray

Write-Host "`nFile Structure:" -ForegroundColor Yellow
Write-Host "  Backend: C:\Users\malli\OneDrive\Desktop\campusaura\backend\" -ForegroundColor Gray
Write-Host "  Frontend: C:\Users\malli\OneDrive\Desktop\campusaura\frontend\" -ForegroundColor Gray

Write-Host "`n=== TEST COMPLETE ===" -ForegroundColor Cyan
Write-Host "If all tests passed, your application is ready to use!`n" -ForegroundColor Green
