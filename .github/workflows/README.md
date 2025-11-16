# GitHub Actions Workflows

This directory contains CI/CD workflows for the CampusAura project.

## Workflows

### 1. Frontend CI (`frontend-ci.yml`)
- **Triggers**: Push/PR to main or develop affecting frontend
- **Actions**: 
  - Install dependencies
  - Build frontend
  - Upload build artifacts
- **Usage**: Automatically validates frontend changes

### 2. Backend CI (`backend-ci.yml`)
- **Triggers**: Push/PR to main or develop affecting backend
- **Actions**:
  - Install Python dependencies
  - Run code style checks (flake8)
  - Run tests (if available)
- **Usage**: Validates backend code quality

### 3. Deploy to Production (`deploy.yml`)
- **Triggers**: Push to main or manual dispatch
- **Actions**:
  - Build frontend and backend
  - Create deployment package
  - Upload artifacts
- **Usage**: Prepares production deployment
- **Note**: Add your deployment provider steps (AWS, Azure, Docker, etc.)

### 4. Security Scan (`security-scan.yml`)
- **Triggers**: Weekly schedule, dependency changes, manual
- **Actions**:
  - npm audit for frontend
  - safety check for backend
- **Usage**: Regular security vulnerability scanning

## Setup Required

### Environment Secrets (if deploying)
Add these to your GitHub repository secrets:
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - JWT signing secret
- `GEMINI_API_KEY` - Google Gemini API key
- Any deployment provider credentials

### To Enable
1. Push this `.github` folder to your repository
2. Workflows will automatically run on triggers
3. View workflow runs in GitHub Actions tab

## Manual Workflow Trigger
All workflows can be manually triggered:
1. Go to Actions tab in GitHub
2. Select workflow
3. Click "Run workflow"

## Branch Strategy
- `main` - Production branch (runs deploy)
- `develop` - Development branch (runs CI only)
- Feature branches - Create PR to develop/main
