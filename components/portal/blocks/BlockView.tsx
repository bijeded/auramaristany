"use client";
import { TextBlock } from "./TextBlock";
import { YoutubeBlock } from "./YoutubeBlock";
import { PdfBlock } from "./PdfBlock";
import { ImageBlock } from "./ImageBlock";
import { CardioZone2Block } from "./CardioZone2Block";
import { ExerciseListReadOnly, type ReadOnlyExercise } from "./ExerciseListReadOnly";

export interface ViewBlock {
  id: string;
  block_type: string;
  content: Record<string, unknown>;
}

export function BlockView({ block }: { block: ViewBlock }) {
  switch (block.block_type) {
    case "text":
      return <TextBlock content={block.content as { html: string }} />;
    case "youtube":
      return <YoutubeBlock content={block.content as { video_id: string; title: string }} />;
    case "pdf":
      return (
        <PdfBlock content={block.content as { storage_path: string; filename: string; label: string }} />
      );
    case "image":
      return <ImageBlock content={block.content as { storage_path: string; alt: string }} />;
    case "cardio_zone2":
      return <CardioZone2Block />;
    case "exercise_list":
      return <ExerciseListReadOnly content={block.content as { exercises: ReadOnlyExercise[] }} />;
    default:
      return null;
  }
}
