import { type NextRequest, NextResponse } from "next/server"

// 네이버 Open API 엔드포인트
const NAVER_API_URL = "https://openapi.naver.com/v1/search/book.json"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const isbn = searchParams.get("isbn")

    if (!isbn) {
      return NextResponse.json({ error: "ISBN 파라미터가 필요합니다." }, { status: 400 })
    }

    // 네이버 API 인증 정보 확인
    const clientId = process.env.NAVER_CLIENT_ID
    const clientSecret = process.env.NAVER_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: "네이버 API 인증 정보가 설정되지 않았습니다." }, { status: 500 })
    }

    // 네이버 Open API 호출
    const response = await fetch(`${NAVER_API_URL}?query=${encodeURIComponent(isbn)}&display=1`, {
      headers: {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret,
      },
    })

    if (!response.ok) {
      throw new Error(`네이버 API 응답 오류: ${response.status}`)
    }

    const data = await response.json()

    // 응답 데이터 확인 및 반환
    return NextResponse.json(data)
  } catch (error) {
    console.error("API 오류:", error)
    return NextResponse.json(
      { error: `서버 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 },
    )
  }
}
