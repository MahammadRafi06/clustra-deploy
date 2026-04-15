export const POLL_INTERVAL_MODELS = 10_000;
export const POLL_INTERVAL_JOBS = 5_000;
export const POLL_INTERVAL_HEALTH = 30_000;

export const MODEL_STATUS_OPTIONS = [
  { value: "available", label: "Available" },
  { value: "downloading", label: "Downloading" },
  { value: "download_failed", label: "Failed" },
  { value: "soft_deleted", label: "Soft Deleted" },
  { value: "hard_deleting", label: "Deleting" },
  { value: "integrity_error", label: "Integrity Error" },
];

export const SOURCE_OPTIONS = [
  { value: "huggingface", label: "Hugging Face" },
  { value: "git", label: "Git" },
];

export const SORT_OPTIONS = [
  { value: "created_at", label: "Created" },
  { value: "updated_at", label: "Updated" },
  { value: "total_size_bytes", label: "Size" },
  { value: "repo_id", label: "Name" },
];
