export interface CliOptions {
  file?: string;
  frameDurationMs: number;
  frames: number;
  json: boolean;
  keepWork: boolean;
  maxDownloadBytes: number;
  outputDir: string;
  padding: number;
  quality: number;
  r2Key?: string;
  size: number;
  slug?: string;
  upload: boolean;
  url?: string;
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
