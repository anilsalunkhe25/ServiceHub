import axios from 'axios'

export type User = {
    id: string;
    name: string;
    email: string;
    role: 'customer' | 'provider' | 'admin';
    city?: string
}

export type Provider = {
    _id?: string;
    businessName: string;
    category: string;
    city: string;
    address?: string;
    rating: number;
    totalReviews: number;
    pricing?: string;
    isVerified?: boolean;
    description?: string
}

export type Booking = {
    _id: string;
    providerId?: string;
    customerId?: string;
    service: string;
    date: string;
    time: string;
    address: string;
    description?: string;
    amount?: number;
    bookingStatus: 'pending' | 'accepted' | 'rejected' | 'on_the_way' | 'in_progress' | 'completed';
    review?: {
        rating: number;
        comment: string
    }
}

export const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
})

export function setAuthToken(token: string | null) {
    if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
    else delete api.defaults.headers.common.Authorization
}

export async function login(email: string, password: string) {
    const response = await api.post<{ data: { user: User; token: string } }>('/auth/login', { email, password });
    return response.data.data
}

export async function register(payload: {
    name: string;
    email: string;
    phone: string;
    password: string;
    city: string;
    role: string
}) {
    const response = await api.post<{ data: { user: User; token: string } }>('/auth/register', payload);
    return response.data.data
}

export async function getProviders(params: { search?: string; city?: string; category?: string }) {
    const response = await api.get<{ data: Provider[] }>('/providers', { params });
    return response.data.data
}

export async function getProvider(id: string) {
    const response = await api.get<{ data: Provider }>(`/providers/${id}`);
    return response.data.data
}

export async function getMyService() {
    const response = await api.get<{ data: Provider | null }>('/providers/me');
    return response.data.data
}

export async function saveMyService(payload: {
    businessName: string;
    category: string;
    description: string;
    city: string;
    address: string;
    pricing: string
}) {
    const response = await api.post<{ data: Provider }>('/providers/me', payload);
    return response.data.data
}

export async function updateMyService(payload: {
    businessName: string;
    category: string;
    description: string;
    city: string;
    address: string;
    pricing: string;
    experience?: number
}) {
    const response = await api.put<{ data: Provider }>('/providers/me', payload);
    return response.data.data
}

export async function deleteMyService() {
    const response = await api.delete<{ data: Provider }>('/providers/me');
    return response.data.data
}

export async function getCustomerDetails(bookingId: string) {
    const response = await api.get<{
        data: {
            name: string;
            email: string;
            phone?: string;
            city?: string
        }
    }>(`/bookings/${bookingId}/customer`);
    return response.data.data
}

export async function createBooking(payload: {
    providerId: string;
    service: string;
    date: string;
    time: string;
    address: string;
    description: string;
    amount: number
}) {
    const response = await api.post('/bookings', payload);
    return response.data
}

export async function getMyBookings() {
    const response = await api.get<{ data: Booking[] }>('/bookings/my');
    return response.data.data
}

export async function getProviderBookings() {
    const response = await api.get<{ data: Booking[] }>('/bookings/provider');
    return response.data.data
}

export async function updateBookingStatus(id: string, currentStatus: Booking['bookingStatus'], status: Booking['bookingStatus'], providerId?: string) {
    const response = await api.put<{ data: Booking }>(`/bookings/${id}/status`, { currentStatus, status, providerId });
    return response.data.data
}

export async function submitReview(bookingId: string, rating: number, comment: string) {
    const response = await api.post<{ data: Booking }>(`/bookings/${bookingId}/review`, { rating, comment });
    return response.data.data
}
