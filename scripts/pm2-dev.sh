#!/bin/bash

# PM2 Development Script for TG-BrainAI Bot
# Usage: ./scripts/pm2-dev.sh [start|stop|restart|logs|status|webhook]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}🤖 TG-BrainAI Bot - PM2 Development Manager${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Function to check if PM2 is installed
check_pm2() {
    if ! command -v pm2 &> /dev/null; then
        print_error "PM2 is not installed. Installing..."
        npm install -g pm2
    fi
}

# Function to ensure logs directory exists
ensure_logs() {
    mkdir -p logs
    touch logs/.gitkeep
}

# Function to start development mode
start_dev() {
    print_header
    print_status "Starting TG-BrainAI Bot in development mode..."

    ensure_logs

    # Stop any existing processes
    pm2 delete tg-brainai-dev 2>/dev/null || true

    # Start the development process with file watching
    pm2 start ecosystem.config.js --only tg-brainai-dev

    print_status "Bot started! Use 'pm2 logs tg-brainai-dev' to view logs"
    print_status "Use 'pm2 monit' for real-time monitoring"
}

# Function to start webhook development mode
start_webhook() {
    print_header
    print_status "Starting TG-BrainAI Bot in webhook development mode..."

    ensure_logs

    # Stop any existing webhook processes
    pm2 delete tg-brainai-webhook-dev 2>/dev/null || true

    # Start the webhook development process
    pm2 start ecosystem.config.js --only tg-brainai-webhook-dev

    print_status "Webhook server started! Check logs for ngrok URL"
    print_status "Use 'pm2 logs tg-brainai-webhook-dev' to view logs"
}

# Function to start production mode
start_prod() {
    print_header
    print_status "Building and starting TG-BrainAI Bot in production mode..."

    # Build the project
    npm run build:prod

    ensure_logs

    # Stop existing production processes
    pm2 delete tg-brainai-bot 2>/dev/null || true

    # Start production process
    pm2 start ecosystem.config.js --only tg-brainai-bot --env production

    print_status "Production bot started!"
    print_status "Use 'pm2 logs tg-brainai-bot' to view logs"
}

# Function to stop all processes
stop_all() {
    print_status "Stopping all TG-BrainAI processes..."
    pm2 delete tg-brainai-dev 2>/dev/null || true
    pm2 delete tg-brainai-webhook-dev 2>/dev/null || true
    pm2 delete tg-brainai-bot 2>/dev/null || true
    pm2 delete tg-brainai-webhook 2>/dev/null || true
    print_status "All processes stopped"
}

# Function to restart processes
restart_all() {
    print_status "Restarting TG-BrainAI processes..."
    pm2 restart ecosystem.config.js
    print_status "All processes restarted"
}

# Function to show logs
show_logs() {
    print_status "Showing logs for all TG-BrainAI processes..."
    pm2 logs --lines 50
}

# Function to show status
show_status() {
    print_header
    print_status "TG-BrainAI Bot Process Status:"
    pm2 list | grep -E "(tg-brainai|Process)" || echo "No TG-BrainAI processes running"
    echo ""
    print_status "Memory usage:"
    pm2 describe tg-brainai-dev 2>/dev/null | grep -E "(memory|cpu)" || true
    pm2 describe tg-brainai-webhook-dev 2>/dev/null | grep -E "(memory|cpu)" || true
}

# Function to monitor
monitor() {
    print_status "Opening PM2 monitoring dashboard..."
    pm2 monit
}

# Function to clean logs
clean_logs() {
    print_status "Cleaning log files..."
    rm -f logs/*.log
    print_status "Logs cleaned"
}

# Function to show help
show_help() {
    print_header
    echo -e "${BLUE}Usage:${NC} ./scripts/pm2-dev.sh [COMMAND]"
    echo ""
    echo -e "${BLUE}Commands:${NC}"
    echo "  start         Start bot in development mode (polling)"
    echo "  webhook       Start bot in webhook development mode"
    echo "  prod          Start bot in production mode"
    echo "  stop          Stop all processes"
    echo "  restart       Restart all processes"
    echo "  logs          Show logs from all processes"
    echo "  status        Show process status and resource usage"
    echo "  monitor       Open PM2 monitoring dashboard"
    echo "  clean         Clean log files"
    echo "  help          Show this help message"
    echo ""
    echo -e "${BLUE}Examples:${NC}"
    echo "  ./scripts/pm2-dev.sh start     # Start development bot"
    echo "  ./scripts/pm2-dev.sh webhook   # Start webhook development"
    echo "  ./scripts/pm2-dev.sh logs      # View logs"
    echo "  ./scripts/pm2-dev.sh monitor   # Open monitoring"
    echo ""
    echo -e "${BLUE}Log files location:${NC} ./logs/"
    echo -e "${BLUE}PM2 configuration:${NC} ./ecosystem.config.js"
}

# Main script logic
main() {
    check_pm2

    case "${1:-help}" in
        "start")
            start_dev
            ;;
        "webhook")
            start_webhook
            ;;
        "prod")
            start_prod
            ;;
        "stop")
            stop_all
            ;;
        "restart")
            restart_all
            ;;
        "logs")
            show_logs
            ;;
        "status")
            show_status
            ;;
        "monitor")
            monitor
            ;;
        "clean")
            clean_logs
            ;;
        "help"|*)
            show_help
            ;;
    esac
}

# Trap to handle script interruption
trap 'echo -e "\n${YELLOW}Script interrupted${NC}"; exit 1' INT

# Run main function
main "$@"
