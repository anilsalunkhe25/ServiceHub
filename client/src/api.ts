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
    isFallback?: boolean;
    description?: string;
    skills?: string[];
    serviceAreas?: string[];
    workingHours?: { days: string[]; start: string; end: string };
    pricingDetails?: string;
    portfolioImages?: string[];
    isAvailable?: boolean
}

export type ProviderServicePayload = {
    businessName: string;
    category: string;
    description: string;
    city: string;
    address: string;
    pricing: string;
    skills?: string[];
    serviceAreas?: string[];
    workingHours?: { days: string[]; start: string; end: string };
    pricingDetails?: string;
    portfolioImages?: string[];
    isAvailable?: boolean
}

export type PaymentMethod = 'cash_on_delivery' | 'upi'

export type ProviderWithdrawal = {
    _id: string;
    amount: number;
    payoutUpiId: string;
    status: 'pending' | 'approved' | 'paid' | 'rejected';
    createdAt: string
}

export type ProviderWithdrawalSummary = {
    availableAmount: number;
    withdrawals: ProviderWithdrawal[]
}

export type Booking = {
    _id: string;
    providerId?: string;
    providerBusinessName?: string;
    customerId?: string;
    service: string;
    date: string;
    time: string;
    address: string;
    description?: string;
    amount?: number;
    paymentMethod?: PaymentMethod;
    urgent?: boolean;
    bookingStatus: 'pending' | 'accepted' | 'rejected' | 'on_the_way' | 'in_progress' | 'completed' | 'cancelled';
    paymentStatus?: string;
    messages?: { senderId: string; senderRole: string; message: string; createdAt: string }[];
    complaint?: { message: string; providerBusinessName?: string; status: string; createdAt: string };
    review?: {
        rating: number;
        comment: string
    }
}

export const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
})

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('servicehub_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
    else delete config.headers.Authorization
    return config
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

export async function saveMyService(payload: ProviderServicePayload) {
    const response = await api.post<{ data: Provider }>('/providers/me', payload);
    return response.data.data
}

export async function updateMyService(payload: ProviderServicePayload) {
    const response = await api.put<{ data: Provider }>('/providers/me', payload);
    return response.data.data
}

export async function deleteMyService() {
    const response = await api.delete<{ data: Provider }>('/providers/me');
    return response.data.data
}

export async function getProviderWithdrawals() {
    const response = await api.get<{ data: ProviderWithdrawalSummary }>('/providers/withdrawals');
    return response.data.data
}

export async function requestProviderWithdrawal(amount: number, payoutUpiId: string) {
    const response = await api.post<{ data: { availableAmount: number; withdrawal: ProviderWithdrawal } }>('/providers/withdrawals', { amount, payoutUpiId });
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
    amount: number;
    paymentMethod: PaymentMethod;
    urgent?: boolean
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

export async function updateCustomerBooking(bookingId: string, action: 'cancel' | 'reschedule', date?: string, time?: string) {
    const response = await api.put<{ data: Booking }>(`/bookings/${bookingId}/customer-action`, { action, date, time });
    return response.data.data
}

export async function recordDemoPayment(bookingId: string) {
    const response = await api.post<{ data: Booking }>(`/bookings/${bookingId}/payment`);
    return response.data.data
}

export async function sendBookingMessage(bookingId: string, message: string) {
    const response = await api.post<{ data: Booking }>(`/bookings/${bookingId}/messages`, { message });
    return response.data.data
}

export async function getBookingMessages(bookingId: string) {
    const response = await api.get<{ data: NonNullable<Booking['messages']> }>(`/bookings/${bookingId}/messages`);
    return response.data.data
}

export async function submitBookingComplaint(bookingId: string, message: string) {
    const response = await api.post<{ data: Booking }>(`/bookings/${bookingId}/complaint`, { message });
    return response.data.data
}
