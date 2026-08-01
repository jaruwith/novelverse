"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiErrorMessage, getCurrentUser, updateCurrentUserProfile } from "@/features/novel-editor/api";
import styles from "./creatorDashboard.module.css";

export function CreatorProfilePage() {
  const [displayName, setDisplayName] = useState("");
  const [creatorSlug, setCreatorSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getCurrentUser().then((user) => {
      if (!active) return;
      setDisplayName(user.displayName);
      setCreatorSlug(user.creatorSlug ?? "");
      setLoading(false);
    }).catch((reason) => {
      if (active) { setError(apiErrorMessage(reason)); setLoading(false); }
    });
    return () => { active = false; };
  }, []);

  return <main className={`${styles.page} narrow`}>
    <header className={styles.pageIntro}><p className={styles.eyebrow}>Creator workspace</p>
      <h1>Creator profile</h1><p>Manage the identity used by your existing creator tools.</p></header>
    {loading ? <div role="status" className={`${styles.headerCard} ${styles.skeletonBlock}`}>
      <span className={styles.srOnly}>Loading creator profile</span></div>
      : <form className="panel formGrid" onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true); setError(""); setMessage("");
        try {
          await updateCurrentUserProfile(displayName.trim(), creatorSlug.trim());
          setMessage("Creator profile saved.");
        } catch (reason) {
          setError(apiErrorMessage(reason));
        } finally {
          setSaving(false);
        }
      }}>
        <label>Display name<input required maxLength={100} value={displayName}
          onChange={(event) => setDisplayName(event.target.value)} /></label>
        <label>Creator slug<input required maxLength={100} pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          value={creatorSlug} onChange={(event) => setCreatorSlug(event.target.value)} /></label>
        {error && <div className="full" role="alert">{error}</div>}
        {message && <div className="full" role="status">{message}</div>}
        <div className="actions full"><button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save profile"}</button>
          <Link className="secondaryButton primaryButton" href="/creator/dashboard">Back to Dashboard</Link></div>
      </form>}
  </main>;
}
