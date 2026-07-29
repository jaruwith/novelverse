"use client";

import { endEngagementSession, sendEngagementActivity, startEngagementSession } from "@/features/novel-editor/api";
import type { EngagementActivityPayload } from "@/features/novel-editor/api";

export type EngagementTarget = { targetType: "STORY" | "EPISODE"; targetId: string };
type Clock = { setInterval: typeof window.setInterval; clearInterval: typeof window.clearInterval; now: () => number };
type Evidence = Omit<EngagementActivityPayload, "idempotencyKey" | "sequence" | "clientSessionKey" | "reportedActiveSeconds">;

const key = () => crypto.randomUUID();

export class EngagementSessionController {
  private sessionId?: string;
  private timer?: number;
  private sequence = 0;
  private lastInput = Date.now();
  private stopped = false;
  private starting = false;
  private failures = 0;
  private backoffUntil = 0;
  private readonly clientSessionKey = key();
  constructor(private target: EngagementTarget, private evidence: () => Evidence = () => ({
    evidenceType: "HEARTBEAT", progressPercent: 0,
  }), private clock: Clock = {
    setInterval: window.setInterval.bind(window), clearInterval: window.clearInterval.bind(window), now: Date.now,
  }) {}

  async start() {
    if (this.stopped || this.starting || this.sessionId || document.visibilityState !== "visible") return;
    this.starting = true;
    try {
      const result = await startEngagementSession({ ...this.target, clientSessionKey: this.clientSessionKey, idempotencyKey: key() });
      this.sessionId = result.sessionId;
      this.lastInput = this.clock.now();
      this.timer = this.clock.setInterval(() => void this.heartbeat(), 30_000);
      ["pointerdown", "keydown", "scroll"].forEach((event) =>
        window.addEventListener(event, this.onInput, { passive: true }));
    } catch { /* tracking never blocks reading */ }
    finally { this.starting = false; }
  }
  private onInput = () => { this.lastInput = this.clock.now(); };
  private async heartbeat() {
    if (!this.sessionId || this.stopped || document.visibilityState !== "visible" ||
        this.clock.now() - this.lastInput >= 60_000 || this.clock.now() < this.backoffUntil) return;
    try {
      await sendEngagementActivity(this.sessionId, {
        idempotencyKey: key(), sequence: ++this.sequence, clientSessionKey: this.clientSessionKey,
        reportedActiveSeconds: 30, ...this.evidence(),
      });
      this.failures = 0;
    } catch (reason) {
      const status = reason && typeof reason === "object" && "status" in reason
        ? Number((reason as { status: unknown }).status) : 0;
      if (status === 404 || status === 409) {
        if (this.timer !== undefined) this.clock.clearInterval(this.timer);
        this.timer = undefined;
        return;
      }
      if (status === 429) {
        this.backoffUntil = this.clock.now() + 60_000;
        return;
      }
      this.failures++;
      if (this.failures >= 3) {
        if (this.timer !== undefined) this.clock.clearInterval(this.timer);
        this.timer = undefined;
      }
    }
  }
  async stop() {
    this.stopped = true;
    if (this.timer !== undefined) this.clock.clearInterval(this.timer);
    ["pointerdown", "keydown", "scroll"].forEach((event) => window.removeEventListener(event, this.onInput));
    if (this.sessionId) try { await endEngagementSession(this.sessionId); } catch { /* best effort */ }
  }
}
