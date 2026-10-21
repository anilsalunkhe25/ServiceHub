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
    experience?: number;
    completedJobs?: number;
    responseRate?: number | null;
    pricing?: string;
    packages?: ServicePackage[];
    isVerified?: boolean;
    isFallback?: boolean;
    description?: string;
    skills?: string[];
    serviceAreas?: string[];
    workingHours?: { days: string[]; start: string; end: string };
    pricingDetails?: string;
    profileImage?: string;
    portfolioImages?: string[];
    isAvailable?: boolean
}

export type ServicePackage = {
    id: string;
    name: string;
    features: string[];
    pricePaise: number
}

export type ProviderServicePayload = {
    businessName: string;
    category: string;
    description: string;
    city: string;
    address: string;
    pricing: string;
    experience?: number;
    packages?: ServicePackage[];
    skills?: string[];
    serviceAreas?: string[];
    workingHours?: { days: string[]; start: string; end: string };
    pricingDetails?: string;
    profileImage?: string;
    portfolioImages?: string[];
    isAvailable?: boolean
}

export type PaymentMethod = 'cash_on_delivery' | 'upi' | 'online'

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
    servicePackageId?: string;
    servicePackageName?: string;
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

export type PaymentStatus = 'pending' | 'created' | 'paid' | 'failed' | 'refunded'

export type PaymentTransaction = {
    _id: string;
    customerId: string;
    bookingId?: string;
    providerId: string;
    bookingDetails: { service: string; providerBusinessName: string; packageId?: string; packageName?: string; date: string; time: string; address: string; description: string; urgent: boolean };
    amountPaise: number;
    taxPaise: number;
    feePaise: number;
    currency: string;
    gateway: 'razorpay';
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    paymentMethod?: string;
    status: PaymentStatus;
    attempts: { orderId: string; paymentId?: string; status: string; method?: string; createdAt: string }[];
    refunds: { requestId: string; razorpayRefundId?: string; amountPaise: number; reason: string; status: string; createdAt: string; updatedAt: string }[];
    createdAt: string;
    updatedAt: string
}

export type PaymentCheckout = {
    payment: PaymentTransaction;
    checkout: { keyId: string; orderId: string; amount: number; currency: string };
    summary: { service: string; provider: string; packageName?: string; basePricePaise: number; taxPaise: number; feePaise: number; totalPaise: number }
}

export type PaymentBookingDraft = {
    providerId: string;
    packageId?: string;
    date: string;
    time: string;
    address: string;
    description: string;
    urgent?: boolean
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

api.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
            setAuthToken(null)
            localStorage.removeItem('servicehub_token')
            localStorage.removeItem('servicehub_user')
            window.dispatchEvent(new Event('servicehub:session-expired'))
        }
        return Promise.reject(error)
    },
)

export function setAuthToken(token: string | null) {
    if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
    else delete api.defaults.headers.common.Authorization
}

export async function login(email: string, password: string) {
    const response = await api.post<{ data: { user: User; token: string } }>('/auth/login', { email, password });
    return response.data.data
}

export type ChatbotHistoryMessage = {
    role: 'user' | 'assistant';
    content: string
}

export async function sendChatbotMessage(message: string, history: ChatbotHistoryMessage[]) {
    const response = await api.post<{ success: true; reply: string; privateData: boolean }>('/chatbot/message', { message, history })
    return response.data
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

export async function getProviders(params: { search?: string; city?: string; category?: string; area?: string }) {
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
    date: string;
    time: string;
    address: string;
    description: string;
    amount: number;
    paymentMethod: PaymentMethod;
    packageId?: string;
    urgent?: boolean
}) {
    const response = await api.post('/bookings', payload);
    return response.data
}

export async function createPaymentOrder(booking: PaymentBookingDraft, idempotencyKey: string) {
    const response = await api.post<{ data: PaymentCheckout }>('/payments/create-order', { booking }, { headers: { 'Idempotency-Key': idempotencyKey } });
    return response.data.data
}

export async function verifyPayment(paymentId: string, gatewayPayment: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string
}) {
    const response = await api.post<{ data: { payment: PaymentTransaction; bookingId: string } }>('/payments/verify', { paymentId, ...gatewayPayment });
    return response.data.data
}

export async function getPayment(paymentId: string) {
    const response = await api.get<{ data: PaymentTransaction }>(`/payments/${paymentId}`);
    return response.data.data
}

export async function getMyPayments() {
    const response = await api.get<{ data: PaymentTransaction[] }>('/payments/my-payments');
    return response.data.data
}

export async function getAdminPayments() {
    const response = await api.get<{ data: PaymentTransaction[] }>('/payments/admin');
    return response.data.data
}

export async function retryPayment(paymentId: string) {
    const response = await api.post<{ data: PaymentCheckout }>(`/payments/${paymentId}/retry`);
    return response.data.data
}

export async function requestPaymentRefund(paymentId: string, requestId: string, reason: string, amountPaise?: number) {
    const response = await api.post<{ data: { payment: PaymentTransaction; refund: PaymentTransaction['refunds'][number] } }>(`/payments/${paymentId}/refund`, { requestId, reason, amountPaise });
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

export async function updateCashPaymentStatus(id: string, paymentStatus: 'pending' | 'paid') {
    const response = await api.put<{ data: Booking }>(`/bookings/${id}/cod-payment`, { paymentStatus });
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
