#!/bin/bash

# Validate a service's health and configuration

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <service-name>"
  exit 1
fi

SERVICE_NAME="$1"
PROJECT_ID="perceptive-bay-340802"
REGION="us-central1"
PREFIX="internal"
FULL_SERVICE_NAME="${PREFIX}-${SERVICE_NAME}"
DOMAIN="internal.voidr.co"

echo "=========================================="
echo "Validating Service: $FULL_SERVICE_NAME"
echo "=========================================="
echo ""

# Check Cloud Run Service exists
echo "1️⃣  Checking Cloud Run Service..."
if gcloud run services describe "$FULL_SERVICE_NAME" \
  --project="$PROJECT_ID" \
  --region="$REGION" &>/dev/null; then
  echo "   ✅ Cloud Run service exists"
  
  # Get service URL
  SERVICE_URL=$(gcloud run services describe "$FULL_SERVICE_NAME" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --format="value(status.url)")
  echo "   📍 Service URL: $SERVICE_URL"
  
  # Check service health
  echo "   🔍 Checking health endpoint..."
  if curl -sf "${SERVICE_URL}/health" > /dev/null 2>&1; then
    echo "   ✅ Health endpoint responds"
  else
    echo "   ⚠️  Health endpoint not responding (may not exist)"
  fi
else
  echo "   ❌ Cloud Run service does not exist"
  exit 1
fi
echo ""

# Check Network Endpoint Group
echo "2️⃣  Checking Network Endpoint Group..."
NEG_NAME="${PREFIX}-${SERVICE_NAME}-neg"
if gcloud compute network-endpoint-groups describe "$NEG_NAME" \
  --project="$PROJECT_ID" \
  --region="$REGION" &>/dev/null; then
  echo "   ✅ NEG exists: $NEG_NAME"
  
  # Get NEG size
  NEG_SIZE=$(gcloud compute network-endpoint-groups describe "$NEG_NAME" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --format="value(size)" 2>/dev/null || echo "0")
  echo "   📊 NEG size: $NEG_SIZE endpoints"
else
  echo "   ⚠️  NEG does not exist: $NEG_NAME"
fi
echo ""

# Check Backend Service
echo "3️⃣  Checking Backend Service..."
BACKEND_NAME="custom-domain-voidr-${PREFIX}-${SERVICE_NAME}"
if gcloud compute backend-services describe "$BACKEND_NAME" \
  --project="$PROJECT_ID" \
  --global &>/dev/null; then
  echo "   ✅ Backend service exists: $BACKEND_NAME"
  
  # Check backend health
  echo "   🔍 Checking backend health..."
  gcloud compute backend-services get-health "$BACKEND_NAME" \
    --project="$PROJECT_ID" \
    --global \
    --format="table(backend.group,status.healthStatus[].healthState)" \
    2>/dev/null || echo "   ⚠️  Could not get health status"
else
  echo "   ⚠️  Backend service does not exist: $BACKEND_NAME"
fi
echo ""

# Check Load Balancer Route
echo "4️⃣  Checking Load Balancer Route..."
URL_MAP="custom-domains-79e6"
if gcloud compute url-maps describe "$URL_MAP" \
  --project="$PROJECT_ID" \
  --global &>/dev/null; then
  PATH_RULE=$(gcloud compute url-maps describe "$URL_MAP" \
    --project="$PROJECT_ID" \
    --global \
    --format="yaml(pathMatchers[].pathRules[])" 2>/dev/null | grep -A 2 "/${SERVICE_NAME}/" || echo "")
  
  if [ -n "$PATH_RULE" ]; then
    echo "   ✅ Path rule exists for /${SERVICE_NAME}/*"
    echo "$PATH_RULE" | sed 's/^/      /'
  else
    echo "   ⚠️  Path rule not found for /${SERVICE_NAME}/*"
  fi
else
  echo "   ⚠️  URL Map '$URL_MAP' not found"
fi
echo ""

# Test Load Balancer URL
echo "5️⃣  Testing Load Balancer URL..."
LB_URL="https://${DOMAIN}/${SERVICE_NAME}/health"
echo "   🔗 Testing: $LB_URL"
if curl -sf "$LB_URL" > /dev/null 2>&1; then
  echo "   ✅ Load balancer route is working"
else
  echo "   ⚠️  Load balancer route not responding (may need time to propagate)"
fi
echo ""

echo "=========================================="
echo "Validation Complete!"
echo "=========================================="
