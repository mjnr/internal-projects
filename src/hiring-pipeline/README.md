# Hiring Pipeline

Serviço de pipeline de contratação da Voidr. Processa candidaturas, faz scraping do LinkedIn via Apify, avalia candidatos com AI baseado nos critérios da Voidr, e notifica via email e Roam.

## Arquitetura

```
Site Voidr → POST /apply → Salva candidatura → Inicia scraping Apify
                                                      ↓
                                            Webhook /webhook/apify
                                                      ↓
                                            Avalia com Claude AI
                                                      ↓
                              ┌─────────────────────────────────────┐
                              │                                     │
                    Score >= 10                           Score < 10
                              │                                     │
                    Qualificado                           Rejeitado
                              │                                     │
                    ├─ Email com teste técnico            ├─ Notifica no Roam
                    └─ Notifica no Roam
```

## Endpoints

### Produção (via Load Balancer)

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/hiring-pipeline/apply` | Receber nova candidatura |
| GET | `/hiring-pipeline/apply/roles` | Listar vagas disponíveis |
| GET | `/hiring-pipeline/apply/:id` | Consultar status de candidatura |
| POST | `/hiring-pipeline/webhook/apify` | Callback do Apify após scraping |
| GET | `/hiring-pipeline/health` | Health check |

### Desenvolvimento Local

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/apply` | Receber nova candidatura |
| GET | `/apply/roles` | Listar vagas disponíveis |
| GET | `/apply/:id` | Consultar status de candidatura |
| POST | `/webhook/apify` | Callback do Apify após scraping |
| GET | `/health` | Health check |

## Payload de Candidatura

```json
{
  "name": "João Silva",
  "email": "joao@email.com",
  "phone": "11999999999",
  "linkedinUrl": "https://linkedin.com/in/joaosilva",
  "role": "sdet-jr"
}
```

## Vagas Disponíveis

- `sdet-jr` - SDET Jr
- `sdet-pleno` - SDET Pleno
- `fullstack-jr` - Full Stack Developer Jr
- `fullstack-pleno` - Full Stack Developer Pleno
- `frontend-jr` - Frontend Developer Jr
- `backend-jr` - Backend Developer Jr

## Variáveis de Ambiente

| Variável | Descrição | Obrigatório |
|----------|-----------|-------------|
| `MONGODB_URI` | Connection string do MongoDB | Sim |
| `APIFY_TOKEN` | Token da API do Apify | Sim |
| `ANTHROPIC_API_KEY` | API Key do Claude | Sim |
| `RESEND_API_KEY` | API Key do Resend | Sim |
| `RESEND_TEMPLATE_ID` | ID do template de email | Não (default: job-candidates-technical-challenge) |
| `RESEND_FROM_EMAIL` | Email remetente | Não (default: hiring@voidr.co) |
| `ROAM_API_KEY` | API Key do Roam | Sim |
| `ROAM_CONVERSION_CHAT_ID` | ID do chat para notificações | Sim |
| `WEBHOOK_BASE_URL` | URL base para webhooks (ex: https://internal.voidr.co/hiring-pipeline) | Sim |
| `SCORE_THRESHOLD` | Score mínimo para aprovação | Não (default: 10) |
| `PORT` | Porta do servidor | Não (default: 8080) |

## Desenvolvimento Local

```bash
# Instalar dependências
npm install

# Rodar em modo desenvolvimento
npm run dev

# Build
npm run build

# Rodar em produção
npm start
```

## Docker

```bash
# Build
docker-compose build

# Rodar
docker-compose up -d

# Logs
docker-compose logs -f
```

## Deploy

```bash
# Provisionar no Cloud Run
./provision-new-service.sh hiring-pipeline 8080

# Após provisionar, configurar variáveis de ambiente:
gcloud run services update gtm-hiring-pipeline \
  --region=us-central1 \
  --update-env-vars="MONGODB_URI=mongodb+srv://...,APIFY_TOKEN=apify_api_xxx,ANTHROPIC_API_KEY=sk-ant-xxx,RESEND_API_KEY=re_xxx,ROAM_API_KEY=rmk-xxx,ROAM_CONVERSION_CHAT_ID=xxx,WEBHOOK_BASE_URL=https://internal.voidr.co/hiring-pipeline"
```

### URLs após deploy

- **Health check**: `https://internal.voidr.co/hiring-pipeline/health`
- **Candidatura**: `POST https://internal.voidr.co/hiring-pipeline/apply`
- **Listar vagas**: `GET https://internal.voidr.co/hiring-pipeline/apply/roles`

## Scorecard de Avaliação

O candidato é avaliado com base nos seguintes critérios:

### Formação (máx 6 pontos)
- Universidade Federal: +3
- Inatel/ITA/Unicamp: +3
- ETEC/Instituto Federal: +3
- Programa social de tech: +2

### Localização (máx 4 pontos)
- Hub tech do interior: +4
- Goiânia/Interior GO: +3
- Recife/Floripa/BH: +2
- Capitais menores: +1

### Experiência (máx 7 pontos)
- Stack Angular+Node+TypeScript: +2
- Experiência remota: +2
- Startup/empresa pequena: +2
- 2-4 anos experiência: +1

### Proatividade (máx 7 pontos)
- Empresa Júnior: +3
- Iniciação Científica: +2
- Projetos pessoais: +1
- Open source: +1

**Score >= 10 = Qualificado**
