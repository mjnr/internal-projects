# Usage Examples

This document provides practical examples for common tasks.

## Creating a New Service

### Node.js/Express Service

1. Create service directory:
```bash
mkdir -p src/my-api
cd src/my-api
```

2. Create `package.json`:
```json
{
  "name": "my-api",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.0"
  }
}
```

3. Create `server.js`:
```javascript
const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/my-api/hello', (req, res) => {
  res.json({ message: 'Hello from my-api!' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

4. Create `Dockerfile`:
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 8080

CMD ["node", "server.js"]
```

5. Provision service:
```bash
cd ../..
./provision-new-service.sh my-api 8080 "NODE_ENV=production"
```

### Python/Flask Service

1. Create service directory:
```bash
mkdir -p src/my-python-service
cd src/my-python-service
```

2. Create `requirements.txt`:
```
Flask==2.3.0
gunicorn==21.2.0
```

3. Create `app.py`:
```python
from flask import Flask, jsonify
import os

app = Flask(__name__)
port = int(os.environ.get('PORT', 8080))

@app.route('/health')
def health():
    return jsonify({'status': 'ok'})

@app.route('/my-python-service/hello')
def hello():
    return jsonify({'message': 'Hello from Python!'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=port)
```

4. Create `Dockerfile`:
```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8080

CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "2", "app:app"]
```

5. Provision service:
```bash
cd ../..
./provision-new-service.sh my-python-service 8080 "FLASK_ENV=production"
```

## Cloud Run Job Example

For batch jobs or scheduled tasks:

1. Create `Dockerfile.job`:
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

CMD ["node", "job.js"]
```

2. Create Cloud Run Job:
```bash
gcloud run jobs create internal-my-job \
  --image=us-central1-docker.pkg.dev/perceptive-bay-340802/voidr-internal/internal-my-service:latest \
  --region=us-central1 \
  --cpu=1 \
  --memory=512Mi \
  --max-retries=3 \
  --task-timeout=600 \
  --command="node" \
  --args="job.js"
```

3. Execute job:
```bash
gcloud run jobs execute internal-my-job --region=us-central1
```

## Using Secrets

### Create Secret

```bash
echo -n "my-secret-value" | gcloud secrets create my-service-api-key \
  --data-file=- \
  --project=perceptive-bay-340802
```

### Mount Secret in Service

```bash
gcloud run services update internal-my-service \
  --region=us-central1 \
  --update-secrets=API_KEY=my-service-api-key:latest
```

### Access Secret in Code

```javascript
// Node.js
const apiKey = process.env.API_KEY;
```

## Environment-Specific Configuration

### Development

```bash
./provision-new-service.sh my-service 8080 \
  "NODE_ENV=development,LOG_LEVEL=debug,API_URL=http://localhost:3000"
```

### Production

```bash
./provision-new-service.sh my-service 8080 \
  "NODE_ENV=production,LOG_LEVEL=info,API_URL=https://api.example.com"
```

## Monitoring and Logging

### View Recent Logs

```bash
gcloud run services logs read internal-my-service \
  --region=us-central1 \
  --limit=50
```

### Follow Logs

```bash
gcloud run services logs tail internal-my-service \
  --region=us-central1
```

### Filter Logs

```bash
gcloud run services logs read internal-my-service \
  --region=us-central1 \
  --filter="severity>=ERROR"
```

## Updating a Service

### Update Environment Variables

```bash
gcloud run services update internal-my-service \
  --region=us-central1 \
  --update-env-vars="NEW_VAR=value,EXISTING_VAR=new_value"
```

### Update Image

```bash
# Build new image
docker build -t us-central1-docker.pkg.dev/perceptive-bay-340802/voidr-internal/internal-my-service:v2 ./src/my-service
docker push us-central1-docker.pkg.dev/perceptive-bay-340802/voidr-internal/internal-my-service:v2

# Deploy
gcloud run services update internal-my-service \
  --region=us-central1 \
  --image=us-central1-docker.pkg.dev/perceptive-bay-340802/voidr-internal/internal-my-service:v2
```

### Scale Service

```bash
gcloud run services update internal-my-service \
  --region=us-central1 \
  --min-instances=2 \
  --max-instances=10 \
  --cpu=2 \
  --memory=2Gi
```

## Testing

### Test Direct Cloud Run URL

```bash
curl https://internal-my-service-xxxxx.us-central1.run.app/health
```

### Test Load Balancer URL

```bash
curl https://internal.voidr.co/my-service/health
```

### Test with Authentication

```bash
# Get identity token
TOKEN=$(gcloud auth print-identity-token)

# Make authenticated request
curl -H "Authorization: Bearer $TOKEN" \
  https://internal-my-service-xxxxx.us-central1.run.app/my-service/data
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy Service

on:
  push:
    branches: [main]
    paths:
      - 'src/my-service/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - id: auth
        uses: google-github-actions/auth@v1
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}
      
      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v1
      
      - name: Build and Deploy
        run: |
          ./provision-new-service.sh my-service 8080 "NODE_ENV=production"
```

## Troubleshooting Examples

### Service Not Responding

```bash
# Check service status
gcloud run services describe internal-my-service --region=us-central1

# Check logs
gcloud run services logs tail internal-my-service --region=us-central1

# Test health endpoint
curl https://internal.voidr.co/my-service/health
```

### Backend Health Check

```bash
gcloud compute backend-services get-health \
  custom-domain-voidr-internal-my-service \
  --global
```

### Validate All Components

```bash
./validate-service.sh my-service
```

