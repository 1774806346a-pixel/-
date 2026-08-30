import { describe, expect, it } from 'vitest';
import { loadModelProfiles, getActiveModelProfileId, setActiveModelProfileId } from '../../src/application/model/model-profile';

describe('model profiles', () => {
  it('provides a local Ollama profile when storage is empty', () => {
    const profiles = loadModelProfiles();
    expect(profiles).toHaveLength(1);
    expect(profiles[0]).toMatchObject({ id: 'ollama-local', provider: 'ollama', baseUrl: 'http://127.0.0.1:11434' });
  });

  it('keeps the active profile selection isolated from profile secrets', () => {
    setActiveModelProfileId('custom-profile');
    expect(getActiveModelProfileId()).toBe('ollama-local');
  });
});
