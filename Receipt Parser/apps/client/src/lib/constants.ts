export const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8787";

export const PAGE_SIZE = 8;

export const PARSE_REQUEST_TIMEOUT_MS = 75_000;

export const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png"] as const;
