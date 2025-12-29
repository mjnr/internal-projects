#!/bin/bash

# Safely remove a service and all its GCP resources

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <service-name>"
  echo ""
  echo "This will remove:"
  echo "  - Cloud Run service"
  echo "  - Network Endpoint Group (NEG)"
  echo "  - Backend Service"
  echo "  - Load Balancer route"
  exit 1
fi

SERVICE_NAME="$1"
PROJECT_ID="perceptive-bay-340802"
REGION="us-central1"
PREFIX="internal"
FULL_SERVICE_NAME="${PREFIX}-${SERVICE_NAME}"
NEG_NAME="${PREFIX}-${SERVICE_NAME}-neg"
BACKEND_NAME="custom-domain-voidr-${PREFIX}-${SERVICE_NAME}"
URL_MAP="custom-domains-79e6"

echo "=========================================="
echo "Removing Service: $FULL_SERVICE_NAME"
echo "=========================================="
echo ""
echo "⚠️  WARNING: This will permanently delete:"
echo "   - Cloud Run service: $FULL_SERVICE_NAME"
echo "   - NEG: $NEG_NAME"
echo "   - Backend: $BACKEND_NAME"
echo "   - Load balancer route: /${SERVICE_NAME}/*"
echo ""
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

echo ""
echo "🗑️  Step 1: Removing Load Balancer Route..."
if gcloud compute url-maps describe "$URL_MAP" \
  --project="$PROJECT_ID" \
  --global &>/dev/null; then
  # Remove path matcher
  gcloud compute url-maps remove-path-matcher "$URL_MAP" \
    --project="$PROJECT_ID" \
    --path-matcher-name="${SERVICE_NAME}-matcher" \
    --global \
    2>/dev/null && echo "   ✅ Path rule removed" || echo "   ⚠️  Path rule not found or already removed"
else
  echo "   ⚠️  URL Map '$URL_MAP' not found"
fi
echo ""

echo "🔧 Step 2: Removing Backend from Backend Service..."
if gcloud compute backend-services describe "$BACKEND_NAME" \
  --project="$PROJECT_ID" \
  --global &>/dev/null; then
  # Remove NEG from backend
  gcloud compute backend-services remove-backend "$BACKEND_NAME" \
    --project="$PROJECT_ID" \
    --global \
    --network-endpoint-group="$NEG_NAME" \
    --network-endpoint-group-region="$REGION" \
    2>/dev/null && echo "   ✅ Backend removed" || echo "   ⚠️  Backend not attached"
  
  # Delete backend service
  echo "   Deleting backend service..."
  gcloud compute backend-services delete "$BACKEND_NAME" \
    --project="$PROJECT_ID" \
    --global \
    --quiet \
    2>/dev/null && echo "   ✅ Backend service deleted" || echo "   ⚠️  Backend service not found"
else
  echo "   ⚠️  Backend service not found"
fi
echo ""

echo "🌐 Step 3: Removing Network Endpoint Group..."
if gcloud compute network-endpoint-groups describe "$NEG_NAME" \
  --project="$PROJECT_ID" \
  --region="$REGION" &>/dev/null; then
  gcloud compute network-endpoint-groups delete "$NEG_NAME" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --quiet \
    2>/dev/null && echo "   ✅ NEG deleted" || echo "   ⚠️  Error deleting NEG"
else
  echo "   ⚠️  NEG not found"
fi
echo ""

echo "🚀 Step 4: Removing Cloud Run Service..."
if gcloud run services describe "$FULL_SERVICE_NAME" \
  --project="$PROJECT_ID" \
  --region="$REGION" &>/dev/null; then
  gcloud run services delete "$FULL_SERVICE_NAME" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --quiet \
    2>/dev/null && echo "   ✅ Cloud Run service deleted" || echo "   ⚠️  Error deleting service"
else
  echo "   ⚠️  Cloud Run service not found"
fi
echo ""

echo "=========================================="
echo "✅ Removal Complete!"
echo "=========================================="
echo ""
echo "Note: Docker images in Artifact Registry are not automatically deleted."
echo "To remove images manually:"
echo "  gcloud artifacts docker images delete ${REGION}-docker.pkg.dev/${PROJECT_ID}/voidr-internal/${FULL_SERVICE_NAME} --delete-tags"
echo ""

