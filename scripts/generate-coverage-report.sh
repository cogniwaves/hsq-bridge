#!/bin/bash

# Coverage Report Generator
# Creates comprehensive coverage reports with quality gates

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
REPORTS_DIR="$PROJECT_ROOT/test-reports"
COVERAGE_THRESHOLD=70
COVERAGE_THRESHOLD_HIGH=85

# Quality gate thresholds
BACKEND_THRESHOLD_LINES=70
BACKEND_THRESHOLD_FUNCTIONS=70
BACKEND_THRESHOLD_BRANCHES=65
BACKEND_THRESHOLD_STATEMENTS=70

DASHBOARD_THRESHOLD_LINES=60
DASHBOARD_THRESHOLD_FUNCTIONS=60
DASHBOARD_THRESHOLD_BRANCHES=55
DASHBOARD_THRESHOLD_STATEMENTS=60

# Function to check if jq is available
check_jq() {
    if ! command -v jq &> /dev/null; then
        log_error "jq is required but not installed"
        log_info "Install with: sudo apt-get install jq"
        exit 1
    fi
}

# Function to parse coverage data
parse_coverage_json() {
    local coverage_file="$1"
    local component="$2"
    
    if [ ! -f "$coverage_file" ]; then
        log_warning "Coverage file not found: $coverage_file"
        return 1
    fi
    
    local total_coverage=$(cat "$coverage_file" | jq -r '.total')
    
    if [ "$total_coverage" = "null" ]; then
        log_warning "Invalid coverage data in $coverage_file"
        return 1
    fi
    
    # Extract metrics
    local lines=$(echo "$total_coverage" | jq -r '.lines.pct // 0')
    local statements=$(echo "$total_coverage" | jq -r '.statements.pct // 0')
    local functions=$(echo "$total_coverage" | jq -r '.functions.pct // 0')
    local branches=$(echo "$total_coverage" | jq -r '.branches.pct // 0')
    
    # Store results in global variables for later use
    eval "${component}_coverage_lines=$lines"
    eval "${component}_coverage_statements=$statements"
    eval "${component}_coverage_functions=$functions"
    eval "${component}_coverage_branches=$branches"
    
    log_info "$component coverage - Lines: $lines%, Statements: $statements%, Functions: $functions%, Branches: $branches%"
    
    return 0
}

