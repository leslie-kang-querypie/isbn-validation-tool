"use client"

import type React from "react"
import { useState, useMemo } from "react"
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
  XCircle,
  AlertCircle,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  Download,
  Info,
  ArrowUpDown,
} from "lucide-react"
import Papa from "papaparse"

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
  matchDetails?: {
    title: boolean
    isbn: boolean
    discount: boolean
    author: boolean
  }
}

// 가격 포맷팅 함수
const formatPrice = (price: string | number) => {
  if (!price) return "0"
  return Number(price).toLocaleString("ko-KR")
}

// 정렬 타입
type SortDirection = "asc" | "desc" | null
type SortField = "title" | "isbn" | "price" | "author" | "status" | null

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
  const { toast } = useToast()

  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    title: "",
    isbn: "",
    price: "",
    author: "",
  })
  const [availableColumns, setAvailableColumns] = useState<string[]>([])
  const [mappingComplete, setMappingComplete] = useState<boolean>(false)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError("")
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (selectedFile.type !== "text/csv" && !selectedFile.name.endsWith(".csv")) {
        setError("CSV 파일만 업로드 가능합니다.")
        return
      }
      setFile(selectedFile)
      parseCSV(selectedFile)
    }
  }

  const parseCSV = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedData = results.data as any[]

        if (parsedData.length > 0) {
          // 사용 가능한 열 목록 추출
          const firstRow = parsedData[0]
          const columns = Object.keys(firstRow)
          setAvailableColumns(columns)

          // 자동 매핑 시도 (일반적인 이름 기반)
          const mapping: ColumnMapping = {
            title:
              columns.find(
                (col) => col.includes("제목") || col.includes("타이틀") || col.toLowerCase().includes("title"),
              ) || "",
            isbn: columns.find((col) => col.includes("ISBN") || col.includes("isbn")) || "",
            price:
              columns.find(
                (col) => col.includes("가격") || col.includes("재정가") || col.toLowerCase().includes("price"),
              ) || "",
            author:
              columns.find(
                (col) => col.includes("저자") || col.includes("작가") || col.toLowerCase().includes("author"),
              ) || "",
          }

          setColumnMapping(mapping)
          setCsvData(parsedData)
          setActiveTab("validate")
          setMappingComplete(false)
        }
      },
      error: (error) => {
        setError(`CSV 파싱 오류: ${error.message}`)
      },
    })
  }

  const handleColumnMappingChange = (field: keyof ColumnMapping, column: string) => {
    setColumnMapping((prev) => ({
      ...prev,
      [field]: column,
    }))
  }

  const confirmMapping = () => {
    // 필수 필드 검증
    if (!columnMapping.isbn || !columnMapping.price || !columnMapping.author) {
      toast({
        title: "필드 매핑 필요",
        description: "ISBN, 가격, 작가명 필드를 모두 매핑해주세요.",
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
        const isbn = item[columnMapping.isbn]

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
              error: "API에서 결과를 찾을 수 없습니다.",
            })
            continue
          }

          const apiItem = data.items[0]

          // 값 비교
          const titleMatch =
            apiItem.title.includes(item[columnMapping.title]) || item[columnMapping.title].includes(apiItem.title)
          const isbnMatch = apiItem.isbn === isbn

          // 가격 비교 (숫자로 변환하여 비교)
          const apiPrice = apiItem.discount || "0"
          const csvPrice = item[columnMapping.price] || "0"
          const priceMatch = String(apiPrice) === String(csvPrice)

          // 작가 비교 추가
          const apiAuthor = apiItem.author || ""
          const csvAuthor = item[columnMapping.author] || ""
          const authorMatch = apiAuthor.includes(csvAuthor) || csvAuthor.includes(apiAuthor)

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
    return results.filter((r) => r.isValid).length
  }

  const getInvalidCount = () => {
    return results.filter((r) => !r.isValid).length
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

  // 출판일 포맷팅
  const formatPubDate = (pubdate: string) => {
    if (!pubdate || pubdate.length !== 8) return pubdate
    return pubdate.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3")
  }

  const downloadResultsCSV = () => {
    if (results.length === 0) return

    // 결과를 CSV 형식으로 변환
    const csvData = results.map((result) => {
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
              className={`toss-tab ${activeTab === "validate" ? "toss-tab-active" : "toss-tab-inactive"} ${!file ? "opacity-50 cursor-not-allowed" : ""}`}
              onClick={() => file && setActiveTab("validate")}
              disabled={!file}
            >
              2. 데이터 검증
            </button>
            <button
              className={`toss-tab ${activeTab === "results" ? "toss-tab-active" : "toss-tab-inactive"} ${results.length === 0 ? "opacity-50 cursor-not-allowed" : ""}`}
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
                  <p className="text-sm text-gray-600">CSV 파일에는 다음 열이 포함되어야 합니다: 이름, ISBN, 가격</p>
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
                          onChange={(e) => handleColumnMappingChange("title", e.target.value)}
                        >
                          <option value="">선택하세요</option>
                          {availableColumns.map((col) => (
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
                          onChange={(e) => handleColumnMappingChange("isbn", e.target.value)}
                        >
                          <option value="">선택하세요</option>
                          {availableColumns.map((col) => (
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
                          onChange={(e) => handleColumnMappingChange("price", e.target.value)}
                        >
                          <option value="">선택하세요</option>
                          {availableColumns.map((col) => (
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
                          onChange={(e) => handleColumnMappingChange("author", e.target.value)}
                        >
                          <option value="">선택하세요</option>
                          {availableColumns.map((col) => (
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
              <div className="flex gap-6 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-sm">일치: {getValidCount()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span className="text-sm">불일치: {getInvalidCount()}</span>
                </div>
              </div>

              <div className="border border-gray-100 rounded-lg overflow-hidden bg-white shadow-sm">
                <Table>
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
                        상태 {renderSortIcon("status")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedResults.map((result, index) => (
                      <TableRow
                        key={index}
                        className={`hover:bg-gray-50 ${result.error ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
                        onClick={() => (result.error ? null : showDetails(result))}
                      >
                        <TableCell>{index + 1}</TableCell>
                        {columnMapping.title && (
                          <TableCell className="truncate max-w-[200px]">
                            <div className="flex items-center gap-2">
                              <span className="truncate" title={result.original[columnMapping.title]}>
                                {result.original[columnMapping.title]}
                              </span>
                              {!result.error && result.apiResponse?.link && (
                                <a
                                  href={result.apiResponse.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <ExternalLink className="h-4 w-4 text-gray-400 hover:text-primary flex-shrink-0" />
                                </a>
                              )}
                            </div>
                          </TableCell>
                        )}
                        <TableCell>{result.original[columnMapping.isbn]}</TableCell>
                        <TableCell>{formatPrice(result.original[columnMapping.price])}</TableCell>
                        {columnMapping.author && <TableCell>{result.original[columnMapping.author]}</TableCell>}
                        <TableCell>
                          {result.isValid ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
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
                            className={`detail-item-value ${selectedResult.matchDetails?.title ? "text-green-600" : "text-red-600"}`}
                          >
                            {selectedResult.apiResponse.title}
                          </span>
                        </div>
                        <Separator className="bg-gray-100" />
                        <div className="detail-item">
                          <span className="detail-item-label">ISBN:</span>
                          <span
                            className={`detail-item-value ${selectedResult.matchDetails?.isbn ? "text-green-600" : "text-red-600"}`}
                          >
                            {selectedResult.apiResponse.isbn}
                          </span>
                        </div>
                        <Separator className="bg-gray-100" />
                        <div className="detail-item">
                          <span className="detail-item-label">가격:</span>
                          <span
                            className={`detail-item-value ${selectedResult.matchDetails?.discount ? "text-green-600" : "text-red-600"}`}
                          >
                            {formatPrice(selectedResult.apiResponse.discount)}원
                          </span>
                        </div>
                        {columnMapping.author && (
                          <>
                            <Separator className="bg-gray-100" />
                            <div className="detail-item">
                              <span className="detail-item-label">작가명:</span>
                              <span
                                className={`detail-item-value ${selectedResult.matchDetails?.author ? "text-green-600" : "text-red-600"}`}
                              >
                                {selectedResult.apiResponse.author}
                              </span>
                            </div>
                          </>
                        )}
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
    </div>
  )
}
