import Razorpay from 'razorpay'

export function getRazorpayCredentials() {
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !keySecret) throw new Error('Razorpay is not configured')
  return { keyId, keySecret }
}

export function getRazorpayClient() {
  const { keyId, keySecret } = getRazorpayCredentials()
  return new Razorpay({ key_id: keyId, key_secret: keySecret })
}