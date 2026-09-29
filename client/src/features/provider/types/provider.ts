import type { Provider as ApiProvider } from '../../../api'

export type ProviderListItem = ApiProvider

export type ProviderFormState = {
  businessName: string
  category: string
  description: string
  city: string
  address: string
  pricing: string
}
