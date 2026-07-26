import { EpisodeEditorRouter } from "@/features/novel-editor/EpisodeEditorRouter";

export default async function Page({
  params,
}: {
  params: Promise<{ storyId: string; episodeId: string }>;
}) {
  const { storyId, episodeId } = await params;
  return <EpisodeEditorRouter storyId={storyId} episodeId={episodeId} />;
}
