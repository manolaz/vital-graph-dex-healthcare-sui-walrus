import { NextRequest, NextResponse } from "next/server"

const PUBLISHER_URL = "https://publisher.walrus-testnet.walrus.space"

export async function PUT(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const epochs = searchParams.get("epochs") || "5"
    
    // Forward the request body directly to Walrus with streaming
    const walrusUrl = `${PUBLISHER_URL}/v1/store?epochs=${epochs}`

    // @ts-ignore - duplex is needed for streaming uploads in node fetch but not in standard RequestInit types yet
    const response = await fetch(walrusUrl, {
      method: "PUT",
      body: req.body,
      duplex: 'half', 
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Walrus storage failed: ${response.statusText}` }, 
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Walrus proxy error:", error)
    return NextResponse.json(
      { error: "Internal server error" }, 
      { status: 500 }
    )
  }
}