# Function to generate quality gate status
check_quality_gates() {
    local component="$1"
    local lines_threshold functions_threshold branches_threshold statements_threshold
    
    case $component in
        "backend")
            lines_threshold=$BACKEND_THRESHOLD_LINES
            functions_threshold=$BACKEND_THRESHOLD_FUNCTIONS
            branches_threshold=$BACKEND_THRESHOLD_BRANCHES
            statements_threshold=$BACKEND_THRESHOLD_STATEMENTS
            ;;
        "dashboard")
            lines_threshold=$DASHBOARD_THRESHOLD_LINES
            functions_threshold=$DASHBOARD_THRESHOLD_FUNCTIONS
            branches_threshold=$DASHBOARD_THRESHOLD_BRANCHES
            statements_threshold=$DASHBOARD_THRESHOLD_STATEMENTS
            ;;
        *)
            log_error "Unknown component: $component"
            return 1
            ;;
    esac
    
    # Get coverage values
    local lines_var="${component}_coverage_lines"
    local statements_var="${component}_coverage_statements"
    local functions_var="${component}_coverage_functions"
    local branches_var="${component}_coverage_branches"
    
    local lines_coverage=${!lines_var}
    local statements_coverage=${!statements_var}
    local functions_coverage=${!functions_var}
    local branches_coverage=${!branches_var}
    
    local failed_gates=()
    
    # Check each threshold
    if (( $(echo "$lines_coverage < $lines_threshold" | bc -l) )); then
        failed_gates+=("Lines: $lines_coverage% < $lines_threshold%")
    fi
    
    if (( $(echo "$statements_coverage < $statements_threshold" | bc -l) )); then
        failed_gates+=("Statements: $statements_coverage% < $statements_threshold%")
    fi
    
    if (( $(echo "$functions_coverage < $functions_threshold" | bc -l) )); then
        failed_gates+=("Functions: $functions_coverage% < $functions_threshold%")
    fi
    
    if (( $(echo "$branches_coverage < $branches_threshold" | bc -l) )); then
        failed_gates+=("Branches: $branches_coverage% < $branches_threshold%")
    fi
    
    if [ ${#failed_gates[@]} -eq 0 ]; then
        log_success "$component quality gates PASSED"
        eval "${component}_quality_gate_status=PASSED"
        return 0
    else
        log_error "$component quality gates FAILED:"
        for gate in "${failed_gates[@]}"; do
            log_error "  - $gate"
        done
        eval "${component}_quality_gate_status=FAILED"
        return 1
    fi
}

# Function to generate HTML coverage report
generate_html_report() {
    log_info "Generating HTML coverage report..."
    
    mkdir -p "$REPORTS_DIR"
    
    local html_file="$REPORTS_DIR/coverage-report.html"
    
    cat > "$html_file" << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HSQ Bridge - Test Coverage Report</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f8f9fa;
            color: #333;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { 
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-bottom: 30px;
        }
        .header h1 { 
            margin: 0 0 10px 0;
            color: #2c3e50;
        }
        .header .meta { 
            color: #666;
            font-size: 14px;
        }
        .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-bottom: 30px;
        }
        .card {
            background: white;
            padding: 25px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .card h2 {
            margin: 0 0 20px 0;
            color: #2c3e50;
            font-size: 18px;
        }
        .metric {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 0;
            border-bottom: 1px solid #eee;
        }
        .metric:last-child { border-bottom: none; }
        .metric-name { font-weight: 500; }
        .metric-value {
            font-weight: bold;
            font-size: 16px;
        }
        .metric-value.high { color: #27ae60; }
        .metric-value.medium { color: #f39c12; }
        .metric-value.low { color: #e74c3c; }
        .progress-bar {
            width: 100%;
            height: 8px;
            background: #ecf0f1;
            border-radius: 4px;
            overflow: hidden;
            margin-top: 8px;
        }
        .progress-fill {
            height: 100%;
            transition: width 0.3s ease;
        }
        .progress-fill.high { background: #27ae60; }
        .progress-fill.medium { background: #f39c12; }
        .progress-fill.low { background: #e74c3c; }
        .status-badge {
            display: inline-block;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
        }
        .status-badge.passed {
            background: #d5f4e6;
            color: #27ae60;
        }
        .status-badge.failed {
            background: #fdeaea;
            color: #e74c3c;
        }
        .summary {
            background: white;
            padding: 25px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .links {
            margin-top: 20px;
        }
        .links a {
            display: inline-block;
            margin-right: 15px;
            color: #3498db;
            text-decoration: none;
            font-weight: 500;
        }
        .links a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 Test Coverage Report</h1>
            <div class="meta">
                Generated on: __TIMESTAMP__<br>
                Project: HSQ Bridge - HubSpot-Stripe-QuickBooks Integration
            </div>
        </div>
        
        <div class="grid">
            <div class="card">
                <h2>🔧 Backend Coverage</h2>
                <div class="metric">
                    <span class="metric-name">Lines</span>
                    <span class="metric-value __BACKEND_LINES_CLASS__">__BACKEND_LINES__%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill __BACKEND_LINES_CLASS__" style="width: __BACKEND_LINES__%"></div>
                </div>
                
                <div class="metric">
                    <span class="metric-name">Statements</span>
                    <span class="metric-value __BACKEND_STATEMENTS_CLASS__">__BACKEND_STATEMENTS__%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill __BACKEND_STATEMENTS_CLASS__" style="width: __BACKEND_STATEMENTS__%"></div>
                </div>
                
                <div class="metric">
                    <span class="metric-name">Functions</span>
                    <span class="metric-value __BACKEND_FUNCTIONS_CLASS__">__BACKEND_FUNCTIONS__%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill __BACKEND_FUNCTIONS_CLASS__" style="width: __BACKEND_FUNCTIONS__%"></div>
                </div>
                
                <div class="metric">
                    <span class="metric-name">Branches</span>
                    <span class="metric-value __BACKEND_BRANCHES_CLASS__">__BACKEND_BRANCHES__%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill __BACKEND_BRANCHES_CLASS__" style="width: __BACKEND_BRANCHES__%"></div>
                </div>
                
                <div style="margin-top: 20px;">
                    <span class="status-badge __BACKEND_STATUS_CLASS__">Quality Gate: __BACKEND_STATUS__</span>
                </div>
            </div>
            
            <div class="card">
                <h2>🖥️ Dashboard Coverage</h2>
                <div class="metric">
                    <span class="metric-name">Lines</span>
                    <span class="metric-value __DASHBOARD_LINES_CLASS__">__DASHBOARD_LINES__%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill __DASHBOARD_LINES_CLASS__" style="width: __DASHBOARD_LINES__%"></div>
                </div>
                
                <div class="metric">
                    <span class="metric-name">Statements</span>
                    <span class="metric-value __DASHBOARD_STATEMENTS_CLASS__">__DASHBOARD_STATEMENTS__%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill __DASHBOARD_STATEMENTS_CLASS__" style="width: __DASHBOARD_STATEMENTS__%"></div>
                </div>
                
                <div class="metric">
                    <span class="metric-name">Functions</span>
                    <span class="metric-value __DASHBOARD_FUNCTIONS_CLASS__">__DASHBOARD_FUNCTIONS__%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill __DASHBOARD_FUNCTIONS_CLASS__" style="width: __DASHBOARD_FUNCTIONS__%"></div>
                </div>
                
                <div class="metric">
                    <span class="metric-name">Branches</span>
                    <span class="metric-value __DASHBOARD_BRANCHES_CLASS__">__DASHBOARD_BRANCHES__%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill __DASHBOARD_BRANCHES_CLASS__" style="width: __DASHBOARD_BRANCHES__%"></div>
                </div>
                
                <div style="margin-top: 20px;">
                    <span class="status-badge __DASHBOARD_STATUS_CLASS__">Quality Gate: __DASHBOARD_STATUS__</span>
                </div>
            </div>
        </div>
        
        <div class="summary">
            <h2>📊 Summary</h2>
            <p><strong>Overall Status:</strong> <span class="status-badge __OVERALL_STATUS_CLASS__">__OVERALL_STATUS__</span></p>
            
            <h3>Quality Gate Thresholds</h3>
            <ul>
                <li><strong>Backend:</strong> Lines ≥70%, Statements ≥70%, Functions ≥70%, Branches ≥65%</li>
                <li><strong>Dashboard:</strong> Lines ≥60%, Statements ≥60%, Functions ≥60%, Branches ≥55%</li>
            </ul>
            
            <div class="links">
                <a href="backend-coverage/lcov-report/index.html">📁 Detailed Backend Coverage</a>
                <a href="dashboard-coverage/lcov-report/index.html">📁 Detailed Dashboard Coverage</a>
                <a href="coverage-badge.svg">🏷️ Coverage Badge</a>
            </div>
        </div>
    </div>
</body>
</html>
EOF

    log_success "HTML coverage report template created: $html_file"
}

# Function to get CSS class based on coverage percentage
get_coverage_class() {
    local percentage=$1
    
    if (( $(echo "$percentage >= 80" | bc -l) )); then
        echo "high"
    elif (( $(echo "$percentage >= 60" | bc -l) )); then
        echo "medium"
    else
        echo "low"
    fi
}

# Function to substitute values in HTML template
substitute_html_values() {
    local html_file="$REPORTS_DIR/coverage-report.html"
    
    # Substitute timestamp
    sed -i "s/__TIMESTAMP__/$(date)/g" "$html_file"
    
    # Substitute backend values
    sed -i "s/__BACKEND_LINES__/${backend_coverage_lines:-0}/g" "$html_file"
    sed -i "s/__BACKEND_STATEMENTS__/${backend_coverage_statements:-0}/g" "$html_file"
    sed -i "s/__BACKEND_FUNCTIONS__/${backend_coverage_functions:-0}/g" "$html_file"
    sed -i "s/__BACKEND_BRANCHES__/${backend_coverage_branches:-0}/g" "$html_file"
    
    # Substitute backend CSS classes
    sed -i "s/__BACKEND_LINES_CLASS__/$(get_coverage_class ${backend_coverage_lines:-0})/g" "$html_file"
    sed -i "s/__BACKEND_STATEMENTS_CLASS__/$(get_coverage_class ${backend_coverage_statements:-0})/g" "$html_file"
    sed -i "s/__BACKEND_FUNCTIONS_CLASS__/$(get_coverage_class ${backend_coverage_functions:-0})/g" "$html_file"
    sed -i "s/__BACKEND_BRANCHES_CLASS__/$(get_coverage_class ${backend_coverage_branches:-0})/g" "$html_file"
    
    # Substitute dashboard values
    sed -i "s/__DASHBOARD_LINES__/${dashboard_coverage_lines:-0}/g" "$html_file"
    sed -i "s/__DASHBOARD_STATEMENTS__/${dashboard_coverage_statements:-0}/g" "$html_file"
    sed -i "s/__DASHBOARD_FUNCTIONS__/${dashboard_coverage_functions:-0}/g" "$html_file"
    sed -i "s/__DASHBOARD_BRANCHES__/${dashboard_coverage_branches:-0}/g" "$html_file"
    
    # Substitute dashboard CSS classes
    sed -i "s/__DASHBOARD_LINES_CLASS__/$(get_coverage_class ${dashboard_coverage_lines:-0})/g" "$html_file"
    sed -i "s/__DASHBOARD_STATEMENTS_CLASS__/$(get_coverage_class ${dashboard_coverage_statements:-0})/g" "$html_file"
    sed -i "s/__DASHBOARD_FUNCTIONS_CLASS__/$(get_coverage_class ${dashboard_coverage_functions:-0})/g" "$html_file"
    sed -i "s/__DASHBOARD_BRANCHES_CLASS__/$(get_coverage_class ${dashboard_coverage_branches:-0})/g" "$html_file"
    
    # Substitute status values
    local backend_status_class=$([ "$backend_quality_gate_status" = "PASSED" ] && echo "passed" || echo "failed")
    local dashboard_status_class=$([ "$dashboard_quality_gate_status" = "PASSED" ] && echo "passed" || echo "failed")
    
    sed -i "s/__BACKEND_STATUS__/${backend_quality_gate_status:-UNKNOWN}/g" "$html_file"
    sed -i "s/__BACKEND_STATUS_CLASS__/$backend_status_class/g" "$html_file"
    sed -i "s/__DASHBOARD_STATUS__/${dashboard_quality_gate_status:-UNKNOWN}/g" "$html_file"
    sed -i "s/__DASHBOARD_STATUS_CLASS__/$dashboard_status_class/g" "$html_file"
    
    # Overall status
    local overall_status="PASSED"
    local overall_status_class="passed"
    
    if [ "$backend_quality_gate_status" = "FAILED" ] || [ "$dashboard_quality_gate_status" = "FAILED" ]; then
        overall_status="FAILED"
        overall_status_class="failed"
    fi
    
    sed -i "s/__OVERALL_STATUS__/$overall_status/g" "$html_file"
    sed -i "s/__OVERALL_STATUS_CLASS__/$overall_status_class/g" "$html_file"
}

# Function to generate coverage badge
generate_coverage_badge() {
    log_info "Generating coverage badge..."
    
    # Calculate overall coverage (weighted average)
    local overall_lines=$(echo "($backend_coverage_lines + $dashboard_coverage_lines) / 2" | bc -l)
    local overall_coverage=$(printf "%.1f" "$overall_lines")
    
    local color="red"
    if (( $(echo "$overall_coverage >= 80" | bc -l) )); then
        color="brightgreen"
    elif (( $(echo "$overall_coverage >= 60" | bc -l) )); then
        color="yellow"
    fi
    
    # Generate SVG badge
    cat > "$REPORTS_DIR/coverage-badge.svg" << EOF
<svg xmlns="http://www.w3.org/2000/svg" width="104" height="20">
  <defs>
    <linearGradient id="b" x2="0" y2="100%">
      <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
      <stop offset="1" stop-opacity=".1"/>
    </linearGradient>
  </defs>
  <mask id="a">
    <rect width="104" height="20" rx="3" fill="#fff"/>
  </mask>
  <g mask="url(#a)">
    <path fill="#555" d="M0 0h63v20H0z"/>
    <path fill="$color" d="M63 0h41v20H63z"/>
    <path fill="url(#b)" d="M0 0h104v20H0z"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
    <text x="31.5" y="15" fill="#010101" fill-opacity=".3">coverage</text>
    <text x="31.5" y="14">coverage</text>
    <text x="82.5" y="15" fill="#010101" fill-opacity=".3">${overall_coverage}%</text>
    <text x="82.5" y="14">${overall_coverage}%</text>
  </g>
</svg>
EOF

    log_success "Coverage badge generated: $REPORTS_DIR/coverage-badge.svg"
}

# Function to generate JSON summary
generate_json_summary() {
    log_info "Generating JSON summary..."
    
    local json_file="$REPORTS_DIR/coverage-summary.json"
    
    cat > "$json_file" << EOF
{
  "timestamp": "$(date -Iseconds)",
  "project": "HSQ Bridge",
  "overall": {
    "qualityGate": "$([ "$backend_quality_gate_status" = "PASSED" ] && [ "$dashboard_quality_gate_status" = "PASSED" ] && echo "PASSED" || echo "FAILED")",
    "averageCoverage": $(echo "($backend_coverage_lines + $dashboard_coverage_lines) / 2" | bc -l)
  },
  "backend": {
    "lines": $backend_coverage_lines,
    "statements": $backend_coverage_statements,
    "functions": $backend_coverage_functions,
    "branches": $backend_coverage_branches,
    "qualityGate": "$backend_quality_gate_status",
    "thresholds": {
      "lines": $BACKEND_THRESHOLD_LINES,
      "statements": $BACKEND_THRESHOLD_STATEMENTS,
      "functions": $BACKEND_THRESHOLD_FUNCTIONS,
      "branches": $BACKEND_THRESHOLD_BRANCHES
    }
  },
  "dashboard": {
    "lines": $dashboard_coverage_lines,
    "statements": $dashboard_coverage_statements,
    "functions": $dashboard_coverage_functions,
    "branches": $dashboard_coverage_branches,
    "qualityGate": "$dashboard_quality_gate_status",
    "thresholds": {
      "lines": $DASHBOARD_THRESHOLD_LINES,
      "statements": $DASHBOARD_THRESHOLD_STATEMENTS,
      "functions": $DASHBOARD_THRESHOLD_FUNCTIONS,
      "branches": $DASHBOARD_THRESHOLD_BRANCHES
    }
  }
}
EOF

    log_success "JSON summary generated: $json_file"
}

# Main function
main() {
    log_info "Generating comprehensive coverage report..."
    
    # Check prerequisites
    check_jq
    
    # Ensure bc is available for calculations
    if ! command -v bc &> /dev/null; then
        log_error "bc is required for calculations but not installed"
        exit 1
    fi
    
    mkdir -p "$REPORTS_DIR"
    
    # Initialize coverage variables with defaults
    backend_coverage_lines=0
    backend_coverage_statements=0
    backend_coverage_functions=0
    backend_coverage_branches=0
    dashboard_coverage_lines=0
    dashboard_coverage_statements=0
    dashboard_coverage_functions=0
    dashboard_coverage_branches=0
    
    # Parse coverage data
    log_info "Parsing coverage data..."
    
    if parse_coverage_json "$PROJECT_ROOT/cw_app/coverage/coverage-summary.json" "backend"; then
        log_success "Backend coverage data parsed"
    else
        log_warning "Using default backend coverage values"
    fi
    
    if parse_coverage_json "$PROJECT_ROOT/cw_dashboard/coverage/coverage-summary.json" "dashboard"; then
        log_success "Dashboard coverage data parsed"
    else
        log_warning "Using default dashboard coverage values"
    fi
    
    # Check quality gates
    log_info "Checking quality gates..."
    
    local overall_status=0
    
    if ! check_quality_gates "backend"; then
        overall_status=1
    fi
    
    if ! check_quality_gates "dashboard"; then
        overall_status=1
    fi
    
    # Copy detailed reports if they exist
    if [ -d "$PROJECT_ROOT/cw_app/coverage" ]; then
        cp -r "$PROJECT_ROOT/cw_app/coverage" "$REPORTS_DIR/backend-coverage"
        log_info "Backend coverage reports copied to $REPORTS_DIR/backend-coverage"
    fi
    
    if [ -d "$PROJECT_ROOT/cw_dashboard/coverage" ]; then
        cp -r "$PROJECT_ROOT/cw_dashboard/coverage" "$REPORTS_DIR/dashboard-coverage"
        log_info "Dashboard coverage reports copied to $REPORTS_DIR/dashboard-coverage"
    fi
    
    # Generate reports
    generate_html_report
    substitute_html_values
    generate_coverage_badge
    generate_json_summary
    
    # Final summary
    log_info "Coverage report generation completed!"
    log_info "Reports available at:"
    log_info "  📄 HTML Report: $REPORTS_DIR/coverage-report.html"
    log_info "  📊 JSON Summary: $REPORTS_DIR/coverage-summary.json"
    log_info "  🏷️  Coverage Badge: $REPORTS_DIR/coverage-badge.svg"
    
    if [ $overall_status -eq 0 ]; then
        log_success "🎉 All quality gates PASSED!"
    else
        log_error "❌ Some quality gates FAILED"
        exit 1
    fi
}

# Parse command line arguments
case "${1:-generate}" in
    "generate")
        main
        ;;
    "check-gates")
        check_jq
        parse_coverage_json "$PROJECT_ROOT/cw_app/coverage/coverage-summary.json" "backend"
        parse_coverage_json "$PROJECT_ROOT/cw_dashboard/coverage/coverage-summary.json" "dashboard"
        
        local exit_code=0
        check_quality_gates "backend" || exit_code=1
        check_quality_gates "dashboard" || exit_code=1
        
        exit $exit_code
        ;;
    "badge")
        check_jq
        parse_coverage_json "$PROJECT_ROOT/cw_app/coverage/coverage-summary.json" "backend"
        parse_coverage_json "$PROJECT_ROOT/cw_dashboard/coverage/coverage-summary.json" "dashboard"
        generate_coverage_badge
        ;;
    *)
        echo "Usage: $0 {generate|check-gates|badge}"
        echo ""
        echo "Commands:"
        echo "  generate     - Generate complete coverage report (default)"
        echo "  check-gates  - Check quality gates only"
        echo "  badge        - Generate coverage badge only"
        exit 1
        ;;
esac