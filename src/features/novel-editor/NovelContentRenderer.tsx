import type { EditorBlock } from "./types";
import styles from "./novelEditor.module.css";

export function NovelContentRenderer({ blocks }: { blocks: EditorBlock[] }) {
  if (!blocks.length) return <p className={styles.empty}>ตอนนี้ยังไม่มีเนื้อหา</p>;
  return (
    <div className={styles.renderedContent} data-testid="novel-content-renderer">
      {blocks.map((block) => {
        if (block.type === "TEXT") {
          return <p className={styles.previewText} key={block.localKey}>{block.textContent}</p>;
        }
        if (block.type === "DIVIDER") {
          return <hr className={styles.previewDivider} key={block.localKey} />;
        }
        return block.mediaUrl
          // The URL comes from the validated backend media contract.
          // eslint-disable-next-line @next/next/no-img-element
          ? <img className={styles.previewImage} src={block.mediaUrl}
              width={block.width ?? undefined} height={block.height ?? undefined}
              alt="ภาพประกอบนิยาย" key={block.localKey} />
          : <div className={styles.imagePlaceholder} key={block.localKey}>ภาพประกอบยังไม่พร้อมแสดง</div>;
      })}
    </div>
  );
}
