import type { PaymentCheckout } from '../../../api'

export type RazorpayPaymentResult = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string
}

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill: { name: string; email: string; contact?: string };
  handler: (payment: RazorpayPaymentResult) => void;
  modal: { ondismiss: () => void }
}

type RazorpayCheckout = new (options: RazorpayOptions) => { open: () => void }

let checkoutScript: Promise<RazorpayCheckout | null> | undefined

async function getRazorpayCheckout() {
  const checkoutWindow = window as Window & { Razorpay?: RazorpayCheckout }
  if (checkoutWindow.Razorpay) return checkoutWindow.Razorpay
  if (!checkoutScript) {
    checkoutScript = new Promise((resolve) => {
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.onload = () => {
        if (!checkoutWindow.Razorpay) checkoutScript = undefined
        resolve(checkoutWindow.Razorpay || null)
      }
      script.onerror = () => {
        checkoutScript = undefined
        resolve(null)
      }
      document.body.appendChild(script)
    })
  }
  return checkoutScript
}

export async function launchRazorpayCheckout(
  checkout: PaymentCheckout['checkout'],
  customer: { name: string; email: string; phone?: string },
) {
  const Razorpay = await getRazorpayCheckout()
  if (!Razorpay) throw new Error('Unable to load Razorpay Checkout. Check your connection and try again.')

  return new Promise<RazorpayPaymentResult>((resolve, reject) => {
    const instance = new Razorpay({
      key: checkout.keyId,
      amount: checkout.amount,
      currency: checkout.currency,
      name: 'Service Hub',
      description: 'Service booking',
      order_id: checkout.orderId,
      prefill: { name: customer.name, email: customer.email, contact: customer.phone },
      handler: resolve,
      modal: { ondismiss: () => reject(new Error('checkout_cancelled')) },
    })
    instance.open()
  })
}