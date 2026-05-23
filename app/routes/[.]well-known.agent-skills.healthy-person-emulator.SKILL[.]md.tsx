import { SKILL_MD } from '~/modules/agent-skills.server';

export function loader() {
  return new Response(SKILL_MD, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
