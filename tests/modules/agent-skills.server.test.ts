import { describe, it, expect } from 'vitest';
import {
  SKILL_MD,
  SKILL_NAME,
  SKILL_URL,
  getSkillDigest,
  getSkillsIndex,
} from '~/modules/agent-skills.server';

describe('agent-skills', () => {
  it('SKILL_MD starts with YAML frontmatter containing name and description', () => {
    expect(SKILL_MD.startsWith('---\n')).toBe(true);
    expect(SKILL_MD).toMatch(/^---\nname: healthy-person-emulator\ndescription: .+\n---/);
  });

  it('digest is sha256-prefixed 64-char lowercase hex matching SKILL_MD', async () => {
    const digest = await getSkillDigest();
    expect(digest).toMatch(/^sha256:[0-9a-f]{64}$/);

    const expected = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(SKILL_MD));
    const hex = Array.from(new Uint8Array(expected))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    expect(digest).toBe(`sha256:${hex}`);
  });

  it('skills index conforms to v0.2.0 schema shape', async () => {
    const index = await getSkillsIndex();
    expect(index.$schema).toBe('https://schemas.agentskills.io/discovery/0.2.0/schema.json');
    expect(index.skills).toHaveLength(1);

    const skill = index.skills[0];
    expect(skill.name).toBe(SKILL_NAME);
    expect(skill.type).toBe('skill-md');
    expect(skill.url).toBe(SKILL_URL);
    expect(skill.description.length).toBeLessThanOrEqual(1024);
    expect(skill.digest).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});
