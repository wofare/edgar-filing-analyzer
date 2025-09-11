#!/bin/bash

set -e

# Deployment script for WhatChanged application
# Usage: ./scripts/deploy.sh [environment] [options]

ENVIRONMENT=${1:-production}
SKIP_TESTS=${2:-false}
SKIP_MIGRATIONS=${3:-false}
FORCE=${4:-false}

echo "🚀 Starting deployment to $ENVIRONMENT environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if required commands exist
    command -v node >/dev/null 2>&1 || { log_error "Node.js is required but not installed."; exit 1; }
    command -v npm >/dev/null 2>&1 || { log_error "npm is required but not installed."; exit 1; }
    command -v git >/dev/null 2>&1 || { log_error "git is required but not installed."; exit 1; }
    
    # Check Node.js version
    NODE_VERSION=$(node -v | cut -d'v' -f2)
    REQUIRED_VERSION="18.0.0"
    
    if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
        log_error "Node.js version $REQUIRED_VERSION or higher is required. Current version: $NODE_VERSION"
        exit 1
    fi
    
    # Check if we're in git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        log_error "Not in a git repository"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Check environment configuration
check_environment() {
    log_info "Checking environment configuration..."
    
    case $ENVIRONMENT in
        development|dev)
            ENV_FILE=".env.development"
            ;;
        staging)
            ENV_FILE=".env.staging"
            ;;
        production|prod)
            ENV_FILE=".env.production"
            ;;
        *)
            log_error "Unknown environment: $ENVIRONMENT"
            log_info "Supported environments: development, staging, production"
            exit 1
            ;;
    esac
    
    if [ ! -f "$ENV_FILE" ]; then
        log_warning "Environment file $ENV_FILE not found, using .env.example as reference"
        if [ ! -f ".env.example" ]; then
            log_error "Neither $ENV_FILE nor .env.example found"
            exit 1
        fi
    fi
    
    log_success "Environment configuration check passed"
}

# Check working directory status
check_git_status() {
    log_info "Checking git status..."
    
    # Check if there are uncommitted changes
    if ! git diff-index --quiet HEAD --; then
        if [ "$FORCE" != "true" ]; then
            log_error "Working directory is not clean. Commit your changes first."
            log_info "Use --force to override this check"
            exit 1
        else
            log_warning "Working directory is not clean, but continuing due to --force flag"
        fi
    fi
    
    # Check if we're on the correct branch
    CURRENT_BRANCH=$(git branch --show-current)
    
    case $ENVIRONMENT in
        production)
            EXPECTED_BRANCH="main"
            ;;
        staging)
            EXPECTED_BRANCH="staging"
            ;;
        development)
            EXPECTED_BRANCH="develop"
            ;;
        *)
            EXPECTED_BRANCH=$CURRENT_BRANCH
            ;;
    esac
    
    if [ "$CURRENT_BRANCH" != "$EXPECTED_BRANCH" ] && [ "$FORCE" != "true" ]; then
        log_error "Expected to be on branch '$EXPECTED_BRANCH' but currently on '$CURRENT_BRANCH'"
        log_info "Use --force to override this check"
        exit 1
    fi
    
    log_success "Git status check passed"
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    
    # Clean install
    rm -rf node_modules package-lock.json
    npm install
    
    # Install production dependencies only for production environment
    if [ "$ENVIRONMENT" = "production" ]; then
        npm ci --only=production
    fi
    
    log_success "Dependencies installed"
}

# Run tests
run_tests() {
    if [ "$SKIP_TESTS" = "true" ]; then
        log_warning "Skipping tests due to --skip-tests flag"
        return 0
    fi
    
    log_info "Running tests..."
    
    # Type checking
    npm run type-check
    
    # Linting
    npm run lint
    
    # Unit tests
    npm run test:unit
    
    # Integration tests (only in CI or staging/production)
    if [ "$ENVIRONMENT" != "development" ] || [ "$CI" = "true" ]; then
        npm run test:integration
    fi
    
    log_success "Tests passed"
}

# Build application
build_application() {
    log_info "Building application..."
    
    # Set environment
    export NODE_ENV=$ENVIRONMENT
    
    # Generate Prisma client
    npx prisma generate
    
    # Build Next.js application
    npm run build
    
    log_success "Application built successfully"
}

# Run database migrations
run_migrations() {
    if [ "$SKIP_MIGRATIONS" = "true" ]; then
        log_warning "Skipping database migrations due to --skip-migrations flag"
        return 0
    fi
    
    log_info "Running database migrations..."
    
    # Check database connection
    npx prisma db push --preview-feature || {
        log_error "Database connection failed"
        exit 1
    }
    
    # Run migrations
    npx prisma migrate deploy
    
    log_success "Database migrations completed"
}

