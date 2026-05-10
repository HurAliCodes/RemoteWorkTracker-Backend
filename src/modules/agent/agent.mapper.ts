function truncateAction(s: string, maxLen: number): string {
  if (s.length <= maxLen) {
    return s;
  }
  return `${s.slice(0, Math.max(0, maxLen - 1))}…`;
}

/**
 * Maps Go agent activity payloads (and normalized API rows) to DB columns.
 */
export function normalizeActivityRecord(raw: unknown):
  | { deviceId: string; userId: string; action: string; description: string; timestamp: string }
  | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const r = raw as Record<string, unknown>;
  const deviceId = typeof r.deviceId === 'string' ? r.deviceId : '';
  const userId = typeof r.userId === 'string' ? r.userId : '';
  if (!deviceId || !userId) {
    return null;
  }

  const actionDirect = typeof r.action === 'string' ? r.action.trim() : '';
  const tsDirect = typeof r.timestamp === 'string' ? r.timestamp.trim() : '';
  if (actionDirect && tsDirect) {
    const description = typeof r.description === 'string' ? r.description : '';
    return {
      deviceId,
      userId,
      action: truncateAction(actionDirect, 100),
      description,
      timestamp: tsDirect,
    };
  }

  const windowTitle = typeof r.windowTitle === 'string' ? r.windowTitle : '';
  const app = typeof r.app === 'string' ? r.app : '';
  const startTime = typeof r.startTime === 'string' ? r.startTime : '';
  const endTime = typeof r.endTime === 'string' ? r.endTime : '';
  const duration = typeof r.duration === 'number' ? r.duration : undefined;
  const isIdle = typeof r.isIdle === 'boolean' ? r.isIdle : undefined;

  const primary = windowTitle || app || 'activity';
  const action = truncateAction(primary, 100);
  const description = JSON.stringify({
    app: app || undefined,
    windowTitle: windowTitle || undefined,
    startTime: startTime || undefined,
    endTime: endTime || undefined,
    duration,
    isIdle,
  });

  const timestamp = startTime || endTime || new Date().toISOString();

  return {
    deviceId,
    userId,
    action,
    description,
    timestamp,
  };
}
