# Internal Projects - Monorepo

Monorepo para projetos internos rodando na Google Cloud Platform com path-based load balancing.

## Architecture

All services are accessible through a unified domain with path-based routing:

```
https://internal.voidr.co/{service-name}/*
```

### Current Services

_No services yet. Use `./provision-new-service.sh` to add your first service._

## Quick Start

### List All Services

```bash
./list-services.sh
```

Shows all Cloud Run services, backend configurations, and load balancer routes.

### Validate a Service

```bash
./validate-service.sh <service-name>
```

Performs health checks on all components of a service.

### Provision a New Service

```bash
./provision-new-service.sh <service-name> [port] [env-vars]
```

Automatically provisions and configures a new service with load balancer integration.

**Example:**
```bash
./provision-new-service.sh my-service 3005 "NODE_ENV=production,API_KEY=xyz"
```

### Remove a Service

```bash
./remove-service.sh <service-name>
```

Safely removes all GCP resources for a service.

## Project Structure

```
.
├── src/
│   └── {service-name}/      # Service directories
│
├── provision-new-service.sh   # Provision new service
├── list-services.sh          # List all services
├── validate-service.sh       # Validate service health
├── remove-service.sh         # Remove service
├── cloudbuild.yaml           # CI/CD configuration
└── PROVISIONING.md           # Detailed provisioning guide
```

## Service Requirements

Each service must have:

1. **Dockerfile** in `src/{service-name}/Dockerfile`
2. **Health endpoint** (optional but recommended)
3. **Package.json** or equivalent dependency file

## Deployment

### Manual Deployment

```bash
# Build and deploy a specific service
./provision-new-service.sh <service-name>
```

### CI/CD (Cloud Build)

```bash
# Deploy all services
gcloud builds submit --config cloudbuild.yaml
```

The CI/CD pipeline automatically:
- Builds Docker images
- Pushes to Artifact Registry
- Updates Cloud Run services

## Configuration

### Project Variables

- **Project ID:** `perceptive-bay-340802`
- **Region:** `us-central1`
- **Repository:** `voidr-internal`
- **Domain:** `internal.voidr.co`

### Environment Variables

Update service environment variables:

```bash
gcloud run services update internal-{service-name} \
  --region=us-central1 \
  --update-env-vars="KEY1=value1,KEY2=value2"
```

### Secrets

For sensitive data, use Secret Manager:

```bash
# Create secret
gcloud secrets create {service-name}-secret \
  --data-file=-

# Mount in Cloud Run
gcloud run services update internal-{service-name} \
  --region=us-central1 \
  --update-secrets=SECRET_KEY={service-name}-secret:latest
```

## Load Balancer

All services share a global load balancer with path-based routing:

- **URL Map:** `custom-domains-79e6` (or create new one)
- **SSL Certificate:** Google-managed for `internal.voidr.co`
- **CDN:** Enabled by default
- **Path Pattern:** `/{service-name}/*`

The provisioning script automatically:
1. Creates a serverless Network Endpoint Group (NEG)
2. Creates a backend service with CDN
3. Adds path rule to the URL map

## Monitoring

### View Logs

```bash
# Cloud Run logs
gcloud run services logs read internal-{service-name} --region=us-central1

# Follow logs
gcloud run services logs tail internal-{service-name} --region=us-central1
```

### Metrics

View metrics in Cloud Console:
- [Cloud Run Services](https://console.cloud.google.com/run)
- [Load Balancer](https://console.cloud.google.com/net-services/loadbalancing/list)

## Troubleshooting

### 502 Bad Gateway

- Check Cloud Run service is running
- Verify service responds on correct port
- Check service logs for errors

### 404 Not Found

- Verify path rule exists in load balancer
- Check service has the requested route
- Run validation script

### Service Not Accessible

```bash
# Run full validation
./validate-service.sh <service-name>

# Check backend health
gcloud compute backend-services get-health \
  custom-domain-voidr-internal-{service-name} --global
```

## Development

### Local Development

Each service can be run locally:

```bash
cd src/{service-name}
npm install
npm start
```

### Testing

Test service endpoints:

```bash
# Direct Cloud Run URL
curl https://internal-{service-name}-XXXXX.us-central1.run.app/health

# Through load balancer
curl https://internal.voidr.co/{service-name}/health
```

## Documentation

- [PROVISIONING.md](./docs/PROVISIONING.md) - Detailed provisioning guide
- [SCRIPTS.md](./docs/SCRIPTS.md) - Complete scripts reference
- [EXAMPLES.md](./docs/EXAMPLES.md) - Usage examples and patterns

## Support

For issues or questions, check:
1. Service logs in Cloud Console
2. Load balancer monitoring
3. Run validation script for diagnostics

---

**Project:** Voidr Internal Projects  
**Environment:** Production  
**Cloud Platform:** Google Cloud Platform  
**Region:** us-central1

