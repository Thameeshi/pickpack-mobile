import { useState, useEffect, useCallback } from 'react';
import { getTasksBySupervisor, getTasksByDriver } from '../services/taskService';
import { Task } from '../types';

export function useTasksBySupervisor(supervisorId: string) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!supervisorId) return;
    setLoading(true);
    try {
      const data = await getTasksBySupervisor(supervisorId);
      setTasks(data);
    } catch (e) {
      console.error('Failed to fetch supervisor tasks:', e);
    } finally {
      setLoading(false);
    }
  }, [supervisorId]);

  useEffect(() => { refetch(); }, [refetch]);

  return { tasks, loading, refetch };
}

export function useTasksByDriver(driverId: string) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!driverId) return;
    setLoading(true);
    try {
      const data = await getTasksByDriver(driverId);
      setTasks(data);
    } catch (e) {
      console.error('Failed to fetch driver tasks:', e);
    } finally {
      setLoading(false);
    }
  }, [driverId]);

  useEffect(() => { refetch(); }, [refetch]);

  return { tasks, loading, refetch };
}
