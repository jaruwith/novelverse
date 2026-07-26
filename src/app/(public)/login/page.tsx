"use client";

import { useState } from "react";
import {
  acceptLegalDocuments, apiErrorMessage, developmentLogin, getCurrentLegalDocuments,
  updateCurrentUserProfile,
} from "@/features/novel-editor/api";
import type { SocialProvider } from "@/features/novel-editor/types";

export default function Page() {
  const [provider, setProvider] = useState<SocialProvider>("GOOGLE");
  const [email, setEmail] = useState("creator@novelverse.local");
  const [displayName, setDisplayName] = useState("NovelVerse Creator");
  const [providerSubject, setProviderSubject] = useState("local-creator");
  const [creatorSlug, setCreatorSlug] = useState("local-creator");
  const [acceptRequired, setAcceptRequired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isDevelopment = process.env.NODE_ENV === "development";

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const session = await developmentLogin({ provider, email, displayName, providerSubject });
      if (session.user.status === "PENDING_LEGAL_ACCEPTANCE") {
        const documents = await getCurrentLegalDocuments();
        const requiredIds = documents.filter((document) =>
          document.isRequired &&
          (document.documentType === "TERMS_OF_SERVICE" || document.documentType === "PRIVACY_NOTICE")
        ).map((document) => document.id);
        if (!acceptRequired || !requiredIds.length) throw new Error("Required legal documents must be accepted.");
        await acceptLegalDocuments(requiredIds);
      }
      if (!session.user.creatorSlug) await updateCurrentUserProfile(displayName, creatorSlug);
      const destination = new URLSearchParams(window.location.search).get("next");
      window.location.assign(destination?.startsWith("/") ? destination : "/creator/stories");
    } catch (reason) {
      setError(apiErrorMessage(reason));
      setBusy(false);
    }
  }

  return <div className="container narrow"><section className="panel">
    <span className="eyebrow">NovelVerse</span><h1>เข้าสู่ระบบ</h1>
    {!isDevelopment ? <p role="alert">ระบบ production OAuth ยังไม่ได้เชื่อมต่อใน backend ปัจจุบัน</p> :
      <form onSubmit={signIn}>
        <p className="muted">แบบฟอร์มนี้เรียก development-only social sign-in ของ NovelVerseApi และจะใช้ไม่ได้เมื่อ API ไม่ได้รันใน Development</p>
        <label>Provider<select value={provider} onChange={(event) => setProvider(event.target.value as SocialProvider)}>
          <option value="GOOGLE">Google</option><option value="FACEBOOK">Facebook</option>
        </select></label>
        <label>Provider subject<input required maxLength={255} value={providerSubject} onChange={(event) => setProviderSubject(event.target.value)} /></label>
        <label>Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label>ชื่อที่แสดง<input required maxLength={100} value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
        <label>Creator slug<input required maxLength={100} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={creatorSlug} onChange={(event) => setCreatorSlug(event.target.value)} /></label>
        <label><input type="checkbox" checked={acceptRequired} onChange={(event) => setAcceptRequired(event.target.checked)} />
          ยอมรับเอกสาร Terms of Service และ Privacy Notice เวอร์ชันปัจจุบันสำหรับบัญชี Development นี้</label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={busy}>{busy ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบสำหรับ Development"}</button>
      </form>}
  </section></div>;
}
