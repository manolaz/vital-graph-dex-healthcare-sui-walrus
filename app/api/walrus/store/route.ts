import { NextRequest, NextResponse } from "next/server"

const PUBLISHER_URL = "https://publisher.walrus-testnet.walrus.space"

export async function PUT(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const epochs = searchParams.get("epochs") || "5"
    
    // Forward the request body directly to Walrus
    const body = await req.blob()
    
    const walrusUrl = `${PUBLISHER_URL}/v1/store?epochs=${epochs}`
    
    const response = await fetch(walrusUrl, {
      method: "PUT",
      body: body,
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

