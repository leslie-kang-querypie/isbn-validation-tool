import { type NextRequest, NextResponse } from "next/server"

// 이 API는 예시입니다. 실제 검증 로직으로 대체하세요.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { value } = body

    if (!value) {
      return NextResponse.json({ isValid: false, message: "값이 제공되지 않았습니다." }, { status: 400 })
    }

    // 여기에 실제 검증 로직을 구현하세요
    // 예: API 호출, 데이터베이스 조회 등

    // 예시 검증 로직 (짝수인지 확인)
    const isNumeric = !isNaN(Number.parseFloat(value)) && isFinite(Number(value))
    const isValid = isNumeric && Number(value) % 2 === 0

    return NextResponse.json({
      isValid,
      message: isValid ? "유효한 값입니다." : "유효하지 않은 값입니다.",
      details: {
        value,
        isNumeric,
        reason: isNumeric ? (isValid ? "짝수입니다." : "홀수입니다.") : "숫자가 아닙니다.",
      },
    })
  } catch (error) {
    console.error("검증 API 오류:", error)
    return NextResponse.json({ isValid: false, message: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}