# Deploy to Vercel
deploy_vercel() {
    log_info "Deploying to Vercel..."
    
    # Check if Vercel CLI is installed
    if ! command -v vercel >/dev/null 2>&1; then
        log_info "Installing Vercel CLI..."
        npm install -g vercel@latest
    fi
    
    # Deploy
    case $ENVIRONMENT in
        production)
            vercel --prod --confirm
            ;;
        staging)
            vercel --confirm
            ;;
        *)
            vercel --confirm
            ;;
    esac
    
    log_success "Deployment to Vercel completed"
}

# Deploy with Docker
deploy_docker() {
    log_info "Deploying with Docker..."
    
    # Build Docker image
    DOCKER_TAG="whatchanged:$ENVIRONMENT-$(git rev-parse --short HEAD)"
    
    docker build -t $DOCKER_TAG .
    
    # Stop existing containers
    docker-compose -f docker-compose.yml down
    
    # Start new containers
    if [ "$ENVIRONMENT" = "development" ]; then
        docker-compose -f docker-compose.dev.yml up -d
    else
        docker-compose -f docker-compose.yml up -d
    fi
    
    log_success "Docker deployment completed"
}

# Health check
health_check() {
    log_info "Performing health check..."
    
    # Wait for application to start
    sleep 30
    
    # Check health endpoint
    HEALTH_URL="http://localhost:3000/api/health"
    
    for i in {1..5}; do
        if curl -f $HEALTH_URL > /dev/null 2>&1; then
            log_success "Health check passed"
            return 0
        fi
        log_info "Health check attempt $i failed, retrying in 10 seconds..."
        sleep 10
    done
    
    log_error "Health check failed after 5 attempts"
    exit 1
}

# Cleanup
cleanup() {
    log_info "Cleaning up..."
    
    # Remove temporary files
    rm -rf .next/cache
    rm -rf coverage
    rm -rf test-results
    
    log_success "Cleanup completed"
}

# Main deployment flow
main() {
    log_info "=== WhatChanged Deployment Script ==="
    log_info "Environment: $ENVIRONMENT"
    log_info "Skip Tests: $SKIP_TESTS"
    log_info "Skip Migrations: $SKIP_MIGRATIONS"
    log_info "Force: $FORCE"
    echo
    
    # Pre-deployment checks
    check_prerequisites
    check_environment
    check_git_status
    
    # Build phase
    install_dependencies
    run_tests
    build_application
    
    # Database phase
    run_migrations
    
    # Deployment phase
    if command -v vercel >/dev/null 2>&1 && [ -f "vercel.json" ]; then
        deploy_vercel
    elif command -v docker >/dev/null 2>&1 && [ -f "docker-compose.yml" ]; then
        deploy_docker
    else
        log_warning "No deployment method detected (Vercel CLI or Docker)"
        log_info "Application is built and ready for manual deployment"
    fi
    
    # Post-deployment
    health_check
    cleanup
    
    log_success "🎉 Deployment to $ENVIRONMENT completed successfully!"
    
    # Display deployment info
    echo
    log_info "=== Deployment Summary ==="
    log_info "Environment: $ENVIRONMENT"
    log_info "Git Commit: $(git rev-parse --short HEAD)"
    log_info "Build Time: $(date)"
    
    if [ -f ".vercel/project.json" ]; then
        PROJECT_NAME=$(cat .vercel/project.json | grep -o '"name":"[^"]*' | cut -d'"' -f4)
        log_info "Vercel URL: https://$PROJECT_NAME.vercel.app"
    fi
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --skip-migrations)
            SKIP_MIGRATIONS=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [environment] [options]"
            echo
            echo "Environments:"
            echo "  development, dev    Deploy to development environment"
            echo "  staging             Deploy to staging environment"  
            echo "  production, prod    Deploy to production environment"
            echo
            echo "Options:"
            echo "  --skip-tests        Skip running tests"
            echo "  --skip-migrations   Skip database migrations"
            echo "  --force            Force deployment even with uncommitted changes"
            echo "  --help, -h         Show this help message"
            exit 0
            ;;
        *)
            if [ -z "$ENVIRONMENT_SET" ]; then
                ENVIRONMENT=$1
                ENVIRONMENT_SET=true
            fi
            shift
            ;;
    esac
done

# Run main function
main

exit 0