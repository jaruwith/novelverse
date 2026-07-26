import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ContentBlockList } from "./ContentBlockList";
import { NovelContentRenderer } from "./NovelContentRenderer";
import type { EditorBlock } from "./types";

const blocks: EditorBlock[] = [
  { localKey: "text", type: "TEXT", textContent: "บรรทัดหนึ่ง\nบรรทัดสอง", mediaAssetId: null },
  { localKey: "divider", type: "DIVIDER", textContent: null, mediaAssetId: null },
  { localKey: "image", type: "IMAGE", textContent: null, mediaAssetId: "asset-1" },
];

describe("NovelContentRenderer", () => {
  it("renders text, divider, and image placeholder", () => {
    const { container } = render(<NovelContentRenderer blocks={blocks} />);
    expect(screen.getByText(/บรรทัดหนึ่ง/).className).toContain("previewText");
    expect(container.querySelector("hr")).toBeInTheDocument();
    expect(screen.getByText("ภาพประกอบยังไม่พร้อมแสดง")).toBeInTheDocument();
  });

  it("never uses dangerouslySetInnerHTML", () => {
    const source = readFileSync(path.join(process.cwd(), "src/features/novel-editor/NovelContentRenderer.tsx"), "utf8");
    expect(source).not.toContain("dangerouslySetInnerHTML");
  });
});

describe("ContentBlockList", () => {
  it("edits and reorders blocks", () => {
    const onChange = vi.fn();
    render(<ContentBlockList blocks={blocks} onChange={onChange} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "แก้ไขแล้ว" } });
    expect(onChange.mock.calls[0][0][0].textContent).toBe("แก้ไขแล้ว");
    fireEvent.click(screen.getByLabelText("เลื่อนบล็อก 1 ลง"));
    expect(onChange.mock.calls[1][0].map((block: EditorBlock) => block.type)).toEqual(["DIVIDER", "TEXT", "IMAGE"]);
  });

  it("confirms before deleting", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ContentBlockList blocks={blocks} onChange={onChange} />);
    await user.click(screen.getByLabelText("ลบบล็อก 2"));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByText("ยืนยันการลบ"));
    expect(onChange.mock.calls[0][0].map((block: EditorBlock) => block.type)).toEqual(["TEXT", "IMAGE"]);
  });
});
