import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreatorAuthGuard } from "./CreatorAuthGuard";
import * as api from "./api";

const replace = vi.fn();
const router = { replace };
let pathname = "/creator/dashboard";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => router,
}));
vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api")>();
  return { ...actual, getCurrentUser: vi.fn() };
});

const user = {
  id: "user-1", status: "ACTIVE" as const, displayName: "Creator",
  creatorSlug: null, activatedAt: "2026-07-01T00:00:00Z",
  createdAt: "2026-07-01T00:00:00Z", role: "USER" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  pathname = "/creator/dashboard";
  vi.mocked(api.getCurrentUser).mockResolvedValue(user);
});

describe("CreatorAuthGuard Dashboard boundary", () => {
  it("allows an active incomplete profile to render capability-driven Dashboard onboarding", async () => {
    render(<CreatorAuthGuard><p>Dashboard client</p></CreatorAuthGuard>);
    expect(await screen.findByText("Dashboard client")).toBeInTheDocument();
  });

  it("continues to protect Story tools until creator profile setup is complete", async () => {
    pathname = "/creator/stories";
    render(<CreatorAuthGuard><p>Story tools</p></CreatorAuthGuard>);
    expect(await screen.findByRole("link")).toHaveAttribute("href", "/creator/profile");
    expect(screen.queryByText("Story tools")).not.toBeInTheDocument();
  });

  it("redirects an unauthenticated creator without rendering private content", async () => {
    vi.mocked(api.getCurrentUser).mockRejectedValueOnce(new api.ApiError(401));
    render(<CreatorAuthGuard><p>Private Dashboard</p></CreatorAuthGuard>);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login?next=%2Fcreator%2Fdashboard"));
    expect(screen.queryByText("Private Dashboard")).not.toBeInTheDocument();
  });
});
