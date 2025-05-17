"use client"

import type React from "react"
import { useState, useMemo, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import {
  Upload,
  FileUp,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  Download,
  Info,
  ArrowUpDown,
  AlertTriangle,
} from "lucide-react"
import Papa from "papaparse"

// ISBN 정제 함수 추가
// 숫자만 추출하는 함수
const cleanISBN = (isbn: string): string => {
  if (!isbn) return ""
  // 숫자가 아닌 모든 문자(공백, 하이픈 등) 제거
  return isbn.replace(/[^0-9]/g, "")
}

// 작가 정보 비교 함수
const compareAuthors = (author1: string, author2: string): boolean => {
  if (!author1 || !author2) return false

  // 작가 이름에서 공백, 쉼표 등 제거하고 소문자로 변환하여 비교
  const normalizeAuthor = (author: string) => {
    return author.toLowerCase().replace(/[,\s]/g, "")
  }

  const normalizedAuthor1 = normalizeAuthor(author1)
  const normalizedAuthor2 = normalizeAuthor(author2)

  // 한 쪽이 다른 쪽을 포함하는지 확인
  return normalizedAuthor1.includes(normalizedAuthor2) || normalizedAuthor2.includes(normalizedAuthor1)
}

// 매핑 필드 타입
interface ColumnMapping {
  title: string
  isbn: string
  price: string
  author: string
}

// API URL (고정값)
const API_URL = "/api/search"

// 검증 결과 타입
interface ValidationResult {
  original: any
  isValid: boolean
  apiResponse?: any
  error?: string
  notFound?: boolean // ISBN이 존재하지 않는 경우
  matchDetails?: {
    title: boolean
    isbn: boolean
    discount: boolean
    author: boolean
  }
}

// 가격 포맷팅 함수를 수정하여 NaN 문제 해결
const formatPrice = (price: string | number) => {
  if (!price) return "0"

  // 문자열이면 숫자로 변환 시도
  const numPrice = typeof price === "string" ? Number(price.replace(/[^0-9.-]/g, "")) : Number(price)

  // NaN 체크
  if (isNaN(numPrice)) return "0"

  return numPrice.toLocaleString("ko-KR")
}

// 정렬 타입
type SortDirection = "asc" | "desc" | null
type SortField = "title" | "isbn" | "price" | "author" | "status" | null

// 인코딩 감지 함수 추가
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
        // EUC-KR/CP949 한글 패턴 (0xA1-0xFE 범위의 2바이트)
        if (bytes[i] >= 0xa1 && bytes[i] <= 0xfe && bytes[i + 1] >= 0xa1 && bytes[i + 1] <= 0xfe) {
          hasKorean = true
          break
        }
      }

      if (hasKorean) {
        // 한글이 있는 경우 MS949 계열 인코딩으로 추정
        resolve("ms949")
      } else {
        // 한글이 없는 경우 UTF-8로 추정
        resolve("utf-8")
      }
    }
    reader.readAsArrayBuffer(file.slice(0, 4096)) // 처음 4KB만 읽어서 체크
  })
}

