import { useState, useEffect, useCallback } from "react";
import * as api from "../api/client";
import type { JobSummary, PaginatedResponse } from "../api/types";
import { POLL_INTERVAL_JOBS } from "../utils/constants";

export function useJobs(params: { page?: number; kind?: string; status?: string; model_id?: string } = {}) {
  const [data, setData] = useState<PaginatedResponse<JobSummary> | undefined>();
  const [isLoading, setIsLoading] = useState(true);

  const fetch = useCallback(() => {
    api.listJobs(params).then(setData).catch(() => {}).finally(() => setIsLoading(false));
  }, [JSON.stringify(params)]);

  useEffect(() => {
    fetch();
    const id = setInterval(fetch, POLL_INTERVAL_JOBS);
    return () => clearInterval(id);
  }, [fetch]);

  return { data, isLoading };
}

export function useCancelJob() {
  const mutate = useCallback((id: string) => { api.cancelJob(id).catch(() => {}); }, []);
  return { mutate };
}

export function useRetryJob() {
  const mutate = useCallback((id: string) => { api.retryJob(id).catch(() => {}); }, []);
  return { mutate };
}
