const ENGAGEMENT_SESSION_PATH = "/api/v1/engagement/sessions";
const EXPECTED_TARGETS = ["STORY", "EPISODE"];

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export async function collectExpectedEngagementStarts(page, trigger, { timeoutMs = 15_000 } = {}) {
  const values = new Map();
  const targetIds = new Map();
  const requestIdentities = new Set();
  let pendingResponses = 0;
  let responseOrdinal = 0;
  let triggerFinished = false;
  let settled = false;
  let resolveCompletion;
  let rejectCompletion;
  const completion = new Promise((resolve, reject) => {
    resolveCompletion = resolve;
    rejectCompletion = reject;
  });

  const fail = (reason) => {
    if (settled) return;
    settled = true;
    rejectCompletion(reason instanceof Error ? reason : new Error(String(reason)));
  };
  const completeIfReady = () => {
    if (settled || !triggerFinished || pendingResponses !== 0 || values.size !== EXPECTED_TARGETS.length) return;
    settled = true;
    resolveCompletion(Object.fromEntries(values));
  };
  const onResponse = (response) => {
    const request = response.request();
    if (request.method() !== "POST" || new URL(response.url()).pathname !== ENGAGEMENT_SESSION_PATH) return;
    let requestBody;
    try {
      requestBody = request.postDataJSON();
    } catch (reason) {
      fail(new Error(`Anonymous engagement request body was malformed: ${String(reason)}`));
      return;
    }
    const target = requestBody?.targetType;
    if (!EXPECTED_TARGETS.includes(target)) return;
    if (typeof requestBody.clientSessionKey !== "string" || !requestBody.clientSessionKey
      || typeof requestBody.idempotencyKey !== "string" || !requestBody.idempotencyKey
      || typeof requestBody.targetId !== "string" || !requestBody.targetId) {
      fail(new Error(`Anonymous ${target} engagement request did not match the required contract.`));
      return;
    }
    const requestIdentity = `${target}:${requestBody.clientSessionKey}:${requestBody.idempotencyKey}`;
    if (requestIdentities.has(requestIdentity)) {
      fail(new Error(`Duplicate anonymous ${target} engagement request identity was observed.`));
      return;
    }
    requestIdentities.add(requestIdentity);
    const expectedTargetId = targetIds.get(target);
    if (expectedTargetId && expectedTargetId !== requestBody.targetId) {
      fail(new Error(`Anonymous ${target} engagement responses matched different targets.`));
      return;
    }
    targetIds.set(target, requestBody.targetId);
    const ordinal = ++responseOrdinal;
    pendingResponses += 1;
    void (async () => {
      if (response.status() !== 200)
        throw new Error(`Anonymous ${target} engagement response returned HTTP ${response.status()}.`);
      let body;
      try {
        body = await response.json();
      } catch (reason) {
        throw new Error(`Anonymous ${target} engagement response body was malformed: ${String(reason)}`);
      }
      if (!isObject(body) || typeof body.sessionId !== "string" || !body.sessionId || body.targetType !== target) {
        throw new Error(`Anonymous ${target} engagement response did not match the required contract.`);
      }
      const current = values.get(target);
      if (!current || current.ordinal < ordinal)
        values.set(target, { ordinal, value: { ...body, clientSessionKey: requestBody.clientSessionKey } });
    })().then(() => {
      pendingResponses -= 1;
      completeIfReady();
    }).catch(fail);
  };

  page.on("response", onResponse);
  const timeout = setTimeout(() => {
    const missing = EXPECTED_TARGETS.filter((target) => !values.has(target));
    fail(new Error(`Timed out waiting for anonymous engagement responses: ${missing.join(", ") || "body parsing"}.`));
  }, timeoutMs);
  const triggerPromise = Promise.resolve().then(trigger).then(() => {
    triggerFinished = true;
    completeIfReady();
  }).catch(fail);

  try {
    const [, result] = await Promise.all([triggerPromise, completion]);
    return Object.fromEntries(Object.entries(result).map(([target, entry]) => [target, entry.value]));
  } finally {
    clearTimeout(timeout);
    page.off("response", onResponse);
  }
}
