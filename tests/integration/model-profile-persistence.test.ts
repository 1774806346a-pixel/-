import { describe, expect, it } from "vitest";
import { loadModelProfiles, saveModelProfile } from "../../src/application/model/model-profile";
import { getSecret, secretStorageMode, setSecret } from "../../src/infrastructure/secret-store";

describe("secure model profile storage", () => {
  it("does not persist API keys in localStorage and redacts access through a memory fallback", async () => {
    const profile = await saveModelProfile({ name: "Test API", provider: "openai-compatible", baseUrl: "https://example.test/v1", modelName: "mock", apiKey: "secret-value" });
    expect(secretStorageMode).toBe("memory-fallback");
    expect(await getSecret(`model-profile:${profile.id}:api-key`)).toBe("secret-value");
    expect(JSON.stringify(loadModelProfiles())).not.toContain("secret-value");
  });
});

