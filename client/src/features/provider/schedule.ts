export const bookingTimes = ['09:00 AM', '12:00 PM', '03:00 PM', '06:00 PM']

export function getLocalDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isPastBookingTime(date: string, time: string, now: Date) {
  if (!date || !time) return false

  const today = getLocalDate(now)
  if (date < today) return true
  if (date > today) return false

  const match = time.match(/^(\d{2}):(\d{2}) (AM|PM)$/)
  if (!match) return false

  const [, hourText, minuteText, meridiem] = match
  let hour = Number(hourText) % 12
  if (meridiem === 'PM') hour += 12
  const scheduledMinutes = hour * 60 + Number(minuteText)
  return scheduledMinutes <= now.getHours() * 60 + now.getMinutes()
}
