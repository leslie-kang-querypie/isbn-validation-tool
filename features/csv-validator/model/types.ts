export interface ColumnMapping {
  title: string
  isbn: string
  price: string
  author: string
}

export interface ValidationResult {
  original: any
  isValid: boolean
  apiResponse?: any
  error?: string
  notFound?: boolean
  matchDetails?: {
    title: boolean
    isbn: boolean
    discount: boolean
    author: boolean
  }
}

export type SortDirection = "asc" | "desc" | null
export type SortField = "title" | "isbn" | "price" | "author" | "status" | null
