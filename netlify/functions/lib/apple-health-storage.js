import { getStore } from '@netlify/blobs';

const STORE_NAME = 'apple-health';
const METRICS_KEY = 'merged-metrics.json';
const SYNC_LOG_KEY = 'sync-log.json';
const MAX_SYNC_LOG = 50;
const MAX_POINTS_PER_METRIC = 500;

function getHealthStore() {
  return getStore(STORE_NAME);
}

function pointKey(metricName, point) {
  const date = point.date || point.startDate || '';
  return `${metricName}:${date}`;
}

function sortPoints(points) {
  return points.sort((a, b) => {
    const aDate = new Date(a.date || a.startDate || 0).getTime();
    const bDate = new Date(b.date || b.startDate || 0).getTime();
    return aDate - bDate;
  });
}

export function extractPayload(body) {
  const metrics = body?.data?.metrics || body?.metrics || [];
  const workouts = body?.data?.workouts || body?.workouts || [];
  return { metrics, workouts };
}

export function mergeMetrics(existingMetrics, incomingMetrics) {
  const merged = { ...existingMetrics };

  for (const metric of incomingMetrics) {
    if (!metric?.name) continue;

    const current = merged[metric.name] || { units: metric.units, data: [] };
    const pointMap = new Map(
      (current.data || []).map((point) => [pointKey(metric.name, point), point])
    );

    for (const point of metric.data || []) {
      pointMap.set(pointKey(metric.name, point), point);
    }

    merged[metric.name] = {
      units: metric.units || current.units,
      data: sortPoints(Array.from(pointMap.values())).slice(-MAX_POINTS_PER_METRIC)
    };
  }

  return merged;
}

export function mergeWorkouts(existingWorkouts, incomingWorkouts) {
  const workoutMap = new Map(
    (existingWorkouts || []).map((workout) => [workout.id || `${workout.name}:${workout.start}`, workout])
  );

  for (const workout of incomingWorkouts || []) {
    const key = workout.id || `${workout.name}:${workout.start}`;
    workoutMap.set(key, workout);
  }

  return Array.from(workoutMap.values())
    .sort((a, b) => new Date(b.start || 0) - new Date(a.start || 0))
    .slice(0, 200);
}

export async function loadStoredData() {
  const store = getHealthStore();
  const stored = await store.get(METRICS_KEY, { type: 'json' });

  return stored || {
    lastUpdated: null,
    metrics: {},
    workouts: [],
    syncCount: 0
  };
}

export async function saveIncomingPayload(body, headers = {}) {
  const store = getHealthStore();
  const stored = await loadStoredData();
  const { metrics, workouts } = extractPayload(body);
  const receivedAt = new Date().toISOString();

  const updated = {
    lastUpdated: receivedAt,
    metrics: mergeMetrics(stored.metrics || {}, metrics),
    workouts: mergeWorkouts(stored.workouts || [], workouts),
    syncCount: (stored.syncCount || 0) + 1
  };

  await store.setJSON(METRICS_KEY, updated);

  const syncLog = (await store.get(SYNC_LOG_KEY, { type: 'json' })) || [];
  syncLog.unshift({
    receivedAt,
    sessionId: headers['session-id'] || headers['Session-Id'] || null,
    automationName: headers['automation-name'] || headers['Automation-Name'] || null,
    automationPeriod: headers['automation-period'] || headers['Automation-Period'] || null,
    metricCount: metrics.length,
    workoutCount: workouts.length,
    pointCount: metrics.reduce((sum, metric) => sum + (metric.data?.length || 0), 0)
  });

  await store.setJSON(SYNC_LOG_KEY, syncLog.slice(0, MAX_SYNC_LOG));

  return {
    receivedAt,
    metricCount: metrics.length,
    workoutCount: workouts.length,
    pointCount: metrics.reduce((sum, metric) => sum + (metric.data?.length || 0), 0),
    totalMetrics: Object.keys(updated.metrics).length
  };
}

export function buildSummary(stored) {
  const metrics = stored.metrics || {};
  const latestPoint = (name) => {
    const series = metrics[name]?.data || [];
    return series.length ? series[series.length - 1] : null;
  };

  const steps = latestPoint('step_count');
  const sleep = latestPoint('sleep_analysis');
  const restingHr = latestPoint('resting_heart_rate');
  const hrv = latestPoint('heart_rate_variability') || latestPoint('hrv');
  const activeEnergy = latestPoint('active_energy');

  return {
    steps: steps ? { value: steps.qty ?? steps.Avg ?? steps.avg, date: steps.date } : null,
    sleep: sleep
      ? {
          totalSleep: sleep.totalSleep ?? sleep.qty,
          deep: sleep.deep,
          rem: sleep.rem,
          core: sleep.core,
          date: sleep.date
        }
      : null,
    restingHeartRate: restingHr
      ? { value: restingHr.qty ?? restingHr.Avg ?? restingHr.avg, date: restingHr.date }
      : null,
    hrv: hrv ? { value: hrv.qty ?? hrv.Avg ?? hrv.avg, date: hrv.date } : null,
    activeEnergy: activeEnergy
      ? { value: activeEnergy.qty ?? activeEnergy.Avg ?? activeEnergy.avg, date: activeEnergy.date }
      : null
  };
}

export async function loadSyncLog() {
  const store = getHealthStore();
  return (await store.get(SYNC_LOG_KEY, { type: 'json' })) || [];
}

export async function getAppleHealthContext() {
  const stored = await loadStoredData();
  if (!stored.metrics || Object.keys(stored.metrics).length === 0) {
    return null;
  }

  return {
    lastUpdated: stored.lastUpdated,
    metrics: stored.metrics,
    workouts: (stored.workouts || []).slice(0, 20),
    summary: buildSummary(stored)
  };
}
