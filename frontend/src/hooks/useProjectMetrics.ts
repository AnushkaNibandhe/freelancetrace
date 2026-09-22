import { useState, useEffect } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';
const ENABLE_METRICS_WS = import.meta.env.VITE_ENABLE_METRICS_WS === 'true';

const toWebSocketUrl = (baseUrl: string) => {
  if (baseUrl.startsWith('https://')) {
    return baseUrl.replace('https://', 'wss://');
  }
  if (baseUrl.startsWith('http://')) {
    return baseUrl.replace('http://', 'ws://');
  }
  return `ws://${baseUrl}`;
};

export interface ProjectMetrics {
  id: number;
  project_id: number;
  fulfillment_score: number;
  drift_score: number;
  delay_risk: number;
  trust_score: number;
  compliance_score: number;
}

export const useProjectMetrics = (projectId: string) => {
  const [metrics, setMetrics] = useState<ProjectMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initial fetch
    const fetchMetrics = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/projects/${projectId}/metrics`);
        if (!response.ok) {
          throw new Error('Failed to fetch metrics');
        }
        const data = await response.json();
        setMetrics(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMetrics();

    if (!ENABLE_METRICS_WS) {
      return;
    }

    // Setup WebSocket (optional)
    const wsBaseUrl = toWebSocketUrl(API_BASE_URL);
    const ws = new WebSocket(`${wsBaseUrl}/ws/projects/${projectId}`);
    
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.event === 'metrics_updated' && payload.data) {
          setMetrics(prev => {
            if (!prev) return payload.data;
            return {
              ...prev,
              ...payload.data
            };
          });
        }
      } catch (e) {
        console.error("Error parsing websocket message for metrics", e);
      }
    };

    return () => {
      ws.close();
    };
  }, [projectId]);

  return { metrics, isLoading, error };
};
