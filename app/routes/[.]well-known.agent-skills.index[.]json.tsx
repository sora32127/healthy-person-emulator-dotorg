import { getSkillsIndex } from '~/modules/agent-skills.server';

export async function loader() {
  const index = await getSkillsIndex();
  return new Response(JSON.stringify(index, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
