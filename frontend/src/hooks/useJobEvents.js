import { useEffect, useRef, useState } from 'react';

/**
 * Hook to listen for real-time job updates via SSE
 * @param {string} jobId - Job ID to listen for
 * @param {function} onUpdate - Callback when job updates
 * @returns {function} cleanup function
 */
export function useJobEvents(jobId, onUpdate) {
  const eventSourceRef = useRef(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const maxRetries = 3;

  useEffect(() => {
    if (!jobId || !onUpdate) return;

    const apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:8080';
    
    const connectSSE = () => {
      if (connectionAttempts >= maxRetries) {
        console.warn('Max SSE connection attempts reached, relying on fallback polling');
        return;
      }

      const eventSource = new EventSource(`${apiBase}/api/events/jobs/${jobId}`);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('SSE connection established for job:', jobId);
        setConnectionAttempts(0); // Reset on successful connection
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('SSE message received:', data);
          onUpdate(data);
        } catch (error) {
          console.warn('Failed to parse SSE data:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.warn('SSE connection error:', error);
        eventSource.close();
        
        // Check if this is a 404 error (job not found)
        if (eventSource.readyState === EventSource.CLOSED) {
          // Don't retry if job doesn't exist
          console.log('SSE connection closed, job may not exist');
          return;
        }
        
        // Retry connection after a delay
        if (connectionAttempts < maxRetries) {
          setConnectionAttempts(prev => prev + 1);
          setTimeout(() => {
            console.log(`Retrying SSE connection (attempt ${connectionAttempts + 1}/${maxRetries})`);
            connectSSE();
          }, 2000 * (connectionAttempts + 1)); // Exponential backoff
        }
      };
    };

    connectSSE();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [jobId, onUpdate, connectionAttempts]);

  return () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  };
}