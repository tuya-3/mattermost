# Mattermost Development Environment

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Overview

Mattermost is a collaboration platform written in Go (server) and React/TypeScript (webapp), distributed as a single Linux binary that relies on PostgreSQL. The repository consists of multiple major components:

- `server/` - Go-based backend API server and CLI tools
- `webapp/` - React/TypeScript frontend application 
- `api/` - OpenAPI documentation
- `e2e-tests/` - Playwright-based end-to-end testing suite

## Prerequisites and Setup

### Required Software Versions
- **Go**: Version 1.24.5 (check with `cat server/.go-version`)
- **Node.js**: Version 20.11 (check with `cat .nvmrc`)  
- **npm**: Version 9.0.0+ or 10.0.0+
- **Docker**: Required for local database services
- **Make**: Required for build automation

### Bootstrap Commands
Run these commands in order to set up a fresh development environment:

1. **Setup Go workspace:**
   ```bash
   cd server && make setup-go-work
   ```
   Takes ~1 second.

2. **Install webapp dependencies:**
   ```bash
   cd webapp && npm install
   ```
   Takes ~4-5 minutes. NEVER CANCEL. Set timeout to 10+ minutes.

3. **Build webapp:**
   ```bash
   cd webapp && npm run build
   ```
   Takes ~3 minutes. NEVER CANCEL. Set timeout to 10+ minutes.

4. **Build server binaries:**
   ```bash
   cd server && make prepackaged-binaries
   ```
   Takes ~2-3 minutes. NEVER CANCEL. Set timeout to 10+ minutes.

5. **Build server application:**
   ```bash
   cd server && make build-linux
   ```
   Takes ~4 minutes. NEVER CANCEL. Set timeout to 15+ minutes.

## Development Commands

### Server Development
- **Start server with database:** `cd server && make run-server`
  - Requires Docker services running first: `make start-docker`
  - Database setup takes 3-5 minutes on first run. NEVER CANCEL.
- **Build server only:** `cd server && make build-linux` (4 minutes)
- **Build mmctl CLI:** `cd server && make mmctl-build` (2 minutes)
- **Run server tests:** `cd server && make test-server` (15+ minutes. NEVER CANCEL. Set timeout to 30+ minutes.)

### Webapp Development
- **Development server:** `cd webapp && npm run dev-server`
- **Production build:** `cd webapp && npm run build` (3 minutes. NEVER CANCEL.)
- **Run tests:** `cd webapp && npm run test` (10+ minutes. NEVER CANCEL. Set timeout to 20+ minutes.)
- **Run CI tests:** `cd webapp && npm run test-ci` (10+ minutes. NEVER CANCEL. Set timeout to 20+ minutes.)
- **Type checking:** `cd webapp && npm run check-types`
- **Linting:** `cd webapp && npm run check`
- **Fix linting:** `cd webapp && npm run fix`

### E2E Testing (Playwright)
Navigate to `e2e-tests/playwright/` for all E2E commands:

- **Install dependencies:** `npm ci --ignore-scripts` then `npx playwright install`
- **Run specific test:** `npm run test -- <test-name>`
- **Run all tests:** `npm run test` (excludes visual tests)
- **Run CI tests:** `npm run test:ci` (Chrome only, excludes visual)
- **Visual tests:** `npm run test -- visual` (requires Docker container)
- **UI mode:** `npm run playwright-ui`

## Build Timing and Warnings

### Critical Timing Information
- **NEVER CANCEL any build or test command** - builds may take 15+ minutes
- **Webapp npm install**: 4-5 minutes (set timeout to 600+ seconds)
- **Webapp build**: 3 minutes (set timeout to 600+ seconds)  
- **Server build**: 4 minutes (set timeout to 900+ seconds)
- **Test suites**: 10-20 minutes (set timeout to 1200+ seconds)
- **Docker service startup**: 3-5 minutes (set timeout to 600+ seconds)

### Expected Build Warnings
- npm security vulnerabilities during `npm install` are expected
- Webpack asset size warnings during webapp build are expected
- Sass deprecation warnings are expected
- Go dependency downloads on first build are expected

## Validation and Testing

### Manual Validation Requirements
Before considering any changes complete, you MUST:

1. **Build validation:**
   ```bash
   cd server && make build-linux
   cd ../webapp && npm run build
   ```

2. **Lint validation:**
   ```bash
   cd webapp && npm run check
   cd ../server && make golangci-lint
   ```

3. **Basic test validation:**
   ```bash
   cd webapp && npm run test-ci
   cd ../server && make test-server-quick
   ```

### Running the Application
To run the full application locally:

1. **Start database services:**
   ```bash
   cd server && make start-docker
   ```
   Wait 3-5 minutes for services to be ready. NEVER CANCEL.

2. **Run server (separate terminal):**
   ```bash
   cd server && make run-server
   ```

3. **Run webapp (separate terminal):**
   ```bash
   cd webapp && make run
   ```

4. **Access application:**
   - Open browser to `http://localhost:8065`
   - Default admin credentials are typically created during first setup

### Test Scenarios
Always validate changes by testing these core workflows:
- User registration and login
- Channel creation and messaging
- File upload and sharing
- Basic admin console navigation

## Repository Structure

### Key Directories
```
├── server/                 # Go backend application
│   ├── cmd/               # CLI applications (mattermost, mmctl)
│   ├── api/               # API route handlers  
│   ├── model/             # Data models and validation
│   ├── store/             # Database layer
│   ├── config/            # Configuration management
│   └── build/             # Build scripts and Docker files
├── webapp/                # React frontend application
│   ├── channels/          # Main web app
│   ├── platform/          # Shared libraries and components
│   └── scripts/           # Build and development scripts
├── e2e-tests/            # End-to-end testing
│   └── playwright/       # Playwright test specs
├── api/                  # OpenAPI specification
└── .github/              # GitHub Actions and templates
```

### Important Configuration Files
- `server/config/config.json` - Server configuration (generated)
- `webapp/package.json` - Frontend dependencies and scripts
- `server/Makefile` - Server build targets
- `webapp/Makefile` - Frontend build targets
- `.github/workflows/` - CI/CD pipeline definitions

## Common Issues and Solutions

### Build Issues
- **"go.work file not found"**: Run `cd server && make setup-go-work`
- **Node.js version mismatch**: Use Node.js version specified in `.nvmrc`
- **npm install failures**: Delete `node_modules` and `package-lock.json`, then retry
- **Docker service failures**: Check Docker daemon is running and ports 5432, 6379, 9000 are available

### Development Issues  
- **Changes not reflected**: Restart development servers
- **Database connection issues**: Run `make start-docker` and wait for services
- **Port conflicts**: Default ports are 8065 (server), 9005 (webpack-dev-server)

### Testing Issues
- **E2E test browser install failures**: Use `npm ci --ignore-scripts` then `npx playwright install`
- **Visual test inconsistencies**: Run visual tests only within Docker containers
- **Test timeouts**: Always set adequate timeouts (20+ minutes for full test suites)

## CI/CD Integration

### Pre-commit Requirements
Always run these before committing:
```bash
cd webapp && npm run check && npm run check-types
cd ../server && make golangci-lint
```

### GitHub Actions
The repository uses these main CI workflows:
- `server-ci.yml` - Server build, test, and lint validation
- `webapp-ci.yml` - Frontend build, test, and lint validation  
- `e2e-tests-ci.yml` - End-to-end testing in multiple browsers

All CI builds expect clean linting and passing tests. Build times in CI are typically 10-30 minutes per workflow.