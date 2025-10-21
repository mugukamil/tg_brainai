#!/bin/bash

# Cron job setup script for TG BrainAI premium expiration task
# This script sets up a daily cron job to check and expire premium subscriptions

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CRON_SCRIPT="$PROJECT_DIR/dist/tasks/expire-premium.js"
LOG_FILE="$PROJECT_DIR/logs/cron-expire-premium.log"
CRON_JOB="0 2 * * * cd $PROJECT_DIR && /usr/bin/node $CRON_SCRIPT >> $LOG_FILE 2>&1"
CRON_COMMENT="# TG BrainAI Premium Expiration Task"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if cron job exists
cron_job_exists() {
    crontab -l 2>/dev/null | grep -F "expire-premium.js" > /dev/null 2>&1
}

# Function to install cron job
install_cron() {
    print_status "Installing premium expiration cron job..."

    # Check if project is built
    if [ ! -f "$CRON_SCRIPT" ]; then
        print_error "Built script not found at $CRON_SCRIPT"
        print_status "Please run 'npm run build' first"
        exit 1
    fi

    # Create logs directory if it doesn't exist
    mkdir -p "$PROJECT_DIR/logs"

    # Check if cron job already exists
    if cron_job_exists; then
        print_warning "Cron job already exists. Use 'update' command to modify it."
        return 1
    fi

    # Add cron job
    (crontab -l 2>/dev/null; echo "$CRON_COMMENT"; echo "$CRON_JOB") | crontab -

    print_success "Cron job installed successfully!"
    print_status "The task will run daily at 2:00 AM"
    print_status "Logs will be written to: $LOG_FILE"
}

# Function to remove cron job
remove_cron() {
    print_status "Removing premium expiration cron job..."

    if ! cron_job_exists; then
        print_warning "Cron job not found"
        return 1
    fi

    # Remove cron job and comment
    crontab -l 2>/dev/null | grep -v "expire-premium.js" | grep -v "TG BrainAI Premium Expiration Task" | crontab -

    print_success "Cron job removed successfully!"
}

# Function to update cron job
update_cron() {
    print_status "Updating premium expiration cron job..."

    if cron_job_exists; then
        remove_cron
    fi

    install_cron
}

# Function to show cron job status
status_cron() {
    print_status "Checking cron job status..."

    if cron_job_exists; then
        print_success "Cron job is installed"
