import type { ThumbnailStyle } from "../../domain/thumbnail-style";

export type ThumbnailState = 'enabled' | 'disabled' | 'misconfigured' | 'api-key-unsupported';
export type ThumbnailQuality = 'unreviewed' | 'accepted' | 'below-target';

export interface ThumbnailText {
  title: string;
  date: string;
}

export interface ThumbnailProviderRequest extends ThumbnailText {
  style: ThumbnailStyle;
  directory: string;
  backgroundPath: string;
  referencePaths: string[];
  guidePath?: string;
  log: ThumbnailLog;
}

export interface ThumbnailImage {
  png: Buffer;
  quality: ThumbnailQuality;
}

export type ThumbnailLog = (event: string, fields: Record<string, string | number | boolean | undefined>,
                            level?: 'info' | 'warn') => void;

export interface AiThumbnailProvider {
  readonly state: ThumbnailState;
  generate(request: ThumbnailProviderRequest, signal: AbortSignal): Promise<ThumbnailImage | undefined>;
}
