export interface Role {
  slug: string;
  name: string;
  githubChallengeUrl: string;
  description: string;
  active: boolean;
}

// Mapa de vagas disponíveis com links do GitHub para os testes técnicos
export const roles: Record<string, Role> = {
  'sdet-jr': {
    slug: 'sdet-jr',
    name: 'SDET Jr',
    githubChallengeUrl: 'https://github.com/voidr-co/sdet-jr-challenge',
    description: 'Software Development Engineer in Test - Júnior',
    active: true,
  },
  'sdet-pleno': {
    slug: 'sdet-pleno',
    name: 'SDET Pleno',
    githubChallengeUrl: 'https://github.com/voidr-co/sdet-pleno-challenge',
    description: 'Software Development Engineer in Test - Pleno',
    active: true,
  },
  'fullstack-jr': {
    slug: 'fullstack-jr',
    name: 'Full Stack Developer Jr',
    githubChallengeUrl: 'https://github.com/voidr-co/fullstack-jr-challenge',
    description: 'Desenvolvedor Full Stack Júnior',
    active: true,
  },
  'fullstack-pleno': {
    slug: 'fullstack-pleno',
    name: 'Full Stack Developer Pleno',
    githubChallengeUrl: 'https://github.com/voidr-co/fullstack-pleno-challenge',
    description: 'Desenvolvedor Full Stack Pleno',
    active: true,
  },
  'frontend-jr': {
    slug: 'frontend-jr',
    name: 'Frontend Developer Jr',
    githubChallengeUrl: 'https://github.com/voidr-co/frontend-jr-challenge',
    description: 'Desenvolvedor Frontend Júnior',
    active: true,
  },
  'backend-jr': {
    slug: 'backend-jr',
    name: 'Backend Developer Jr',
    githubChallengeUrl: 'https://github.com/voidr-co/backend-jr-challenge',
    description: 'Desenvolvedor Backend Júnior',
    active: true,
  },
};

export function getRole(slug: string): Role | undefined {
  return roles[slug];
}

export function getActiveRoles(): Role[] {
  return Object.values(roles).filter((role) => role.active);
}

export function isValidRole(slug: string): boolean {
  const role = roles[slug];
  return role !== undefined && role.active;
}
