import { describe, expect, it } from "vitest";

import type { WorkerEnv } from "./types";

describe("worker placeholders", () => {
  it("keeps the test runner wired for the worker package", () => {
    const env = {} as WorkerEnv;
    expect(env).toBeDefined();
  });
});
