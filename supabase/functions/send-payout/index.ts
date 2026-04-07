import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { author_name, mpesa_phone, amount } = await req.json()

    const PAYSTACK_SECRET = Deno.env.get('PAYSTACK_SECRET_KEY')
    if (!PAYSTACK_SECRET) throw new Error('Paystack secret key not configured')

    // Step 1: Create transfer recipient
    const recipientRes = await fetch('https://api.paystack.co/transferrecipient', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'mobile_money',
        name: author_name,
        account_number: mpesa_phone,
        bank_code: 'MPESA',
        currency: 'KES',
      }),
    })
    const recipientData = await recipientRes.json()
    if (!recipientData.status) {
      throw new Error('Recipient creation failed: ' + recipientData.message)
    }
    const recipientCode = recipientData.data.recipient_code

    // Step 2: Initiate transfer
    const transferRes = await fetch('https://api.paystack.co/transfer', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: 'balance',
        amount: amount * 100,
        recipient: recipientCode,
        reason: `SafeRead KE earnings – ${author_name}`,
      }),
    })
    const transferData = await transferRes.json()
    if (!transferData.status) {
      throw new Error('Transfer failed: ' + transferData.message)
    }

    return new Response(JSON.stringify({ success: true, transfer: transferData.data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})