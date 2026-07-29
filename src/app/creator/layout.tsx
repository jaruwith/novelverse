import { CreatorAuthGuard } from "@/features/novel-editor/CreatorAuthGuard";

export default function CreatorLayout({ children }: { children: React.ReactNode }) {
  return <CreatorAuthGuard>{children}</CreatorAuthGuard>;
}
