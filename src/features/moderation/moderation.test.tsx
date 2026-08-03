import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/features/novel-editor/api";
import { ReportDialog } from "./ReportDialog";
import { ModeratorQueue } from "./ModeratorQueue";

const api = vi.hoisted(() => ({
  hasSession: vi.fn(),
  submitModerationReport: vi.fn(),
  getCurrentUser: vi.fn(),
  listModerationReports: vi.fn(),
  updateModerationWorkflow: vi.fn(),
  moderateTarget: vi.fn(),
}));

vi.mock("@/features/novel-editor/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/features/novel-editor/api")>();
  return { ...original, ...api };
});

const report = {
  id: "report-1", reporterUserId: "reporter-1", targetType: "STORY" as const,
  targetId: "target-secret-id", reason: "SPAM" as const, comment: "<script>alert(1)</script>",
  status: "OPEN" as const, assignedModeratorUserId: null, resolutionNote: null,
  createdAt: "2026-07-28T00:00:00Z", updatedAt: "2026-07-28T00:00:00Z",
  reviewedAt: null, resolvedAt: null, commentEvidence: null,
};
const page = { items: [report], page: 1, pageSize: 20, totalItems: 1, totalPages: 1,
  hasPreviousPage: false, hasNextPage: false };

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  api.hasSession.mockReturnValue(true);
  api.submitModerationReport.mockResolvedValue({
    id: "report-1", status: "OPEN", createdAt: "2026-07-28T00:00:00Z",
  });
  api.getCurrentUser.mockResolvedValue({ role: "MODERATOR" });
  api.listModerationReports.mockResolvedValue(page);
  api.updateModerationWorkflow.mockResolvedValue({ ...report, status: "UNDER_REVIEW" });
  api.moderateTarget.mockResolvedValue({ targetType: "STORY", targetId: report.targetId, state: "HIDDEN" });
});

describe("report experience", () => {
  it("shows Thai sign-in requirement to anonymous readers without exposing the target id", () => {
    api.hasSession.mockReturnValue(false);
    render(<ReportDialog targetType="STORY" targetId="internal-story-id" targetSummary="เรื่องทดสอบ" />);
    expect(screen.getByRole("link", { name: "เข้าสู่ระบบเพื่อรายงาน" })).toBeInTheDocument();
    expect(screen.queryByText("internal-story-id")).not.toBeInTheDocument();
  });

  it("opens, closes, requires a reason, and serializes an optional trimmed plain-text comment", async () => {
    render(<ReportDialog targetType="STORY" targetId="story-1" targetSummary="เรื่องทดสอบ" />);
    fireEvent.click(screen.getByRole("button", { name: "รายงาน" }));
    const reason = screen.getByLabelText("เหตุผล");
    expect(reason).toBeRequired();
    fireEvent.change(reason, { target: { value: "COPYRIGHT" } });
    fireEvent.change(screen.getByLabelText(/รายละเอียดเพิ่มเติม/), {
      target: { value: "  <b>plain</b>  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "ส่งรายงาน" }));
    await waitFor(() => expect(api.submitModerationReport).toHaveBeenCalledWith(
      "STORY", "story-1", "COPYRIGHT", "<b>plain</b>"));
    expect(screen.getByText("ส่งรายงานเรียบร้อยแล้ว")).toBeInTheDocument();
    expect(document.querySelector("[dangerouslySetInnerHTML]")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "ปิด" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows loading, duplicate, length feedback, and permits retry after transient failure", async () => {
    let release!: () => void;
    api.submitModerationReport.mockImplementationOnce(() =>
      new Promise((resolve) => { release = () => resolve({ id: "x", status: "OPEN", createdAt: "" }); }));
    render(<ReportDialog targetType="EPISODE" targetId="episode-1" targetSummary="ตอนทดสอบ" />);
    fireEvent.click(screen.getByRole("button", { name: "รายงาน" }));
    fireEvent.change(screen.getByLabelText("เหตุผล"), { target: { value: "SPAM" } });
    const comment = screen.getByLabelText(/รายละเอียดเพิ่มเติม/);
    fireEvent.change(comment, { target: { value: "x".repeat(1000) } });
    expect(screen.getByText("1000/1000")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "ส่งรายงาน" }));
    expect(screen.getByRole("button", { name: "กำลังส่ง…" })).toBeDisabled();
    release();
    await screen.findByText("ส่งรายงานเรียบร้อยแล้ว");

    api.submitModerationReport.mockRejectedValueOnce(new ApiError(409));
    fireEvent.click(screen.getByRole("button", { name: "ส่งรายงาน" }));
    expect(await screen.findByText("คุณได้รายงานเนื้อหานี้ด้วยเหตุผลเดียวกันแล้ว")).toBeInTheDocument();

    api.submitModerationReport.mockRejectedValueOnce(new ApiError(0, { detail: "เชื่อมต่อไม่ได้" }))
      .mockResolvedValueOnce({ id: "retry", status: "OPEN", createdAt: "" });
    fireEvent.click(screen.getByRole("button", { name: "ส่งรายงาน" }));
    expect(await screen.findByText("เชื่อมต่อไม่ได้")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "ส่งรายงาน" }));
    expect(await screen.findByText("ส่งรายงานเรียบร้อยแล้ว")).toBeInTheDocument();
  });
});

