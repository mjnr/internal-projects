# Example Service

This is an example service directory structure. Copy this directory and modify it for your service.

## Structure

```
example-service/
├── Dockerfile          # Container image definition
├── docker-compose.yml  # Local development setup
├── package.json        # Dependencies (Node.js example)
├── server.js           # Application entry point
└── README.md           # Service documentation
```

## Local Development

```bash
# Using Docker Compose
docker-compose up

# Or using Node.js directly
npm install
npm start
```

## Deployment

```bash
# From project root
./provision-new-service.sh example-service 8080 "NODE_ENV=production"
```

## Notes

- Replace `example-service` with your actual service name
- Update Dockerfile for your runtime (Node.js, Python, Go, etc.)
- Implement a `/health` endpoint for health checks
- Ensure your service listens on the PORT environment variable

