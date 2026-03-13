export type LogEntry = {
  timestamp: string;
  worker: 'jobWorker' | 'postPublisher' | 'staleLockRecovery';
  message: string;
  level: 'info' | 'warn' | 'error';
};

const MAX_ENTRIES = 100;
const entries: LogEntry[] = [];

export function log(
  worker: LogEntry['worker'],
  message: string,
  level: LogEntry['level'] = 'info',
): void {
  entries.push({
    timestamp: new Date().toISOString(),
    worker,
    message,
    level,
  });
  if (entries.length > MAX_ENTRIES) {
    entries.splice(0, entries.length - MAX_ENTRIES);
  }
}

export function getEntries(): LogEntry[] {
  return [...entries].reverse();
}
