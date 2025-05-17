export const API_URL = "/api/search"

export interface SearchResponse {
  items: Array<{
    title: string
    isbn: string
    discount: string
    author: string
    publisher: string
    pubdate: string
    link: string
    image: string
    description: string
  }>
  error?: string
}

export const searchBook = async (isbn: string): Promise<SearchResponse> => {
  const response = await fetch(`${API_URL}?isbn=${encodeURIComponent(isbn)}`)

  if (!response.ok) {
    throw new Error(`API 응답 오류: ${response.status}`)
  }

  const data = await response.json()

  if (data.error) {
    throw new Error(data.error)
  }

  return data
}
