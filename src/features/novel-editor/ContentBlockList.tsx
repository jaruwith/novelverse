"use client";

import { useState } from "react";
import type { EditorBlock } from "./types";
import { TEXT_BLOCK_LIMIT } from "./types";
import styles from "./novelEditor.module.css";

export function ContentBlockList({
  blocks,
  onChange,
}: {
  blocks: EditorBlock[];
  onChange: (blocks: EditorBlock[]) => void;
}) {
  const [deleteKey, setDeleteKey] = useState<string | null>(null);
  const move = (index: number, offset: number) => {
    const target = index + offset;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  return (
    <div className={styles.blockList}>
      {blocks.map((block, index) => (
        <section className={styles.blockCard} key={block.localKey} data-testid={`block-${block.type}`}>
          <div className={styles.blockToolbar}>
            <strong>{block.type === "TEXT" ? "ข้อความ" : block.type === "DIVIDER" ? "เส้นคั่น" : "รูปภาพ"}</strong>
            <span>ลำดับ {index + 1}</span>
            <button type="button" className="textButton" onClick={() => move(index, -1)}
              disabled={index === 0} aria-label={`เลื่อนบล็อก ${index + 1} ขึ้น`}>↑</button>
            <button type="button" className="textButton" onClick={() => move(index, 1)}
              disabled={index === blocks.length - 1} aria-label={`เลื่อนบล็อก ${index + 1} ลง`}>↓</button>
            <button type="button" className="textButton" onClick={() => setDeleteKey(block.localKey)}
              aria-label={`ลบบล็อก ${index + 1}`}>ลบ</button>
          </div>
          {block.type === "TEXT" && (
            <label className={styles.textEditor}>
              <span className="srOnly">เนื้อหาบล็อก {index + 1}</span>
              <textarea
                rows={8}
                value={block.textContent}
                maxLength={TEXT_BLOCK_LIMIT + 1}
                onChange={(event) => {
                  const textContent = event.target.value;
                  onChange(blocks.map((item) =>
                    item.localKey === block.localKey && item.type === "TEXT"
                      ? { ...item, textContent }
                      : item
                  ));
                }}
              />
              <small className={block.textContent.length > TEXT_BLOCK_LIMIT ? styles.limitError : ""}>
                {block.textContent.length.toLocaleString("th-TH")} / {TEXT_BLOCK_LIMIT.toLocaleString("th-TH")} ตัวอักษร
              </small>
            </label>
          )}
          {block.type === "DIVIDER" && <hr className={styles.divider} />}
          {block.type === "IMAGE" && (
            block.mediaUrl
              // The URL comes from the validated backend media contract.
              // eslint-disable-next-line @next/next/no-img-element
              ? <img className={styles.previewImage} src={block.mediaUrl} alt="ภาพประกอบนิยาย" />
              : <div className={styles.imagePlaceholder}>ภาพประกอบยังไม่พร้อมแสดง</div>
          )}
        </section>
      ))}
      {deleteKey && (
        <div className={styles.confirm} role="dialog" aria-modal="true" aria-labelledby="delete-block-title">
          <div>
            <h2 id="delete-block-title">ลบบล็อกนี้หรือไม่?</h2>
            <p>เนื้อหาในบล็อกจะหายจากฉบับที่กำลังแก้ไข</p>
            <div className="actions">
              <button type="button" className="secondaryButton" onClick={() => setDeleteKey(null)}>ยกเลิก</button>
              <button type="button" className="dangerButton" onClick={() => {
                onChange(blocks.filter((block) => block.localKey !== deleteKey));
                setDeleteKey(null);
              }}>ยืนยันการลบ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
