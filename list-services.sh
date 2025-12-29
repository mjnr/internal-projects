#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Project configuration
PROJECT_ID="perceptive-bay-340802"
REGION="us-central1"
URL_MAP_NAME="custom-domains-79e6"
HOST_NAME="internal.voidr.co"
PREFIX="internal"

print_header() {
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}  ${CYAN}Internal Projects Services Status${NC}                        ${BLUE}║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_section() {
    echo -e "${YELLOW}▶ $1${NC}"
    echo ""
}

print_service() {
    local name=$1
    local status=$2
    local url=$3
    
    if [ "$status" == "RUNNING" ]; then
        echo -e "  ${GREEN}●${NC} ${name}"
    else
        echo -e "  ${RED}●${NC} ${name}"
    fi
    echo -e "    Status: ${status}"
    echo -e "    URL: ${url}"
    echo ""
}

print_header

# List all Cloud Run services with internal prefix
print_section "Cloud Run Services"
gcloud run services list \
    --region=${REGION} \
    --project=${PROJECT_ID} \
    --filter="metadata.name:${PREFIX}-*" \
    --format="table(
        metadata.name,
        status.conditions[0].status:label='STATUS',
        status.url
    )" 2>/dev/null || echo -e "  ${RED}No services found${NC}"

echo ""

# Get URL map configuration
print_section "Load Balancer Path Rules (${HOST_NAME})"

TEMP_URLMAP=$(mktemp)
if gcloud compute url-maps describe ${URL_MAP_NAME} \
    --global \
    --project=${PROJECT_ID} \
    --format=json > ${TEMP_URLMAP} 2>/dev/null; then
    
    python3 <<EOF
import json
import sys

try:
    with open('${TEMP_URLMAP}', 'r') as f:
        data = json.load(f)
    
    found_rules = False
    for path_matcher in data.get('pathMatchers', []):
        if 'pathRules' in path_matcher:
            for rule in path_matcher['pathRules']:
                paths = rule.get('paths', [])
                service = rule.get('service', '')
                backend_name = service.split('/')[-1] if service else 'N/A'
                
                # Filter for internal-* services
                if '${PREFIX}-' in backend_name or any('/${PREFIX}-' in path for path in paths):
                    found_rules = True
                    for path in paths:
                        if '/${PREFIX}-' in path or path.startswith('/'):
                            print(f"  \033[0;32m✓\033[0m https://${HOST_NAME}{path}")
                            print(f"    → {backend_name}")
                            print()
    
    if not found_rules:
        print("\033[0;33mNo path rules found for ${PREFIX}-* services\033[0m")
        print("  (URL map may use a different path matcher or no routes configured yet)")
except Exception as e:
    print(f"\033[0;31mError parsing URL map: {e}\033[0m")
    sys.exit(1)
EOF
else
    echo -e "  ${RED}URL Map '${URL_MAP_NAME}' not found or not accessible${NC}"
fi

rm -f ${TEMP_URLMAP}

echo ""

# List backend services
print_section "Backend Services"
gcloud compute backend-services list \
    --global \
    --project=${PROJECT_ID} \
    --filter="name:custom-domain-voidr-${PREFIX}-* OR name:custom-domain-${PREFIX}-*" \
    --format="table(
        name,
        backends[0].group.segment(-1):label='NEG',
        protocol,
        enableCDN
    )" 2>/dev/null || echo -e "  ${YELLOW}No backend services found${NC}"

echo ""

# List network endpoint groups
print_section "Network Endpoint Groups"
gcloud compute network-endpoint-groups list \
    --project=${PROJECT_ID} \
    --region=${REGION} \
    --filter="name:${PREFIX}-*" \
    --format="table(
        name,
        region.segment(-1),
        cloudRun.service:label='CLOUD_RUN_SERVICE',
        size
    )" 2>/dev/null || echo -e "  ${YELLOW}No NEGs found${NC}"

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║${NC}  To provision a new service, run:                         ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  ${CYAN}./provision-new-service.sh <service-name> [port]${NC}        ${GREEN}║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