export default function CsvValidator() {
  const [file, setFile] = useState<File | null>(null)
  const [csvData, setCsvData] = useState<any[]>([])
  const [results, setResults] = useState<ValidationResult[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [progress, setProgress] = useState<number>(0)
  const [error, setError] = useState<string>("")
  const [activeTab, setActiveTab] = useState<string>("upload")
  const [sortField, setSortField] = useState<SortField>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)
  const [selectedResult, setSelectedResult] = useState<ValidationResult | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState<boolean>(false)
  const [isClient, setIsClient] = useState(false)
  const { toast } = useToast()

  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    title: "",
    isbn: "",
    price: "",
    author: "",
  })
  const [availableColumns, setAvailableColumns] = useState<string[]>([])
  const [mappingComplete, setMappingComplete] = useState<boolean>(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError("")
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      // 파일 확장자 확인 (한글 파일명 지원)
      const fileExtension = selectedFile.name.split(".").pop()?.toLowerCase()
      if (fileExtension !== "csv") {
        setError("CSV 파일만 업로드 가능합니다.")
        return
      }
      setFile(selectedFile)
      parseCSV(selectedFile)
    }
  }

  const parseCSV = async (file: File) => {
    try {
      const encodings = ["utf-8", "cp949", "euc-kr"]
      let parsedData: any[] = []
      let successfulEncoding = ""

      for (const encoding of encodings) {
        try {
          console.log(`${encoding} 인코딩으로 파싱 시도 중...`)

          const content = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = e => resolve(e.target?.result as string)
            reader.onerror = reject
            reader.readAsText(file, encoding)
          })

          // 파일 내용 샘플 로깅
          console.log(`${encoding} 인코딩으로 읽은 내용 샘플:`, content.substring(0, 200))

          // 한글 깨짐 체크 - 수정된 로직
          const hasBrokenKorean = /[\uFFFD\uFFFE\uFFFF]/.test(content) || /[^\u0000-\uFFFF]/.test(content)
          if (hasBrokenKorean) {
            console.log(`${encoding} 인코딩으로 한글 깨짐 발생, 다음 인코딩 시도`)
            continue
          }

          // CSV 파싱 시도
          const result = await new Promise<any>((resolve, reject) => {
            Papa.parse(content, {
              header: true,
              skipEmptyLines: true,
              dynamicTyping: false,
              delimiter: ",",
              complete: results => {
                if (results.errors && results.errors.length > 0) {
                  console.log(`${encoding} 인코딩 파싱 오류:`, results.errors)
                  reject(new Error(results.errors[0].message))
                } else {
                  resolve(results)
                }
              },
              error: (error: Error) => reject(error),
            })
          })

          if (result.data && result.data.length > 0) {
            // 첫 번째 행의 데이터 구조 확인
            console.log(`${encoding} 인코딩으로 파싱된 첫 번째 행:`, result.data[0])

            // 컬럼 이름에 한글이 제대로 포함되어 있는지 확인
            const columns = Object.keys(result.data[0])
            const hasValidColumns = columns.some(
              col => col.includes("제목") || col.includes("ISBN") || col.includes("가격") || col.includes("저자"),
            )

            if (hasValidColumns) {
              parsedData = result.data
              successfulEncoding = encoding
              console.log(`성공적으로 파싱된 인코딩: ${encoding}`)
              break
            } else {
              console.log(`${encoding} 인코딩으로 파싱은 성공했으나 유효한 컬럼을 찾을 수 없음`)
              continue
            }
          }
        } catch (error) {
          console.log(`${encoding} 인코딩으로 파싱 실패:`, error)
          continue
        }
      }

      if (parsedData.length === 0) {
        throw new Error("모든 인코딩에서 파싱 실패. 파일 형식이나 인코딩을 확인해주세요.")
      }

      console.log("파싱된 데이터 행 수:", parsedData.length)
      if (parsedData.length > 0) {
        console.log("첫 번째 행 데이터:", parsedData[0])
      }

      const firstRow = parsedData[0]
      const columns = Object.keys(firstRow)
      setAvailableColumns(columns)

      // 자동 매핑 시도
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
      setActiveTab("validate")
      setMappingComplete(false)
    } catch (error) {
      console.error("파일 처리 오류:", error)
      toast({
        title: "파일 처리 오류",
        description: error instanceof Error ? error.message : "파일을 처리하는 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    }
  }

  const handleColumnMappingChange = (field: keyof ColumnMapping, column: string) => {
    setColumnMapping(prev => ({
      ...prev,
      [field]: column,
    }))
  }

  const confirmMapping = () => {
    // 필수 필드 검증 (도서명도 필수로 변경)
    if (!columnMapping.title || !columnMapping.isbn || !columnMapping.price || !columnMapping.author) {
      toast({
        title: "필드 매핑 필요",
        description: "도서명, ISBN, 가격, 작가명 필드를 모두 매핑해주세요.",
        variant: "destructive",
      })
      return
    }

    setMappingComplete(true)
  }

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
      const validationResults: ValidationResult[] = []
      const totalItems = csvData.length

      for (let i = 0; i < csvData.length; i++) {
        const item = csvData[i]
        const originalISBN = item[columnMapping.isbn]
        const isbn = cleanISBN(originalISBN)

        if (!isbn) {
          validationResults.push({
            original: item,
            isValid: false,
            error: "ISBN 값이 비어있습니다.",
          })
          continue
        }

        try {
          // API 호출
          const response = await fetch(`${API_URL}?isbn=${encodeURIComponent(isbn)}`)

          if (!response.ok) {
            throw new Error(`API 응답 오류: ${response.status}`)
          }

          const data = await response.json()

          // API 오류 확인
          if (data.error) {
            throw new Error(data.error)
          }

          // API 응답 검증
          if (!data.items || data.items.length === 0) {
            validationResults.push({
              original: item,
              isValid: false,
              apiResponse: data,
              notFound: true, // ISBN이 존재하지 않는 경우
              error: "API에서 결과를 찾을 수 없습니다.",
            })
            continue
          }

          const apiItem = data.items[0]

          // 값 비교
          const titleMatch =
            apiItem.title.includes(item[columnMapping.title]) || item[columnMapping.title].includes(apiItem.title)
          const apiISBN = cleanISBN(apiItem.isbn)
          const isbnMatch = apiISBN === isbn

          // 가격 비교 (숫자로 변환하여 비교)
          const apiPrice = apiItem.discount || "0"
          const csvPrice = item[columnMapping.price] || "0"
          const priceMatch = String(apiPrice) === String(csvPrice)

          // 작가 비교 추가 - 개선된 비교 로직 사용
          const apiAuthor = apiItem.author || ""
          const csvAuthor = item[columnMapping.author] || ""
          const authorMatch = compareAuthors(apiAuthor, csvAuthor)

          // 제목은 검증에서 제외하고 ISBN, 가격, 작가만 검증
          const isValid = isbnMatch && priceMatch && authorMatch

          validationResults.push({
            original: item,
            isValid,
            apiResponse: apiItem,
            matchDetails: {
              title: titleMatch, // 정보 제공용으로만 포함
              isbn: isbnMatch,
              discount: priceMatch,
              author: authorMatch,
            },
          })
        } catch (error) {
          const errorMessage = `API 호출 오류: ${error instanceof Error ? error.message : String(error)}`

          // Toast로 오류 표시
          toast({
            title: "API 오류",
            description: errorMessage,
            variant: "destructive",
          })

          validationResults.push({
            original: item,
            isValid: false,
            error: errorMessage,
          })
        }

        // Update progress
        setProgress(Math.round(((i + 1) / totalItems) * 100))
      }

      setResults(validationResults)
      setActiveTab("results")
    } catch (error) {
      setError(`검증 중 오류 발생: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setLoading(false)
      setProgress(100)
    }
  }

  const getValidCount = () => {
    return results.filter(r => r.isValid).length
  }

  const getInvalidCount = () => {
    return results.filter(r => !r.isValid).length
  }

  // 정렬 처리 함수
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // 같은 필드를 다시 클릭한 경우: asc -> desc -> null 순으로 변경
      if (sortDirection === "asc") {
        setSortDirection("desc")
      } else if (sortDirection === "desc") {
        setSortField(null)
        setSortDirection(null)
      } else {
        setSortDirection("asc")
      }
    } else {
      // 다른 필드를 클릭한 경우: 해당 필드로 변경하고 오름차순 정렬
      setSortField(field)
      setSortDirection("asc")
    }
  }

  // 정렬된 결과
  const sortedResults = useMemo(() => {
    if (!sortField || !sortDirection) return results

    return [...results].sort((a, b) => {
      let valueA, valueB

      if (sortField === "status") {
        valueA = a.isValid ? 1 : 0
        valueB = b.isValid ? 1 : 0
      } else if (sortField === "title") {
        valueA = a.original[columnMapping.title] || ""
        valueB = b.original[columnMapping.title] || ""
      } else if (sortField === "isbn") {
        valueA = a.original[columnMapping.isbn] || ""
        valueB = b.original[columnMapping.isbn] || ""
      } else if (sortField === "price") {
        valueA = Number(a.original[columnMapping.price]) || 0
        valueB = Number(b.original[columnMapping.price]) || 0
      } else if (sortField === "author") {
        valueA = a.original[columnMapping.author] || ""
        valueB = b.original[columnMapping.author] || ""
      }

      if (valueA === valueB) return 0

      // 정렬 방향에 따라 비교
      if (sortDirection === "asc") {
        return valueA > valueB ? 1 : -1
      } else {
        return valueA < valueB ? 1 : -1
      }
    })
  }, [results, sortField, sortDirection, columnMapping])

  // 상세 정보 보기
  const showDetails = (result: ValidationResult) => {
    setSelectedResult(result)
    setDetailDialogOpen(true)
  }

  // 정렬 아이콘 표시
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 inline ml-1 text-gray-400" />
    }

    return sortDirection === "asc" ? (
      <ChevronUp className="h-4 w-4 inline ml-1" />
    ) : (
      <ChevronDown className="h-4 w-4 inline ml-1" />
    )
  }

  // 상태 아이콘 렌더링 함수를 수정하여 ISBN 없음을 회색 X 아이콘으로 변경
  const renderStatusIcon = (result: ValidationResult) => {
    if (result.error && !result.notFound) {
      return <AlertCircle className="h-5 w-5 text-red-500" aria-label="API 오류" />
    }

    if (result.notFound) {
      return <AlertCircle className="h-5 w-5 text-gray-500" aria-label="ISBN을 찾을 수 없음" />
    }

    if (!result.isValid) {
      return <AlertTriangle className="h-5 w-5 text-yellow-500" aria-label="데이터 불일치" />
    }

    return <CheckCircle className="h-5 w-5 text-green-500" aria-label="일치" />
  }

  // 출판일 포맷팅
  const formatPubDate = (pubdate: string) => {
    if (!pubdate || pubdate.length !== 8) return pubdate
    return pubdate.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3")
  }

  const downloadResultsCSV = () => {
    if (results.length === 0) return

    // 결과를 CSV 형식으로 변환
    const csvData = results.map(result => {
      const original = result.original
      const resultObj: any = {
        검증결과: result.isValid ? "일치" : "불일치",
        오류메시지: result.error || "",
      }

      // 원본 데이터 열 추가
      if (columnMapping.title) resultObj["원본_도서명"] = original[columnMapping.title] || ""
      if (columnMapping.isbn) resultObj["원본_ISBN"] = original[columnMapping.isbn] || ""
      if (columnMapping.price) resultObj["원본_가격"] = original[columnMapping.price] || ""
      if (columnMapping.author) resultObj["원본_작가명"] = original[columnMapping.author] || ""

      // API 응답 데이터 추가
      if (result.apiResponse) {
        resultObj["API_도서명"] = result.apiResponse.title || ""
        resultObj["API_ISBN"] = result.apiResponse.isbn || ""
        resultObj["API_가격"] = result.apiResponse.discount || ""
        resultObj["API_작가명"] = result.apiResponse.author || ""
        resultObj["API_출판사"] = result.apiResponse.publisher || ""
        resultObj["API_출판일"] = result.apiResponse.pubdate || ""
      }

      return resultObj
    })

    // CSV 문자열로 변환
    const csv = Papa.unparse(csvData)

    // 다운로드 링크 생성
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `도서검증결과_${new Date().toISOString().slice(0, 10)}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // 탭 렌더링
  const renderTabs = () => {
    return (
      <div className="flex justify-center mb-6">
        <div className="toss-tabs inline-flex">
          <div className="flex space-x-1">
            <button
              className={`toss-tab ${activeTab === "upload" ? "toss-tab-active" : "toss-tab-inactive"}`}
              onClick={() => setActiveTab("upload")}
            >
              1. 파일 업로드
            </button>
            <button
              className={`toss-tab ${activeTab === "validate" ? "toss-tab-active" : "toss-tab-inactive"} ${
                !file ? "opacity-50 cursor-not-allowed" : ""
              }`}
              onClick={() => file && setActiveTab("validate")}
              disabled={!file}
            >
              2. 데이터 검증
            </button>
            <button
              className={`toss-tab ${activeTab === "results" ? "toss-tab-active" : "toss-tab-inactive"} ${
                results.length === 0 ? "opacity-50 cursor-not-allowed" : ""
              }`}
              onClick={() => results.length > 0 && setActiveTab("results")}
              disabled={results.length === 0}
            >
              3. 검증 결과
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-10 px-4 max-w-5xl">
      {isClient ? (
        <>
          <h1 className="text-3xl font-bold mb-8 text-center">서지 정보 검증 도구</h1>
          {renderTabs()}

          {activeTab === "upload" && (
            <Card className="toss-card">
              <CardContent className="p-8">
                <div className="mb-6">
                  <h2 className="text-xl font-bold mb-2">CSV 파일 업로드</h2>
                  <p className="text-gray-500 mb-6">도서 정보가 포함된 CSV 파일을 업로드하세요.</p>

                  <div className="bg-blue-50 rounded-lg p-4 mb-6 flex items-start">
                    <Info className="h-5 w-5 text-primary mt-0.5 mr-3 flex-shrink-0" />
                    <div>
                      <h3 className="font-medium text-primary mb-1">필수 열 정보</h3>
                      <p className="text-sm text-gray-600">
                        CSV 파일에는 다음 열이 포함되어야 합니다: 도서명, ISBN, 가격, 작가명. 검증은 ISBN, 가격, 작가명을
                        기준으로 이루어집니다.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-lg p-12 mb-6">
                    <Upload className="h-12 w-12 text-gray-400 mb-4" />
                    <div className="flex flex-col items-center text-center mb-6">
                      <h3 className="font-medium mb-1">CSV 파일을 여기에 드래그하거나 클릭하여 업로드하세요</h3>
                      <p className="text-sm text-gray-500">CSV 파일만 지원됩니다</p>
                    </div>
                    <Input id="file-upload" type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                    <Button
                      onClick={() => document.getElementById("file-upload")?.click()}
                      className="toss-button-primary px-6 py-2.5"
                    >
                      <FileUp className="mr-2 h-4 w-4" />
                      파일 선택
                    </Button>
                  </div>

                  {file && (
                    <div className="bg-green-50 rounded-lg p-4 flex items-start">
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 mr-3 flex-shrink-0" />
                      <div>
                        <h3 className="font-medium text-green-700 mb-1">파일 업로드 완료</h3>
                        <p className="text-sm text-gray-600">
                          {file.name} ({(file.size / 1024).toFixed(2)} KB) 파일이 업로드되었습니다.
                          {csvData.length > 0 && ` ${csvData.length}개의 행이 로드되었습니다.`}
                        </p>
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="bg-red-50 rounded-lg p-4 mt-4 flex items-start">
                      <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
                      <div>
                        <h3 className="font-medium text-red-700 mb-1">오류</h3>
                        <p className="text-sm text-gray-600">{error}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === "validate" && (
            <Card className="toss-card">
              <CardContent className="p-8">
                <div className="mb-6">
                  <h2 className="text-xl font-bold mb-2">데이터 검증</h2>
                  <p className="text-gray-500 mb-6">데이터 검증을 시작하기 전에 열 매핑을 확인하세요.</p>

                  {!mappingComplete ? (
                    <div className="space-y-6">
                      <div className="bg-blue-50 rounded-lg p-4 mb-6 flex items-start">
                        <Info className="h-5 w-5 text-primary mt-0.5 mr-3 flex-shrink-0" />
                        <div>
                          <h3 className="font-medium text-primary mb-1">열 매핑</h3>
                          <p className="text-sm text-gray-600">
                            Excel 데이터의 열을 필요한 필드에 매핑하세요. 검증은 ISBN, 가격, 작가명을 기준으로 이루어집니다.
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium mb-1">도서명</label>
                            <select
                              className="w-full rounded-lg border border-gray-200 p-2"
                              value={columnMapping.title}
                              onChange={e => handleColumnMappingChange("title", e.target.value)}
                            >
                              <option value="">선택하세요</option>
                              {availableColumns.map(col => (
                                <option key={col} value={col}>
                                  {col}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-1">ISBN</label>
                            <select
                              className="w-full rounded-lg border border-gray-200 p-2"
                              value={columnMapping.isbn}
                              onChange={e => handleColumnMappingChange("isbn", e.target.value)}
                            >
                              <option value="">선택하세요</option>
                              {availableColumns.map(col => (
                                <option key={col} value={col}>
                                  {col}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium mb-1">가격</label>
                            <select
                              className="w-full rounded-lg border border-gray-200 p-2"
                              value={columnMapping.price}
                              onChange={e => handleColumnMappingChange("price", e.target.value)}
                            >
                              <option value="">선택하세요</option>
                              {availableColumns.map(col => (
                                <option key={col} value={col}>
                                  {col}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-1">작가명</label>
                            <select
                              className="w-full rounded-lg border border-gray-200 p-2"
                              value={columnMapping.author}
                              onChange={e => handleColumnMappingChange("author", e.target.value)}
                            >
                              <option value="">선택하세요</option>
                              {availableColumns.map(col => (
                                <option key={col} value={col}>
                                  {col}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="pt-4">
                        <Button onClick={confirmMapping} className="toss-button-primary px-6 py-2.5 w-full md:w-auto">
                          매핑 확인 및 계속
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div>
                        <h3 className="font-medium mb-3">데이터 미리보기</h3>
                        <div className="border border-gray-100 rounded-lg overflow-hidden bg-white shadow-sm">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-gray-50">
                                {columnMapping.title && <TableHead className="font-medium">도서명</TableHead>}
                                {columnMapping.isbn && <TableHead className="font-medium">ISBN</TableHead>}
                                {columnMapping.price && <TableHead className="font-medium">가격</TableHead>}
                                {columnMapping.author && <TableHead className="font-medium">작가명</TableHead>}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {csvData.slice(0, 5).map((item, index) => (
                                <TableRow key={index} className="hover:bg-gray-50">
                                  {columnMapping.title && <TableCell>{item[columnMapping.title]}</TableCell>}
                                  {columnMapping.isbn && <TableCell>{item[columnMapping.isbn]}</TableCell>}
                                  {columnMapping.price && <TableCell>{formatPrice(item[columnMapping.price])}</TableCell>}
                                  {columnMapping.author && <TableCell>{item[columnMapping.author]}</TableCell>}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                          {csvData.length > 5 && (
                            <div className="p-3 text-center text-sm text-gray-500 bg-gray-50 border-t border-gray-100">
                              외 {csvData.length - 5}개 항목
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="pt-4">
                        <Button
                          onClick={validateData}
                          disabled={loading}
                          className="toss-button-primary px-6 py-2.5 w-full md:w-auto"
                        >
                          {loading ? "검증 중..." : "데이터 검증 시작"}
                        </Button>
                      </div>

                      {loading && (
                        <div className="space-y-2 mt-4">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium">검증 진행 중...</span>
                            <span className="font-medium text-primary">{progress}%</span>
                          </div>
                          <Progress value={progress} className="h-2 bg-blue-100" />
                        </div>
                      )}

                      {error && (
                        <div className="bg-red-50 rounded-lg p-4 mt-4 flex items-start">
                          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
                          <div>
                            <h3 className="font-medium text-red-700 mb-1">오류</h3>
                            <p className="text-sm text-gray-600">{error}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === "results" && (
            <Card className="toss-card">
              <CardContent className="p-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
                  <div>
                    <h2 className="text-xl font-bold mb-1">검증 결과</h2>
                    <p className="text-gray-500">
                      총 {results.length}개 항목 중 {getValidCount()}개 일치, {getInvalidCount()}개 불일치
                    </p>
                  </div>
                  <Button
                    onClick={downloadResultsCSV}
                    className="toss-button-outline mt-4 md:mt-0 px-5 py-2.5 flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    CSV 다운로드
                  </Button>
                </div>

                <div className="space-y-6">
                  <div className="flex flex-wrap gap-4 mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <span className="text-sm">일치</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <span className="text-sm">데이터 불일치</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                      <span className="text-sm">ISBN 없음</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <span className="text-sm">API 오류</span>
                    </div>
                  </div>

                  <div className="border border-gray-100 rounded-lg overflow-hidden bg-white shadow-sm">
                    <Table>
                      {/* 검증 결과 테이블 부분을 수정 */}
                      {/* TableHeader 부분에서 "상태" 열을 "결과"로 변경 */}
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="w-[50px] font-medium">번호</TableHead>
                          {columnMapping.title && (
                            <TableHead className="cursor-pointer font-medium w-[30%]" onClick={() => handleSort("title")}>
                              도서명 {renderSortIcon("title")}
                            </TableHead>
                          )}
                          <TableHead className="cursor-pointer font-medium" onClick={() => handleSort("isbn")}>
                            ISBN {renderSortIcon("isbn")}
                          </TableHead>
                          <TableHead className="cursor-pointer font-medium" onClick={() => handleSort("price")}>
                            가격 {renderSortIcon("price")}
                          </TableHead>
                          {columnMapping.author && (
                            <TableHead className="cursor-pointer font-medium" onClick={() => handleSort("author")}>
                              작가명 {renderSortIcon("author")}
                            </TableHead>
                          )}
                          <TableHead className="cursor-pointer font-medium" onClick={() => handleSort("status")}>
                            결과 {renderSortIcon("status")}
                          </TableHead>
                        </TableRow>
                      </TableHeader>

                      {/* TableBody 부분을 수정하여 API 응답 값을 표시하고 API 응답이 없는 경우 처리 */}
                      <TableBody>
                        {sortedResults.map((result, index) => {
                          const hasApiResponse = result.apiResponse && !result.notFound
                          const isDisabled = !hasApiResponse || (result.error && !result.notFound)

                          return (
                            <TableRow
                              key={index}
                              className={`hover:bg-gray-50 ${isDisabled ? "bg-gray-100 opacity-70" : "cursor-pointer"}`}
                              onClick={() => (isDisabled ? null : showDetails(result))}
                            >
                              <TableCell>{index + 1}</TableCell>
                              {columnMapping.title && (
                                <TableCell className="truncate max-w-[200px]">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className="truncate"
                                      title={
                                        hasApiResponse ? result.apiResponse.title : result.original[columnMapping.title]
                                      }
                                    >
                                      {hasApiResponse ? result.apiResponse.title : result.original[columnMapping.title]}
                                    </span>
                                    {hasApiResponse && result.apiResponse?.link && (
                                      <a
                                        href={result.apiResponse.link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={e => e.stopPropagation()}
                                      >
                                        <ExternalLink className="h-4 w-4 text-gray-400 hover:text-primary flex-shrink-0" />
                                      </a>
                                    )}
                                  </div>
                                </TableCell>
                              )}
                              <TableCell
                                className={result.matchDetails?.isbn ? "text-green-600 font-medium" : "text-red-600"}
                              >
                                {hasApiResponse ? result.apiResponse.isbn : result.original[columnMapping.isbn]}
                              </TableCell>
                              <TableCell
                                className={result.matchDetails?.discount ? "text-green-600 font-medium" : "text-red-600"}
                              >
                                {hasApiResponse
                                  ? formatPrice(result.apiResponse.discount)
                                  : formatPrice(result.original[columnMapping.price])}
                              </TableCell>
                              {columnMapping.author && (
                                <TableCell
                                  className={result.matchDetails?.author ? "text-green-600 font-medium" : "text-red-600"}
                                >
                                  {hasApiResponse ? result.apiResponse.author : result.original[columnMapping.author]}
                                </TableCell>
                              )}
                              <TableCell>{renderStatusIcon(result)}</TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex justify-end mt-6">
                    <Button onClick={() => setActiveTab("upload")} className="toss-button-primary px-6 py-2.5">
                      새 파일 업로드
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 상세 정보 다이얼로그 */}
          <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
            <DialogContent className="max-w-3xl p-0 rounded-lg overflow-hidden">
              <div className="bg-primary p-5">
                <DialogHeader>
                  <DialogTitle className="text-lg text-white">도서 상세 정보</DialogTitle>
                  <div className="mt-2">
                    {selectedResult?.isValid ? (
                      <span className="toss-badge-success">일치</span>
                    ) : selectedResult?.notFound ? (
                      <span className="toss-badge-error">ISBN 없음</span>
                    ) : (
                      <span className="toss-badge-error">불일치</span>
                    )}
                  </div>
                </DialogHeader>
              </div>

              {selectedResult && (
                <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
                  {/* 도서 기본 정보 */}
                  <div className="toss-section">
                    <h3 className="detail-section-title">도서 정보</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* CSV 데이터 */}
                      <div className="space-y-3">
                        <h4 className="detail-label">CSV 데이터</h4>
                        <div className="space-y-2">
                          <div className="detail-item">
                            <span className="detail-item-label">도서명:</span>
                            <span className="detail-item-value">{selectedResult.original[columnMapping.title]}</span>
                          </div>
                          <Separator className="bg-gray-100" />
                          <div className="detail-item">
                            <span className="detail-item-label">ISBN:</span>
                            <span className="detail-item-value">{selectedResult.original[columnMapping.isbn]}</span>
                          </div>
                          <Separator className="bg-gray-100" />
                          <div className="detail-item">
                            <span className="detail-item-label">가격:</span>
                            <span className="detail-item-value">
                              {formatPrice(selectedResult.original[columnMapping.price])}원
                            </span>
                          </div>
                          <Separator className="bg-gray-100" />
                          <div className="detail-item">
                            <span className="detail-item-label">작가명:</span>
                            <span className="detail-item-value">{selectedResult.original[columnMapping.author]}</span>
                          </div>
                        </div>
                      </div>

                      {/* API 응답 데이터 */}
                      {selectedResult.apiResponse && (
                        <div className="space-y-3">
                          <h4 className="detail-label">API 응답 데이터</h4>
                          <div className="space-y-2">
                            <div className="detail-item">
                              <span className="detail-item-label">도서명:</span>
                              <span
                                className={`detail-item-value ${
                                  selectedResult.matchDetails?.title ? "text-green-600" : "text-red-600"
                                }`}
                              >
                                {selectedResult.apiResponse.title}
                              </span>
                            </div>
                            <Separator className="bg-gray-100" />
                            <div className="detail-item">
                              <span className="detail-item-label">ISBN:</span>
                              <span
                                className={`detail-item-value ${
                                  selectedResult.matchDetails?.isbn ? "text-green-600" : "text-red-600"
                                }`}
                              >
                                {selectedResult.apiResponse.isbn}
                              </span>
                            </div>
                            <Separator className="bg-gray-100" />
                            <div className="detail-item">
                              <span className="detail-item-label">가격:</span>
                              <span
                                className={`detail-item-value ${
                                  selectedResult.matchDetails?.discount ? "text-green-600" : "text-red-600"
                                }`}
                              >
                                {formatPrice(selectedResult.apiResponse.discount)}원
                              </span>
                            </div>
                            <Separator className="bg-gray-100" />
                            <div className="detail-item">
                              <span className="detail-item-label">작가명:</span>
                              <span
                                className={`detail-item-value ${
                                  selectedResult.matchDetails?.author ? "text-green-600" : "text-red-600"
                                }`}
                              >
                                {selectedResult.apiResponse.author}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 오류 메시지 */}
                  {selectedResult.error && (
                    <div className="bg-red-50 rounded-lg p-4 flex items-start">
                      <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
                      <div>
                        <h3 className="text-xs font-medium text-red-700 mb-1">오류</h3>
                        <p className="text-xs text-gray-600">{selectedResult.error}</p>
                      </div>
                    </div>
                  )}

                  {/* API 응답 추가 정보 */}
                  {selectedResult.apiResponse && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* 추가 메타데이터 */}
                        <div className="md:col-span-2 space-y-3">
                          <h3 className="detail-section-title">추가 정보</h3>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="toss-section">
                              <h4 className="detail-label">저자</h4>
                              <p className="detail-value">{selectedResult.apiResponse.author || "-"}</p>
                            </div>
                            <div className="toss-section">
                              <h4 className="detail-label">출판사</h4>
                              <p className="detail-value">{selectedResult.apiResponse.publisher || "-"}</p>
                            </div>
                            <div className="toss-section">
                              <h4 className="detail-label">출판일</h4>
                              <p className="detail-value">{formatPubDate(selectedResult.apiResponse.pubdate) || "-"}</p>
                            </div>
                            <div className="toss-section">
                              <h4 className="detail-label">링크</h4>
                              {selectedResult.apiResponse.link ? (
                                <a
                                  href={selectedResult.apiResponse.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline flex items-center gap-1 text-xs"
                                >
                                  보기 <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : (
                                <p className="detail-value">-</p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* 도서 이미지 */}
                        {selectedResult.apiResponse.image && (
                          <div className="flex justify-center items-start">
                            <div className="border rounded-lg p-2 bg-white shadow-sm">
                              <img
                                src={selectedResult.apiResponse.image || "/placeholder.svg"}
                                alt={selectedResult.apiResponse.title}
                                className="max-h-36 object-contain"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 도서 설명 */}
                      {selectedResult.apiResponse.description && (
                        <div className="toss-section">
                          <h4 className="detail-label mb-2">도서 설명</h4>
                          <p className="detail-description">{selectedResult.apiResponse.description}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 링크 */}
                  {selectedResult.apiResponse?.link && (
                    <div className="flex justify-end mt-4">
                      <Button asChild className="toss-button-primary px-5 py-2 text-xs">
                        <a href={selectedResult.apiResponse.link} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="mr-2 h-3 w-3" />
                          상세 페이지 보기
                        </a>
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}
    </div>
  )
}
