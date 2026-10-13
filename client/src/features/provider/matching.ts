import type { Provider } from '../../api'
import { providerMatchesCategory } from '../../data/serviceCategories'
import { isPastBookingTime } from './schedule'

export type MatchRequest = {
  search: string
  city: string
  area: string
  category: string
  maxBudget: number | null
  date: string
  time: string
}

export type ProviderMatch = {
  provider: Provider
  score: number
  reasons: string[]
  startingPrice: number | null
}

function normalized(value: string | undefined) {
  return (value || '').trim().toLocaleLowerCase()
}

function startingPrice(provider: Provider) {
  if (provider.packages?.length) return Math.min(...provider.packages.map((item) => item.pricePaise)) / 100
  const match = provider.pricing?.match(/\d[\d,]*(?:\.\d{1,2})?/)
  return match ? Number(match[0].replace(/,/g, '')) : null
}

function timeInMinutes(value: string) {
  const twelveHour = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (twelveHour) {
    const hour = Number(twelveHour[1]) % 12 + (twelveHour[3].toUpperCase() === 'PM' ? 12 : 0)
    return hour * 60 + Number(twelveHour[2])
  }
  const twentyFourHour = value.match(/^(\d{1,2}):(\d{2})$/)
  return twentyFourHour ? Number(twentyFourHour[1]) * 60 + Number(twentyFourHour[2]) : null
}

function availabilityScore(provider: Provider, request: MatchRequest) {
  if (provider.isAvailable === false) return { score: 0, unavailable: true, reason: '' }
  if (!request.date && !request.time) return { score: 0.7, unavailable: false, reason: '' }
  const schedule = provider.workingHours
  if (!schedule?.days?.length || !schedule.start || !schedule.end) {
    return { score: 0.35, unavailable: false, reason: 'Schedule not listed' }
  }

  if (!request.date) return { score: 0.35, unavailable: false, reason: 'Choose a date to verify availability' }
  const weekday = new Date(`${request.date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' })
  const requested = request.time ? timeInMinutes(request.time) : null
  const start = timeInMinutes(schedule.start)
  const end = timeInMinutes(schedule.end)
  if (start === null || end === null) return { score: 0.35, unavailable: false, reason: 'Schedule not listed' }
  const worksThatDay = schedule.days.some((day) => normalized(day).slice(0, 3) === normalized(weekday))
  if (!worksThatDay) return { score: 0, unavailable: true, reason: '' }
  if (requested === null) return { score: 0.8, unavailable: false, reason: 'Works on your requested date' }
  const available = requested >= start && requested < end
  return { score: available ? 1 : 0, unavailable: !available, reason: available ? 'Matches your requested time' : '' }
}

function serviceScore(provider: Provider, request: MatchRequest) {
  const searchable = normalized([provider.category, provider.businessName, provider.description, ...(provider.skills || [])].join(' '))
  const query = normalized(request.search)
  const terms = query.split(/\s+/).filter((term) => term.length > 2)
  const queryScore = !query
    ? 1
    : searchable.includes(query)
      ? 1
      : terms.length
        ? terms.filter((term) => searchable.includes(term)).length / terms.length
        : searchable.includes(query) ? 1 : 0

  if (request.category) {
    if (!providerMatchesCategory(provider.category, request.category)) return 0
    return 0.65 + queryScore * 0.35
  }

  return query ? queryScore : 0.6
}

export function matchProviders(providers: Provider[], request: MatchRequest): ProviderMatch[] {
  if (isPastBookingTime(request.date, request.time, new Date())) return []

  return providers.flatMap((provider) => {
    const availability = availabilityScore(provider, request)
    if (availability.unavailable) return []

    const price = startingPrice(provider)
    if (request.maxBudget !== null && price !== null && price > request.maxBudget) return []

    const city = normalized(request.city)
    const area = normalized(request.area)
    const providerCity = normalized(provider.city)
    const serviceAreas = (provider.serviceAreas || []).map(normalized)
    const areaMatch = area ? serviceAreas.some((serviceArea) => serviceArea.includes(area)) || providerCity === area : false
    const cityMatch = city ? providerCity === city : false
    const locationScore = areaMatch ? 1 : cityMatch ? 0.8 : city || area ? 0 : 0.5

    const matchesService = serviceScore(provider, request)
    const budgetScore = request.maxBudget === null ? 0.5 : price === null ? 0.25 : 1
    const ratingScore = provider.rating > 0 ? Math.min(provider.rating, 5) / 5 : 0.35
    const completedScore = provider.completedJobs === undefined ? 0.35 : Math.min(provider.completedJobs / 20, 1)
    const responseScore = provider.responseRate === null || provider.responseRate === undefined ? 0.35 : Math.max(0, Math.min(provider.responseRate, 100)) / 100
    const experienceScore = provider.experience === undefined ? 0.35 : Math.min(Math.max(provider.experience, 0) / 10, 1)

    const score = Math.round((
      matchesService * 25 + locationScore * 20 + availability.score * 15 + budgetScore * 15 +
      ratingScore * 10 + completedScore * 5 + responseScore * 5 + experienceScore * 5
    ))
    const reasons: string[] = []
    if (matchesService >= 0.8) reasons.push('Strong service fit')
    if (areaMatch) reasons.push('Covers your area')
    else if (cityMatch) reasons.push('In your city')
    if (availability.reason) reasons.push(availability.reason)
    if (request.maxBudget !== null && price !== null) reasons.push('Within your budget')
    if (provider.rating >= 4.5) reasons.push('Highly rated')
    if (provider.completedJobs) reasons.push(`${provider.completedJobs} completed jobs`)
    if (provider.responseRate !== null && provider.responseRate !== undefined) reasons.push(`${provider.responseRate}% response rate`)
    if (provider.experience) reasons.push(`${provider.experience}+ years experience`)

    return [{ provider, score, reasons: reasons.slice(0, 3), startingPrice: price }]
  }).sort((left, right) => right.score - left.score || right.provider.rating - left.provider.rating || (right.provider.completedJobs || 0) - (left.provider.completedJobs || 0))
}