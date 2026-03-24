export const APP_TIME_ZONE = 'America/Bogota'

function pad2(value: number) {
  return String(value).padStart(2, '0')
}

export function formatDateInTimeZone(date: Date, timeZone = APP_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value

  if (!year || !month || !day) {
    return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`
  }

  return `${year}-${month}-${day}`
}

export function getTodayInAppTimeZone() {
  return formatDateInTimeZone(new Date())
}
