#!/bin/bash

# Provision a new service with Cloud Run and Load Balancer integration

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <service-name> [port] [env-vars]"
  echo ""
  echo "Example:"
  echo "  $0 my-service 3005 \"NODE_ENV=production,API_KEY=xyz\""
  exit 1
fi

SERVICE_NAME="$1"
PORT="${2:-8080}"
ENV_VARS="${3:-}"
PROJECT_ID="perceptive-bay-340802"
REGION="us-central1"
REPOSITORY="voidr-internal"
PREFIX="internal"
FULL_SERVICE_NAME="${PREFIX}-${SERVICE_NAME}"
IMAGE_NAME="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/${FULL_SERVICE_NAME}"
SERVICE_DIR="src/${SERVICE_NAME}"
URL_MAP="custom-domains-79e6"

echo "=========================================="
echo "Provisioning Service: $FULL_SERVICE_NAME"
echo "=========================================="
echo ""

# Validate service directory exists
if [ ! -d "$SERVICE_DIR" ]; then
  echo "❌ Error: Service directory not found: $SERVICE_DIR"
  echo ""
  echo "Please create the service directory with:"
  echo "  mkdir -p $SERVICE_DIR"
  echo "  # Add Dockerfile, package.json, etc."
  exit 1
fi

# Check for Dockerfile
if [ ! -f "$SERVICE_DIR/Dockerfile" ]; then
  echo "❌ Error: Dockerfile not found in $SERVICE_DIR"
  exit 1
fi

echo "📦 Step 1: Building Docker image..."
docker build -t "${IMAGE_NAME}:latest" "$SERVICE_DIR"
echo "   ✅ Image built"
echo ""

echo "📤 Step 2: Pushing to Artifact Registry..."
docker push "${IMAGE_NAME}:latest"
echo "   ✅ Image pushed"
echo ""

echo "🚀 Step 3: Deploying to Cloud Run..."
DEPLOY_ARGS=(
  "run" "services" "update" "$FULL_SERVICE_NAME"
  "--image=${IMAGE_NAME}:latest"
  "--region=${REGION}"
  "--platform=managed"
  "--port=${PORT}"
  "--allow-unauthenticated"
  "--project=${PROJECT_ID}"
)

# Add environment variables if provided
if [ -n "$ENV_VARS" ]; then
  DEPLOY_ARGS+=("--update-env-vars=${ENV_VARS}")
fi

# Check if service exists
if gcloud run services describe "$FULL_SERVICE_NAME" \
  --project="$PROJECT_ID" \
  --region="$REGION" &>/dev/null; then
  echo "   Service exists, updating..."
else
  echo "   Service does not exist, creating..."
  DEPLOY_ARGS[2]="deploy"
fi

gcloud "${DEPLOY_ARGS[@]}"
echo "   ✅ Cloud Run service deployed"
echo ""

# Get Cloud Run service URL
SERVICE_URL=$(gcloud run services describe "$FULL_SERVICE_NAME" \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --format="value(status.url)")

echo "🌐 Step 4: Creating Network Endpoint Group..."
NEG_NAME="${PREFIX}-${SERVICE_NAME}-neg"

if gcloud compute network-endpoint-groups describe "$NEG_NAME" \
  --project="$PROJECT_ID" \
  --region="$REGION" &>/dev/null; then
  echo "   NEG exists, skipping creation"
else
  gcloud compute network-endpoint-groups create "$NEG_NAME" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --network-endpoint-type=serverless \
    --cloud-run-service="$FULL_SERVICE_NAME"
  echo "   ✅ NEG created"
fi
echo ""

echo "🔧 Step 5: Creating Backend Service..."
BACKEND_NAME="custom-domain-voidr-${PREFIX}-${SERVICE_NAME}"

if gcloud compute backend-services describe "$BACKEND_NAME" \
  --project="$PROJECT_ID" \
  --global &>/dev/null; then
  echo "   Backend service exists, updating..."
  gcloud compute backend-services update "$BACKEND_NAME" \
    --project="$PROJECT_ID" \
    --global \
    --enable-cdn
else
  gcloud compute backend-services create "$BACKEND_NAME" \
    --project="$PROJECT_ID" \
    --global \
    --enable-cdn \
    --load-balancing-scheme=EXTERNAL_MANAGED
  echo "   ✅ Backend service created"
fi

# Attach NEG to backend
gcloud compute backend-services add-backend "$BACKEND_NAME" \
  --project="$PROJECT_ID" \
  --global \
  --network-endpoint-group="$NEG_NAME" \
  --network-endpoint-group-region="$REGION" \
  2>/dev/null || echo "   Backend already attached"
echo ""

echo "🛣️  Step 6: Adding Load Balancer Route..."
if gcloud compute url-maps describe "$URL_MAP" \
  --project="$PROJECT_ID" \
  --global &>/dev/null; then
  # Check if path rule already exists
  if gcloud compute url-maps describe "$URL_MAP" \
    --project="$PROJECT_ID" \
    --global \
    --format="yaml(pathMatchers[].pathRules[])" | grep -q "/${SERVICE_NAME}/"; then
    echo "   Path rule already exists, updating..."
    gcloud compute url-maps add-path-matcher "$URL_MAP" \
      --project="$PROJECT_ID" \
      --default-backend-service="$BACKEND_NAME" \
      --path-matcher-name="${SERVICE_NAME}-matcher" \
      --path-rules="/${SERVICE_NAME}/*=${BACKEND_NAME}" \
      --global \
      2>/dev/null || echo "   Path rule update skipped (may already exist)"
  else
    echo "   Adding new path rule..."
    gcloud compute url-maps add-path-matcher "$URL_MAP" \
      --project="$PROJECT_ID" \
      --default-backend-service="$BACKEND_NAME" \
      --path-matcher-name="${SERVICE_NAME}-matcher" \
      --path-rules="/${SERVICE_NAME}/*=${BACKEND_NAME}" \
      --global
  fi
  echo "   ✅ Load balancer route configured"
else
  echo "   ⚠️  URL Map '$URL_MAP' not found. Please create it manually or use existing URL map."
fi
echo ""

echo "=========================================="
echo "✅ Provisioning Complete!"
echo "=========================================="
echo ""
echo "Service Details:"
echo "  Name: $FULL_SERVICE_NAME"
echo "  Cloud Run URL: $SERVICE_URL"
echo "  Load Balancer URL: https://internal.voidr.co/${SERVICE_NAME}/*"
echo ""
echo "Next Steps:"
echo "  1. Validate: ./validate-service.sh $SERVICE_NAME"
echo "  2. View logs: gcloud run services logs tail $FULL_SERVICE_NAME --region=$REGION"
echo "  3. Update cloudbuild.yaml to include this service in CI/CD"
echo ""

