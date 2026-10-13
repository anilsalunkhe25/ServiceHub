export const categories = [
  {
    name: 'Home repair',
    description: 'Plumbing, electrical & more',
    icon: '🔧',
    services: ['Plumbing', 'Electrical repairs', 'Appliance repair', 'Carpentry', 'Painting', 'Handyman'],
  },
  {
    name: 'Cleaning',
    description: 'A fresher space, faster',
    icon: '🧼',
    services: ['Home cleaning', 'Deep cleaning', 'Kitchen cleaning', 'Bathroom cleaning', 'Sofa & carpet cleaning'],
  },
  {
    name: 'Auto care',
    description: 'Mechanics you can trust',
    icon: '🚗',
    services: ['Bike repair', 'Car repair', 'Vehicle servicing', 'Oil change', 'Tyre repair', 'Car wash'],
  },
  { name: 'Wellness', description: 'Care for your whole self', icon: '✦', services: [] },
  { name: 'Tutoring', description: 'Learn from local experts', icon: '◌', services: [] },
  { name: 'Moving', description: 'Make the next chapter easy', icon: '↗', services: [] },
  { name: 'Photographer', description: 'Capture the moments', icon: '◉', services: [] },
  { name: 'Saloon', description: 'Look and feel your best', icon: '✂', services: [] },
  { name: 'Grocery', description: 'Everyday essentials nearby', icon: '▦', services: [] },
] as const

const categoryAliases: Record<string, string> = {
  electrician: 'Home repair',
  'electrical services': 'Home repair',
  'home service': 'Home repair',
  'home services': 'Home repair',
  'cleaning service': 'Cleaning',
  'cleaning services': 'Cleaning',
  'auto care services': 'Auto care',
  autocare: 'Auto care',
}

export function canonicalCategory(value: string) {
  const normalized = value.trim().toLocaleLowerCase()
  return categoryAliases[normalized] || categories.find((category) => category.name.toLocaleLowerCase() === normalized)?.name || value.trim()
}

export function providerMatchesCategory(providerCategory: string, category: string) {
  return canonicalCategory(providerCategory).toLocaleLowerCase() === canonicalCategory(category).toLocaleLowerCase()
}
