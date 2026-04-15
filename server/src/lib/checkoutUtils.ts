function parseCheckoutHour(checkOutTime?: string): number {
  if (!checkOutTime) return 12;
  const [h] = checkOutTime.split(':').map(Number);
  return Number.isFinite(h) ? h : 12;
}

export function getCheckoutBoundary(checkOutTime?: string): Date {
  const cutoffHour = parseCheckoutHour(checkOutTime);
  const now = new Date();
  const cutoffToday = new Date();
  cutoffToday.setHours(cutoffHour, 0, 0, 0);

  const boundary = new Date();
  boundary.setHours(0, 0, 0, 0);

  if (now >= cutoffToday) {
    boundary.setDate(boundary.getDate() + 1);
  }

  return boundary;
}

export function isSessionActive(checkOutDate: Date, checkOutTime?: string): boolean {
  const cutoffHour = parseCheckoutHour(checkOutTime);
  const cutoff = new Date(checkOutDate);
  cutoff.setHours(cutoffHour, 0, 0, 0);
  return new Date() < cutoff;
}
