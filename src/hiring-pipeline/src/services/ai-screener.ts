import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env.js';
import type { LinkedInProfile, Evaluation } from '../models/application.js';

const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
});

const SCREENING_PROMPT = `Você é um recrutador técnico da Voidr, uma startup de automação de testes com IA para sistemas críticos.

Analise o perfil do candidato abaixo e avalie com base nos seguintes critérios do scorecard da Voidr:

## SCORECARD DE AVALIAÇÃO

### Formação (máx 6 pontos)
| Critério | Pontos |
|----------|--------|
| Universidade Federal (UFG, UFPE, UFCG, UFSC, UFSCar, UFMG, etc.) | +3 |
| Inatel / ITA / Unicamp | +3 |
| ETEC / Instituto Federal (IFSP, IFPE, IFPB, etc.) | +3 |
| Passou por programa social de tech (PROA, ONE, Generation, etc.) | +2 |

### Localização (máx 4 pontos)
| Critério | Pontos |
|----------|--------|
| Hub tech consolidado do interior (Santa Rita do Sapucaí, São Carlos, Campina Grande) | +4 |
| Goiânia / Interior de GO | +3 |
| Recife / Florianópolis / BH | +2 |
| Capitais menores com ecossistema (Salvador, Curitiba, Porto Alegre, Fortaleza, Natal) | +1 |

### Experiência (máx 7 pontos)
| Critério | Pontos |
|----------|--------|
| Stack Angular + Node.js + TypeScript | +2 |
| Experiência remota comprovada | +2 |
| Veio de startup / empresa pequena (<200 funcionários) | +2 |
| 2-4 anos de experiência | +1 |

### Proatividade (máx 7 pontos)
| Critério | Pontos |
|----------|--------|
| Empresa Júnior (qualquer cargo) | +3 |
| Iniciação Científica | +2 |
| Projetos pessoais documentados | +1 |
| Contribuição open source | +1 |

## CLASSIFICAÇÃO
| Score | Classificação |
|-------|---------------|
| 15+ pontos | Candidato ideal |
| 10-14 pontos | Forte potencial |
| 6-9 pontos | Pode evoluir |
| < 6 pontos | Fora do perfil |

## STACK DESEJADA
- JavaScript/TypeScript
- Angular
- Node.js
- Firebase
- Playwright
- Test Automation / QA
- MongoDB

## INSTRUÇÕES
1. Analise cada critério e some os pontos
2. Seja justo mas criterioso
3. Se não conseguir determinar um critério, não dê os pontos
4. Considere sinônimos e contexto (ex: "UFSC" = Universidade Federal de Santa Catarina)
5. "Remoto" ou "Home Office" em experiências conta como experiência remota

Retorne APENAS um JSON válido no seguinte formato (sem markdown, sem código):
{
  "score": <número total de pontos>,
  "qualified": <true se score >= 10, false caso contrário>,
  "bullets": [
    "<ponto positivo ou negativo 1>",
    "<ponto positivo ou negativo 2>",
    "<ponto positivo ou negativo 3>",
    "<ponto positivo ou negativo 4>",
    "<ponto positivo ou negativo 5>"
  ],
  "reasoning": "<justificativa detalhada da pontuação, mencionando cada critério avaliado>"
}`;

interface AIEvaluationResult {
  score: number;
  qualified: boolean;
  bullets: string[];
  reasoning: string;
}

export async function evaluateCandidate(
  profile: LinkedInProfile,
  candidateName: string
): Promise<Evaluation> {
  const profileMarkdown = profile.rawMarkdown;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: `${SCREENING_PROMPT}

---

## PERFIL DO CANDIDATO: ${candidateName}

${profileMarkdown}`,
      },
    ],
  });

  // Extrair o texto da resposta
  const responseText =
    message.content[0].type === 'text' ? message.content[0].text : '';

  // Parse do JSON
  let result: AIEvaluationResult;
  try {
    // Tentar extrair JSON do texto (pode vir com markdown code blocks)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    result = JSON.parse(jsonMatch[0]);
  } catch (parseError) {
    console.error('Failed to parse AI response:', responseText);
    throw new Error(`Failed to parse AI evaluation: ${parseError}`);
  }

  // Validar resultado
  if (typeof result.score !== 'number' || !Array.isArray(result.bullets)) {
    throw new Error('Invalid AI evaluation format');
  }

  // Garantir exatamente 5 bullets
  while (result.bullets.length < 5) {
    result.bullets.push('Informação não disponível');
  }
  result.bullets = result.bullets.slice(0, 5);

  // Recalcular qualified baseado no threshold configurado
  const qualified = result.score >= env.SCORE_THRESHOLD;

  return {
    score: result.score,
    qualified,
    bullets: result.bullets,
    reasoning: result.reasoning || '',
    evaluatedAt: new Date(),
  };
}
