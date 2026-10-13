import {
  deleteMyService,
  getMyService,
  getProvider,
  getProviders,
  saveMyService,
  updateMyService,
} from '../../../api'
import type { Provider as ApiProvider } from '../../../api'

export async function fetchProviders(params: { search?: string; city?: string; category?: string; area?: string }) {
  return getProviders(params)
}

export async function fetchProviderById(id: string) {
  return getProvider(id)
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
