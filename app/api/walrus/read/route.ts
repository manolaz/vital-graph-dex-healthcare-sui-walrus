import { NextRequest, NextResponse } from "next/server"

const AGGREGATOR_URL = "https://aggregator.walrus-testnet.walrus.space"

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const blobId = searchParams.get("blobId")

    if (!blobId) {
      return NextResponse.json(
        { error: "Blob ID is required" },
        { status: 400 }
      )
    }

    const walrusUrl = `${AGGREGATOR_URL}/v1/blobs/${blobId}`
    
    const response = await fetch(walrusUrl)

    if (!response.ok) {
      return NextResponse.json(
        { error: `Walrus read failed: ${response.statusText}` },
        { status: response.status }
      )
    }

    // Get the blob data
    const blob = await response.blob()
    const buffer = await blob.arrayBuffer()
    
    // Return the blob with appropriate headers
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "application/octet-stream",
        "Content-Length": response.headers.get("Content-Length") || String(buffer.byteLength),
      },
    })
  } catch (error) {
    console.error("Walrus read proxy error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