describe("moderator queue", () => {
  it("conceals controls from ordinary users and maps unauthorized state", async () => {
    api.getCurrentUser.mockResolvedValue({ role: "USER" });
    render(<ModeratorQueue />);
    expect(await screen.findByRole("alert")).toHaveTextContent("ไม่มีสิทธิ์");
    expect(screen.queryByRole("button", { name: "Hide and close report" })).not.toBeInTheDocument();
    expect(api.listModerationReports).not.toHaveBeenCalled();
  });

  it("renders loading, empty, errors with retry, and report comments as text", async () => {
    let release!: (value: typeof page) => void;
    api.listModerationReports.mockImplementationOnce(() =>
      new Promise((resolve) => { release = resolve; }));
    const view = render(<ModeratorQueue />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading reports");
    await waitFor(() => expect(release).toBeTypeOf("function"));
    release(page);
    expect(await screen.findByText("<script>alert(1)</script>")).toBeInTheDocument();
    expect(document.querySelector("script")).toBeNull();
    view.unmount();

    api.listModerationReports.mockResolvedValueOnce({ ...page, items: [], totalItems: 0, totalPages: 0 });
    const empty = render(<ModeratorQueue />);
    expect(await screen.findByText("No reports.")).toBeInTheDocument();
    empty.unmount();

    api.listModerationReports.mockRejectedValueOnce(new ApiError(0, { detail: "ระบบไม่พร้อม" }))
      .mockResolvedValueOnce(page);
    render(<ModeratorQueue />);
    expect(await screen.findByText("ระบบไม่พร้อม")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("STORY · SPAM")).toBeInTheDocument();
  });

  it("serializes filters, ordering, paging, review and dismissal", async () => {
    render(<ModeratorQueue />);
    await screen.findByText("STORY · SPAM");
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "OPEN" } });
    fireEvent.change(screen.getByLabelText("Target type"), { target: { value: "STORY" } });
    fireEvent.change(screen.getByLabelText("Sort"), { target: { value: "OLDEST" } });
    await waitFor(() => expect(api.listModerationReports).toHaveBeenLastCalledWith({
      status: "OPEN", targetType: "STORY", sort: "OLDEST", page: 1, signal: expect.any(AbortSignal),
    }));
    fireEvent.click(screen.getByRole("button", { name: "Start review" }));
    await waitFor(() => expect(api.updateModerationWorkflow).toHaveBeenCalledWith("report-1", "UNDER_REVIEW"));
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    await waitFor(() => expect(api.updateModerationWorkflow).toHaveBeenCalledWith("report-1", "DISMISSED"));
  });

  it("confirms hide and restore and renders conflicts safely", async () => {
    vi.spyOn(globalThis, "confirm").mockReturnValue(true);
    api.moderateTarget.mockRejectedValueOnce(new ApiError(409, { detail: "สถานะถูกเปลี่ยนแล้ว" }))
      .mockResolvedValueOnce({ targetType: "STORY", targetId: report.targetId, state: "VISIBLE" });
    render(<ModeratorQueue />);
    await screen.findByText("STORY · SPAM");
    fireEvent.click(screen.getByRole("button", { name: "Hide and close report" }));
    expect(await screen.findByText("สถานะถูกเปลี่ยนแล้ว")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Restore target" }));
    await waitFor(() => expect(api.moderateTarget).toHaveBeenLastCalledWith("restore",
      expect.objectContaining({ targetType: "STORY", targetId: "target-secret-id", reasonCode: "SPAM",
        operationId: expect.any(String) })));
  });

  it("renders COMMENT evidence as literal restricted text with lifecycle distinction", async () => {
    api.listModerationReports.mockResolvedValueOnce({ ...page, items: [{ ...report,
      targetType: "COMMENT", reporterUserId: null, commentEvidence: {
        commentId: "11111111-1111-4111-8111-111111111111",
        bodySnapshot: "<script>report-time text</script>", isSpoiler: true,
        commentCreatedAt: "2026-08-03T00:00:00Z", commentEditedAt: null,
        evidenceCreatedAt: "2026-08-03T00:01:00Z", integrityHash: "base64",
        currentState: "DELETED", currentVersion: 3,
      },
    }] });
    render(<ModeratorQueue />);
    expect(await screen.findByText("COMMENT · SPAM")).toBeInTheDocument();
    expect(screen.getByText("<script>report-time text</script>")).toBeInTheDocument();
    expect(document.querySelector("script")).toBeNull();
    expect(screen.getByText("Current state: DELETED")).toBeInTheDocument();
    expect(screen.getByText("Whole-body spoiler at report time")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Comment" })).toBeInTheDocument();
  });
});
