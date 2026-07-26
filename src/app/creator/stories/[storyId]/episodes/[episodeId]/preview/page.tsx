import { EpisodePreview } from "@/features/novel-editor/EpisodePreview";

export default async function Page({
  params,
}: {
  params: Promise<{ storyId: string; episodeId: string }>;
}) {
  const { storyId, episodeId } = await params;
  return <EpisodePreview storyId={storyId} episodeId={episodeId} />;
}
