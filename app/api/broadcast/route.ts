import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { txhex } = await req.json()
    
    const response = await fetch('https://api.bitails.io/tx/broadcast', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ raw: txhex })
    })

    if (!response.ok) {
      const error = await response.json()
      return NextResponse.json({ error: error.message || 'Broadcast failed' }, { status: response.status })
    }

    const { txid } = await response.json()
    return NextResponse.json({ txid }, { status: 201 })
  } catch (error) {
    console.error('Broadcast error:', error)
    return NextResponse.json({ error: 'Failed to broadcast transaction' }, { status: 500 })
  }
} 