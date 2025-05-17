export const cleanISBN = (isbn: string): string => {
  if (!isbn) return ""
  return isbn.replace(/[^0-9]/g, "")
}

export const compareAuthors = (author1: string, author2: string): boolean => {
  if (!author1 || !author2) return false

  const normalizeAuthor = (author: string) => {
    return author.toLowerCase().replace(/[,\s]/g, "")
  }

  const normalizedAuthor1 = normalizeAuthor(author1)
  const normalizedAuthor2 = normalizeAuthor(author2)

  return normalizedAuthor1.includes(normalizedAuthor2) || normalizedAuthor2.includes(normalizedAuthor1)
}
