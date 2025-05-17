import { useState } from "react"
import Papa from "papaparse"
import { cleanISBN, compareAuthors } from "../lib/utils/isbn"
import { cleanPrice } from "../lib/utils/price"
import { searchBook } from "../lib/api/search"
import type { ColumnMapping, ValidationResult } from "./types"

export const useCsvValidator = () => {
  const [file, setFile] = useState<File | null>(null)
  const [csvData, setCsvData] = useState<any[]>([])
  const [results, setResults] = useState<ValidationResult[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [progress, setProgress] = useState<number>(0)
  const [error, setError] = useState<string>("")
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    title: "",
    isbn: "",
    price: "",
    author: "",
  })
  const [availableColumns, setAvailableColumns] = useState<string[]>([])
  const [mappingComplete, setMappingComplete] = useState<boolean>(false)

  // 인코딩 감지 함수
  const detectEncoding = async (file: File): Promise<string> => {
    return new Promise(resolve => {
      const reader = new FileReader()
      reader.onload = e => {
        const buffer = e.target?.result as ArrayBuffer
        const bytes = new Uint8Array(buffer)

        // UTF-8 BOM 체크
        if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
          resolve("utf-8-sig")
          return
        }

        // 한글 바이트 패턴 체크
        let hasKorean = false
        for (let i = 0; i < bytes.length - 1; i++) {
          if (bytes[i] >= 0xa1 && bytes[i] <= 0xfe && bytes[i + 1] >= 0xa1 && bytes[i + 1] <= 0xfe) {
            hasKorean = true
            break
          }
        }

        if (hasKorean) {
          resolve("ms949")
        } else {
          resolve("utf-8")
        }
      }
      reader.readAsArrayBuffer(file.slice(0, 4096))
    })
  }

  // CSV 파싱 함수
  const parseCSV = async (file: File) => {
    try {
      const encodings = ["utf-8", "cp949", "euc-kr"]
      let parsedData: any[] = []
      let successfulEncoding = ""

      for (const encoding of encodings) {
        try {
          const content = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = e => resolve(e.target?.result as string)
            reader.onerror = reject
            reader.readAsText(file, encoding)
          })

          const hasBrokenKorean = /[\uFFFD\uFFFE\uFFFF]/.test(content) || /[^\u0000-\uFFFF]/.test(content)
          if (hasBrokenKorean) continue

          const result = await new Promise<any>((resolve, reject) => {
            Papa.parse(content, {
              header: true,
              skipEmptyLines: true,
              dynamicTyping: false,
              delimiter: ",",
              complete: results => {
                if (results.errors && results.errors.length > 0) {
                  reject(new Error(results.errors[0].message))
                } else {
                  resolve(results)
                }
              },
              error: (error: Error) => reject(error),
            })
          })

          if (result.data && result.data.length > 0) {
            const columns = Object.keys(result.data[0])
            const hasValidColumns = columns.some(
              col => col.includes("제목") || col.includes("ISBN") || col.includes("가격") || col.includes("저자"),
            )

            if (hasValidColumns) {
              parsedData = result.data
              successfulEncoding = encoding
              break
            }
          }
        } catch (error) {
          continue
        }
      }

      if (parsedData.length === 0) {
        throw new Error("모든 인코딩에서 파싱 실패. 파일 형식이나 인코딩을 확인해주세요.")
      }

      const firstRow = parsedData[0]
      const columns = Object.keys(firstRow)
      setAvailableColumns(columns)

      // 자동 매핑
      const mapping: ColumnMapping = {
        title:
          columns.find(col => col.includes("제목") || col.includes("타이틀") || col.toLowerCase().includes("title")) || "",
        isbn: columns.find(col => col.includes("ISBN") || col.includes("isbn")) || "",
        price:
          columns.find(col => col.includes("가격") || col.includes("재정가") || col.toLowerCase().includes("price")) || "",
        author:
          columns.find(col => col.includes("저자") || col.includes("작가") || col.toLowerCase().includes("author")) || "",
      }

      setColumnMapping(mapping)
      setCsvData(parsedData)
      setMappingComplete(false)
    } catch (error) {
      throw error
    }
  }

  // 데이터 검증 함수
  const validateData = async () => {
    if (csvData.length === 0) {
      setError("검증할 데이터가 없습니다.")
      return
    }

    setLoading(true)
    setProgress(0)
    setResults([])
    setError("")

    try {
      const totalItems = csvData.length
      let processedResults: ValidationResult[] = []

      for (let i = 0; i < csvData.length; i++) {
        const item = csvData[i]
        const originalISBN = item[columnMapping.isbn]
        const isbn = cleanISBN(originalISBN)

        if (!isbn) {
          processedResults.push({
            original: item,
            isValid: false,
            error: "ISBN 값이 비어있습니다.",
          })
          setResults([...processedResults])
          continue
        }

        try {
          const data = await searchBook(isbn)

          if (!data.items || data.items.length === 0) {
            processedResults.push({
              original: item,
              isValid: false,
              apiResponse: data,
              notFound: true,
              error: "API에서 결과를 찾을 수 없습니다.",
            })
            setResults([...processedResults])
            continue
          }

          const apiItem = data.items[0]

          const titleMatch =
            apiItem.title.includes(item[columnMapping.title]) || item[columnMapping.title].includes(apiItem.title)
          const apiISBN = cleanISBN(apiItem.isbn)
          const isbnMatch = apiISBN === isbn

          const apiPrice = apiItem.discount || "0"
          const csvPrice = item[columnMapping.price] || "0"
          const priceMatch = cleanPrice(apiPrice) === cleanPrice(csvPrice)

          const apiAuthor = apiItem.author || ""
          const csvAuthor = item[columnMapping.author] || ""
          const authorMatch = compareAuthors(apiAuthor, csvAuthor)

          const isValid = isbnMatch && priceMatch && authorMatch

          processedResults.push({
            original: item,
            isValid,
            apiResponse: apiItem,
            matchDetails: {
              title: titleMatch,
              isbn: isbnMatch,
              discount: priceMatch,
              author: authorMatch,
            },
          })
          setResults([...processedResults])
        } catch (error) {
          processedResults.push({
            original: item,
            isValid: false,
            error: `API 호출 오류: ${error instanceof Error ? error.message : String(error)}`,
          })
          setResults([...processedResults])
        }

        setProgress(Math.round(((i + 1) / totalItems) * 100))
      }
    } catch (error) {
      setError(`검증 중 오류 발생: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setLoading(false)
      setProgress(100)
    }
  }

  return {
    file,
    setFile,
    csvData,
    results,
    loading,
    progress,
    error,
    setError,
    columnMapping,
    setColumnMapping,
    availableColumns,
    mappingComplete,
    setMappingComplete,
    parseCSV,
    validateData,
  }
}
