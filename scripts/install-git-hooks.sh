#!/bin/bash

# Git Hooks Installation Script
# Sets up development git hooks for code quality

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🪝 Installing Git hooks for HSQ Bridge...${NC}"

# Check if we're in a git repository
if [ ! -d "$PROJECT_ROOT/.git" ]; then
    echo "❌ Not in a git repository"
    exit 1
fi

# Create git hooks directory if it doesn't exist
mkdir -p "$PROJECT_ROOT/.git/hooks"

# Install pre-commit hook
if [ -f "$PROJECT_ROOT/.githooks/pre-commit" ]; then
    cp "$PROJECT_ROOT/.githooks/pre-commit" "$PROJECT_ROOT/.git/hooks/pre-commit"
    chmod +x "$PROJECT_ROOT/.git/hooks/pre-commit"
    echo -e "${GREEN}✅ Pre-commit hook installed${NC}"
else
    echo -e "${YELLOW}⚠️  Pre-commit hook not found at .githooks/pre-commit${NC}"
fi

# Set git hooks path (optional, for team consistency)
git config core.hooksPath .githooks

echo -e "${GREEN}🎉 Git hooks installation completed!${NC}"
echo ""
echo -e "${BLUE}📋 Installed hooks:${NC}"
echo "  • pre-commit: Runs linting, type checking, and security checks"
echo ""
echo -e "${BLUE}💡 Configuration:${NC}"
echo "  • Set PRE_COMMIT_RUN_TESTS=true to enable quick tests in pre-commit"
echo "  • Skip pre-commit (not recommended): git commit --no-verify"
echo ""
echo -e "${BLUE}🧪 Test the pre-commit hook:${NC}"
echo "  git add . && git commit -m 'Test commit'"