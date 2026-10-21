import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { AuthPage } from './features/auth'
import { DashboardPage } from './features/dashboard'
import { HomePage } from './views/HomePage'
import { ProfilePage } from './features/provider'
import { ServicesPage } from './views/ServicesPage'
import { PaymentStatusPage } from './views/PaymentStatusPage'
import { MyPaymentsPage } from './views/MyPaymentsPage'
import { AdminPaymentsPage } from './views/AdminPaymentsPage'
import { ChatbotWidget } from './components/ChatbotWidget'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/providers/:id" element={<ProfilePage />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/payment/status/:paymentId" element={<PaymentStatusPage />} />
          <Route path="/payments" element={<MyPaymentsPage />} />
          <Route path="/admin/payments" element={<AdminPaymentsPage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
        <ChatbotWidget />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
