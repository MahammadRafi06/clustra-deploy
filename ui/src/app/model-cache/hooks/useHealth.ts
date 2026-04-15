import { useState, useEffect, useCallback } from "react";
import * as api from "../api/client";
import type { SystemHealth, NodeInfo } from "../api/types";
import { POLL_INTERVAL_HEALTH } from "../utils/constants";

export function useHealth() {
  const [data, setData] = useState<SystemHealth | undefined>();
  const [isLoading, setIsLoading] = useState(true);

  const fetch = useCallback(() => {
    api.getSystemHealth().then(setData).catch(() => {}).finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    fetch();
    const id = setInterval(fetch, POLL_INTERVAL_HEALTH);
    return () => clearInterval(id);
  }, [fetch]);

  return { data, isLoading };
}

export function useNodes() {
  const [data, setData] = useState<NodeInfo[]>([]);

  useEffect(() => {
    api.listNodes().then(setData).catch(() => {});
    const id = setInterval(() => api.listNodes().then(setData).catch(() => {}), POLL_INTERVAL_HEALTH);
    return () => clearInterval(id);
  }, []);

  return { data };
}
