import { type NextRequest, NextResponse } from "next/server"

// 국립중앙도서관 서지 API 엔드포인트
const SEOJI_API_URL = "https://www.nl.go.kr/seoji/SearchApi.do"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const isbn = searchParams.get("isbn")

    if (!isbn) {
      return NextResponse.json({ error: "ISBN 파라미터가 필요합니다." }, { status: 400 })
    }

    // 인증키 확인
    const certKey = process.env.API_KEY

    if (!certKey) {
      return NextResponse.json({ error: "API 인증 정보가 설정되지 않았습니다." }, { status: 500 })
    }

    // 국립중앙도서관 서지 API 호출
    const apiUrl = `${SEOJI_API_URL}?cert_key=${certKey}&result_style=json&page_no=1&page_size=1&isbn=${encodeURIComponent(isbn)}`
    const response = await fetch(apiUrl)

    if (!response.ok) {
      throw new Error(`API 응답 오류: ${response.status}`)
    }

    const data = await response.json()

    // 응답 데이터 가공하여 기존 형식과 유사하게 변환
    const transformedData = transformApiResponse(data, isbn)

    // 응답 데이터 확인 및 반환
    return NextResponse.json(transformedData)
  } catch (error) {
    console.error("API 오류:", error)
    return NextResponse.json(
      { error: `서버 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 },
    )
  }
}

// API 응답 데이터를 기존 형식과 유사하게 변환하는 함수
function transformApiResponse(data: any, searchedIsbn: string) {
  // 검색 결과가 없는 경우
  if (!data.docs || data.docs.length === 0 || data.TOTAL_COUNT === "0") {
    return { items: [] }
  }

  const book = data.docs[0]

  // 작가 정보에서 "저자 : " 부분 제거
  const authorRaw = book.AUTHOR || ""
  const author = authorRaw.replace(/^저자\s*:\s*/, "").trim()

  // 기존 형식과 유사하게 변환된 아이템
  const transformedItem = {
    title: book.TITLE || "",
    link: "", // 링크 정보가 없음
    image: "", // 이미지 정보가 없음
    author: author,
    discount: book.PRE_PRICE || "", // 가격 정보
    publisher: book.PUBLISHER || "",
    isbn: book.EA_ISBN || searchedIsbn,
    description: book.BOOK_INTRODUCTION || "",
    pubdate: book.PUBLISH_PREDATE || book.INPUT_DATE || "",
  }

  return {
    items: [transformedItem],
  }
}
