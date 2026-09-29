import {
  deleteMyService,
  getMyService,
  getProvider,
  getProviders,
  saveMyService,
  updateMyService,
} from '../../../api'
import type { Provider as ApiProvider } from '../../../api'
import { fallbackProviders } from '../../../data/mockData'

export async function fetchProviders(params: { search?: string; city?: string; category?: string }) {
  try {
    return await getProviders(params)
  } catch {
    return fallbackProviders
  }
}

export async function fetchProviderById(id: string) {
  try {
    return await getProvider(id)
  } catch {
    return fallbackProviders.find((provider) => provider._id === id) || fallbackProviders[0]
  }
}

export async function fetchMyProviderService() {
  try {
    return await getMyService()
  } catch {
    const saved = localStorage.getItem('servicehub_my_service')
    return saved ? (JSON.parse(saved) as ApiProvider) : null
  }
}

export async function saveProviderService(form: {
  businessName: string
  category: string
  description: string
  city: string
  address: string
  pricing: string
}, isEditing: boolean) {
  const service = isEditing ? await updateMyService(form) : await saveMyService(form)
  localStorage.setItem('servicehub_my_service', JSON.stringify(service))
  return service
}

export async function removeProviderService() {
  await deleteMyService()
  localStorage.removeItem('servicehub_my_service')
}
