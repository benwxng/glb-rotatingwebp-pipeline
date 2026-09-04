export interface CliOptions {
  artifact: ArtifactMetadata;
  file?: string;
  frameDurationMs: number;
  frames: number;
  json: boolean;
  keepWork: boolean;
  maxDownloadBytes: number;
  outputDir: string;
  padding: number;
  publish: boolean;
  quality: number;
  renderSize: number;
  r2Key?: string;
  size: number;
  sketchfabUid?: string;
  slug?: string;
  upload: boolean;
  url?: string;
}

export interface ArtifactMetadata {
  dateDisplay?: string;
  description?: string;
  earliestYear?: number;
  latestYear?: number;
  license?: string;
  modelUrl?: string;
  name?: string;
  origin?: string;
  peopleGroup?: string;
  religiousSignificance?: string;
  sourceUrl?: string;
  summary?: string;
}

export interface SketchfabDownload {
  archiveUrl: string;
  sourceLabel: string;
}

export interface DownloadResult {
  contentType: string | null;
  path: string;
  sourceLabel: string;
}

export interface WebpInspection {
  canvasHeight: number;
  canvasWidth: number;
  frames: number;
  hasAnimation: boolean;
  hasTransparency: boolean;
  loopCount: number;
  raw: string;
}

export interface PipelineResult {
  bytes: number;
  catalogArtifactId: string | null;
  catalogAssetId: string | null;
  catalogCreated: boolean | null;
  catalogRegistered: boolean;
  durationMs: number;
  frames: number;
  height: number;
  localPath: string;
  publicUrl: string | null;
  r2Key: string | null;
  sha256: string;
  slug: string;
  source: string;
  uploaded: boolean;
  width: number;
}
