# Service Provisioning Guide

This guide explains how to provision a new service in the Internal Projects monorepo.

## Prerequisites

1. **GCP Access**: Ensure you have the necessary permissions:
   - Cloud Run Admin
   - Compute Admin
   - Artifact Registry Writer
   - Service Account User

2. **Service Directory**: Create your service directory:
   ```bash
   mkdir -p src/my-service
   ```

3. **Required Files**: Each service must have:
   - `Dockerfile` - Container image definition
   - `package.json` (or equivalent) - Dependencies
   - Application code

## Quick Provision

```bash
./provision-new-service.sh my-service 8080 "NODE_ENV=production"
```

## Manual Steps

### 1. Build and Push Docker Image

```bash
SERVICE_NAME="my-service"
REGION="us-central1"
PROJECT_ID="perceptive-bay-340802"
REPOSITORY="voidr-internal"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/internal-${SERVICE_NAME}"

docker build -t ${IMAGE}:latest ./src/${SERVICE_NAME}
docker push ${IMAGE}:latest
```

### 2. Deploy to Cloud Run

```bash
gcloud run deploy internal-${SERVICE_NAME} \
  --image=${IMAGE}:latest \
  --region=${REGION} \
  --platform=managed \
  --port=8080 \
  --allow-unauthenticated \
  --project=${PROJECT_ID}
```

### 3. Create Network Endpoint Group (NEG)

```bash
gcloud compute network-endpoint-groups create internal-${SERVICE_NAME}-neg \
  --region=${REGION} \
  --network-endpoint-type=serverless \
  --cloud-run-service=internal-${SERVICE_NAME} \
  --project=${PROJECT_ID}
```

### 4. Create Backend Service

```bash
gcloud compute backend-services create custom-domain-voidr-internal-${SERVICE_NAME} \
  --global \
  --enable-cdn \
  --load-balancing-scheme=EXTERNAL_MANAGED \
  --project=${PROJECT_ID}

gcloud compute backend-services add-backend custom-domain-voidr-internal-${SERVICE_NAME} \
  --global \
  --network-endpoint-group=internal-${SERVICE_NAME}-neg \
  --network-endpoint-group-region=${REGION} \
  --project=${PROJECT_ID}
```

### 5. Add Load Balancer Route

```bash
gcloud compute url-maps add-path-matcher custom-domains-79e6 \
  --default-backend-service=custom-domain-voidr-internal-${SERVICE_NAME} \
  --path-matcher-name=${SERVICE_NAME}-matcher \
  --path-rules="/${SERVICE_NAME}/*=custom-domain-voidr-internal-${SERVICE_NAME}" \
  --global \
  --project=${PROJECT_ID}
```

## Service Configuration

### Port Configuration

Default port is `8080`. Cloud Run will automatically set `PORT` environment variable.

### Environment Variables

Set during provisioning:
```bash
./provision-new-service.sh my-service 8080 "KEY1=value1,KEY2=value2"
```

Or update later:
```bash
gcloud run services update internal-my-service \
  --region=us-central1 \
  --update-env-vars="KEY1=value1,KEY2=value2"
```

### Secrets

Use Secret Manager for sensitive data:

```bash
# Create secret
echo -n "secret-value" | gcloud secrets create my-service-secret \
  --data-file=- \
  --project=perceptive-bay-340802

# Mount in Cloud Run
gcloud run services update internal-my-service \
  --region=us-central1 \
  --update-secrets=SECRET_KEY=my-service-secret:latest
```

### Resource Limits

Update Cloud Run service resources:

```bash
gcloud run services update internal-my-service \
  --region=us-central1 \
  --cpu=2 \
  --memory=2Gi \
  --timeout=300 \
  --min-instances=1 \
  --max-instances=10
```

## Health Checks

Implement a health endpoint in your service:

```javascript
// Example Express.js
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});
```

The health endpoint should:
- Return 200 status code
- Respond quickly (< 1 second)
- Check critical dependencies

## CI/CD Integration

Add your service to `cloudbuild.yaml`:

```yaml
# Build step
- name: 'gcr.io/cloud-builders/docker'
  args:
    - 'build'
    - '-t'
    - '${_REGION}-docker.pkg.dev/${_PROJECT_ID}/${_REPOSITORY}/internal-my-service:$BUILD_ID'
    - '-t'
    - '${_REGION}-docker.pkg.dev/${_PROJECT_ID}/${_REPOSITORY}/internal-my-service:latest'
    - './src/my-service'
  id: 'build-my-service'

# Push step
- name: 'gcr.io/cloud-builders/docker'
  args:
    - 'push'
    - '--all-tags'
    - '${_REGION}-docker.pkg.dev/${_PROJECT_ID}/${_REPOSITORY}/internal-my-service'
  id: 'push-my-service'
  waitFor: ['build-my-service']

# Deploy step
- name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
  entrypoint: gcloud
  args:
    - 'run'
    - 'services'
    - 'update'
    - 'internal-my-service'
    - '--image=${_REGION}-docker.pkg.dev/${_PROJECT_ID}/${_REPOSITORY}/internal-my-service:$BUILD_ID'
    - '--region=${_REGION}'
    - '--platform=managed'
  id: 'deploy-my-service'
  waitFor: ['push-my-service']
```

## Troubleshooting

### Service Not Accessible

1. Check Cloud Run service status:
   ```bash
   gcloud run services describe internal-my-service --region=us-central1
   ```

2. Verify NEG is attached:
   ```bash
   gcloud compute backend-services describe custom-domain-voidr-internal-my-service --global
   ```

3. Check load balancer route:
   ```bash
   gcloud compute url-maps describe custom-domains-79e6 --global
   ```

### 502 Bad Gateway

- Verify service responds on correct port
- Check service logs: `gcloud run services logs tail internal-my-service --region=us-central1`
- Ensure NEG has endpoints: `gcloud compute network-endpoint-groups describe internal-my-service-neg --region=us-central1`

### Image Build Fails

- Check Dockerfile syntax
- Verify all dependencies are available
- Test build locally: `docker build -t test ./src/my-service`

## Best Practices

1. **Use semantic versioning** for Docker images
2. **Implement health checks** for all services
3. **Set appropriate timeouts** based on service needs
4. **Use Secret Manager** for sensitive data
5. **Monitor service metrics** in Cloud Console
6. **Test locally** before deploying
7. **Use environment-specific configs** (dev/staging/prod)

