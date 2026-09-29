import type { Provider as ApiProvider } from '../api'

export const fallbackProviders: ApiProvider[] = [
  { _id: 'fixright', isFallback: true, businessName: 'FixRight Services', category: 'Home repair', city: 'Pune', rating: 4.9, totalReviews: 128, pricing: 'From ₹499', isVerified: true, description: 'Reliable plumbing, electrical, and home repair specialists.' },
  { _id: 'urbanglow', isFallback: true, businessName: 'Urban Glow Studio', category: 'Wellness', city: 'Mumbai', rating: 4.8, totalReviews: 94, pricing: 'From ₹699', isVerified: true, description: 'A calm, local studio for everyday wellness.' },
  { _id: 'motocraft', isFallback: true, businessName: 'MotoCraft Garage', category: 'Auto care', city: 'Kolhapur', rating: 4.9, totalReviews: 76, pricing: 'From ₹299', isVerified: true, description: 'Honest diagnostics and repairs for your daily ride.' },
  { _id: 'brightwire', isFallback: true, businessName: 'BrightWire Electricians', category: 'Electrician', city: 'Pune', rating: 4.8, totalReviews: 61, pricing: 'From ₹399', isVerified: true, description: 'Quick, dependable electrical repairs and installations.' },
  { _id: 'framesandlight', isFallback: true, businessName: 'Frames & Light Photography', category: 'Photographer', city: 'Mumbai', rating: 4.9, totalReviews: 47, pricing: 'From ₹1,999', isVerified: true, description: 'Thoughtful photography for celebrations and milestones.' },
  { _id: 'trimandtone', isFallback: true, businessName: 'Trim & Tone Saloon', category: 'Saloon', city: 'Bengaluru', rating: 4.7, totalReviews: 83, pricing: 'From ₹299', isVerified: true, description: 'Everyday cuts, styling, and grooming from local experts.' },
  { _id: 'dailybasket', isFallback: true, businessName: 'Daily Basket Grocery', category: 'Grocery', city: 'Hyderabad', rating: 4.8, totalReviews: 112, pricing: 'From ₹99', isVerified: true, description: 'Fresh essentials and pantry staples delivered locally.' },
  { _id: 'powerpoint', isFallback: true, businessName: 'PowerPoint Electrical Services', category: 'Electrical services', city: 'Kolhapur', rating: 4.8, totalReviews: 58, pricing: 'From ₹449', isVerified: true, description: 'Professional wiring, appliance, and power solutions.' },
]

export const categories = [
  ['Home repair', 'Plumbing, electrical & more', '🔧'],
  ['Cleaning', 'A fresher space, faster', '🧼'],
  ['Auto care', 'Mechanics you can trust', '🚗'],
  ['Wellness', 'Care for your whole self', '✦'],
  ['Tutoring', 'Learn from local experts', '◌'],
  ['Moving', 'Make the next chapter easy', '↗'],
  ['Electrician', 'Power problems, sorted', '⚡'],
  ['Photographer', 'Capture the moments', '◉'],
  ['Saloon', 'Look and feel your best', '✂'],
  ['Grocery', 'Everyday essentials nearby', '▦'],
  ['Electrical services', 'Wiring and installations', '⌁'],
] as const
