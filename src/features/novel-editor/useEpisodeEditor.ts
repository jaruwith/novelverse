"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  apiErrorMessage,
  getEpisode,
  getEpisodeContent,
  getStory,
  listEpisodes,
  publishEpisode,
  replaceEpisodeContent,
  updateEpisode,
} from "./api";
import {
  hasPublishableText,
  serializeBlocks,
  validateBlocksForSave,
  type EditorBlock,
  type Episode,
  type Story,
} from "./types";

export type SaveStatus = "clean" | "dirty" | "saving" | "saved" | "failed";

export function useEpisodeEditor(storyId: string, episodeId: string) {
  const [story, setStory] = useState<Story | null>(null);
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [blocks, setBlocksState] = useState<EditorBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("clean");
  const [message, setMessage] = useState("");
  const [publishing, setPublishing] = useState(false);
  const revision = useRef(0);
  const savedRevision = useRef(0);
  const writing = useRef<Promise<boolean> | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      getStory(storyId),
      getEpisode(storyId, episodeId),
      getEpisodeContent(storyId, episodeId),
      listEpisodes(storyId),
    ]).then(([nextStory, nextEpisode, nextContent, nextEpisodes]) => {
      if (!active) return;
      setStory(nextStory);
      setEpisode(nextEpisode);
      setBlocksState(nextContent.blocks);
      setEpisodes(nextEpisodes.items);
      revision.current = 0;
      savedRevision.current = 0;
      setSaveStatus("clean");
    }).catch((error) => {
      if (active) setMessage(apiErrorMessage(error));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [storyId, episodeId]);

  const markDirty = useCallback(() => {
    revision.current += 1;
    setSaveStatus("dirty");
    setMessage("");
  }, []);

  const setBlocks = useCallback((
    value: EditorBlock[] | ((current: EditorBlock[]) => EditorBlock[]),
  ) => {
    setBlocksState(value);
    markDirty();
  }, [markDirty]);

  const setMetadata = useCallback((field: "title" | "synopsis", value: string) => {
    setEpisode((current) => current ? { ...current, [field]: value } : current);
    markDirty();
  }, [markDirty]);

  const save = useCallback(async (): Promise<boolean> => {
    if (!episode) return false;
    const validation = validateBlocksForSave(blocks);
    if (validation) {
      setSaveStatus("failed");
      setMessage(validation);
      return false;
    }
    if (writing.current) {
      const previousSucceeded = await writing.current;
      if (!previousSucceeded) return false;
    }
    const targetRevision = revision.current;
    const metadata = {
      title: episode.title.trim(),
      slug: episode.slug || null,
      episodeNumber: episode.episodeNumber,
      sortOrder: episode.sortOrder,
      visibility: episode.visibility,
      synopsis: episode.synopsis,
    };
    const payload = serializeBlocks(blocks);
    setSaveStatus("saving");
    setMessage("");
    const operation = (async () => {
      try {
        await updateEpisode(storyId, episodeId, metadata);
        await replaceEpisodeContent(storyId, episodeId, payload);
        savedRevision.current = targetRevision;
        if (mounted.current) {
          setSaveStatus(revision.current === targetRevision ? "saved" : "dirty");
        }
        return true;
      } catch (error) {
        if (mounted.current) {
          setSaveStatus("failed");
          setMessage(apiErrorMessage(error));
        }
        return false;
      } finally {
        writing.current = null;
      }
    })();
    writing.current = operation;
    return operation;
  }, [blocks, episode, episodeId, storyId]);

  useEffect(() => {
    if (saveStatus !== "dirty") return;
    const timer = window.setTimeout(() => { void save(); }, 1500);
    return () => window.clearTimeout(timer);
  }, [save, saveStatus]);

  const hasUnsavedChanges = saveStatus === "dirty" || saveStatus === "saving" || saveStatus === "failed";
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsavedChanges]);

  const publish = useCallback(async () => {
    if (publishing || !episode) return;
    if (!hasPublishableText(blocks)) {
      setMessage("ต้องมีบล็อกข้อความที่ไม่ว่างอย่างน้อย 1 บล็อกก่อนเผยแพร่");
      return;
    }
    setPublishing(true);
    setMessage("");
    const saved = await save();
    if (!saved) {
      setPublishing(false);
      return;
    }
    try {
      const published = await publishEpisode(storyId, episodeId);
      setEpisode((current) => current ? { ...current, ...published, status: published.status || "PUBLISHED" } : current);
      setMessage("เผยแพร่ตอนเรียบร้อยแล้ว");
    } catch (error) {
      setMessage(apiErrorMessage(error));
    } finally {
      setPublishing(false);
    }
  }, [blocks, episode, episodeId, publishing, save, storyId]);

  return {
    story, episode, episodes, blocks, loading, saveStatus, message, publishing,
    setBlocks, setMetadata, save, publish, hasUnsavedChanges,
  };
}
