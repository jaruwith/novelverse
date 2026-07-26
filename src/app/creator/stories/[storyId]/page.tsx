import { CreatorStoryPage } from "@/features/novel-editor/CreatorStoryPages";
export default async function Page({ params }: { params: Promise<{ storyId: string }> }) {
  const { storyId } = await params;
  return <CreatorStoryPage storyId={storyId} />;
}
