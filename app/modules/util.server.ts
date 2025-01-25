export function formatDate(date: Date): string {
    const isoString = date.toISOString();
    const yyyyMMDD = isoString.split('T')[0];
    const hhmm = isoString.split('T')[1].slice(0, 5);
    return `${yyyyMMDD} ${hhmm}`;
}
