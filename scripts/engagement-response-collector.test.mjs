import { describe, expect, it } from "vitest";
import { collectExpectedEngagementStarts } from "./engagement-response-collector.mjs";

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

class FakePage {
  listeners = new Set();
  on(event, listener) {
    if (event === "response") this.listeners.add(listener);
  }
  off(event, listener) {
    if (event === "response") this.listeners.delete(listener);
  }
  emit(response) {
    for (const listener of [...this.listeners]) listener(response);
  }
}

function response(targetType, { status = 200, body, clientSessionKey, idempotencyKey, targetId } = {}) {
  return {
    request: () => ({
      method: () => "POST",
      postDataJSON: () => ({
        targetType,
        clientSessionKey: clientSessionKey ?? `${targetType.toLowerCase()}-key`,
        idempotencyKey: idempotencyKey ?? `${targetType.toLowerCase()}-idempotency`,
        targetId: targetId ?? `${targetType.toLowerCase()}-target`,
      }),
    }),
    url: () => "http://localhost:5039/api/v1/engagement/sessions",
    status: () => status,
    json: () => body ?? Promise.resolve({ sessionId: `${targetType.toLowerCase()}-session`, targetType }),
  };
}

describe("anonymous engagement response collector", () => {
  it.each([["STORY", "EPISODE"], ["EPISODE", "STORY"]])(
    "accepts response order %s then %s and waits for both body promises",
    async (first, second) => {
      const page = new FakePage();
      const firstBody = deferred();
      const secondBody = deferred();
      let settled = false;
      const collecting = collectExpectedEngagementStarts(page, async () => {
        page.emit(response(first, { body: firstBody.promise }));
        page.emit(response(second, { body: secondBody.promise }));
      }).then((value) => { settled = true; return value; });
      firstBody.resolve({ sessionId: `${first}-session`, targetType: first });
      await Promise.resolve();
      expect(settled).toBe(false);
      secondBody.resolve({ sessionId: `${second}-session`, targetType: second });
      const result = await collecting;
      expect(result.STORY.targetType).toBe("STORY");
      expect(result.EPISODE.targetType).toBe("EPISODE");
      expect(page.listeners.size).toBe(0);
    },
  );

  it("times out when one expected response is missing and removes its listener", async () => {
    const page = new FakePage();
    await expect(collectExpectedEngagementStarts(page, () => {
      page.emit(response("STORY"));
    }, { timeoutMs: 10 })).rejects.toThrow(/EPISODE/);
    expect(page.listeners.size).toBe(0);
  });

  it("accepts distinct Strict Mode replacement lifecycles and selects the latest response", async () => {
    const page = new FakePage();
    const result = await collectExpectedEngagementStarts(page, () => {
      page.emit(response("STORY"));
      page.emit(response("EPISODE", {
        clientSessionKey: "episode-preflight", idempotencyKey: "episode-preflight-request",
        body: Promise.resolve({ sessionId: "episode-preflight-session", targetType: "EPISODE" }),
      }));
      page.emit(response("EPISODE", {
        clientSessionKey: "episode-active", idempotencyKey: "episode-active-request",
        body: Promise.resolve({ sessionId: "episode-active-session", targetType: "EPISODE" }),
      }));
    });
    expect(result.EPISODE).toMatchObject({
      sessionId: "episode-active-session", clientSessionKey: "episode-active",
    });
    expect(page.listeners.size).toBe(0);
  });

  it("fails clearly for malformed JSON, non-200, and duplicate matches", async () => {
    const malformedPage = new FakePage();
    await expect(collectExpectedEngagementStarts(malformedPage, () => {
      malformedPage.emit(response("STORY", { body: Promise.reject(new Error("bad json")) }));
    })).rejects.toThrow(/malformed/);
    expect(malformedPage.listeners.size).toBe(0);

    const failurePage = new FakePage();
    await expect(collectExpectedEngagementStarts(failurePage, () => {
      failurePage.emit(response("EPISODE", { status: 503 }));
    })).rejects.toThrow(/HTTP 503/);
    expect(failurePage.listeners.size).toBe(0);

    const duplicatePage = new FakePage();
    await expect(collectExpectedEngagementStarts(duplicatePage, () => {
      duplicatePage.emit(response("STORY"));
      duplicatePage.emit(response("STORY"));
    })).rejects.toThrow(/Duplicate anonymous STORY engagement request identity/);
    expect(duplicatePage.listeners.size).toBe(0);
  });
});
