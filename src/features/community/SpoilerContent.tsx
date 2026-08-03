"use client";

import { useState } from "react";
import styles from "./community.module.css";

export function SpoilerContent({ body }: { body: string }) {
  const [revealed, setRevealed] = useState(false);
  return <div className={styles.spoiler}>
    <button type="button" aria-expanded={revealed} onClick={() => setRevealed((value) => !value)}>
      {revealed ? "Hide spoiler" : "Reveal spoiler"}
    </button>
    {revealed && <p className={styles.body}>{body}</p>}
  </div>;
}
