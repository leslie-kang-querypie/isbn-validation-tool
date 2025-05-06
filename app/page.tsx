"use client"

import type React from "react"
import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
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
} from "lucide-react"
import Papa from "papaparse"

// 고정된 CSV 열 매핑
const CSV_COLUMNS = {
  이름: "title",
  ISBN: "isbn",
  가격: "discount",
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
  }
}

// 가격 포맷팅 함수
const formatPrice = (price: string | number) => {
  if (!price) return "0"
  return Number(price).toLocaleString("ko-KR")
}

// 정렬 타입
type SortDirection = "asc" | "desc" | null
type SortField = "이름" | "ISBN" | "가격" | "상태" | null

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
  const [alertDialogOpen, setAlertDialogOpen] = useState<boolean>(false)
  const [alertMessage, setAlertMessage] = useState<string>("")

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

        // 필수 열이 있는지 확인
        if (parsedData.length > 0) {
          const firstRow = parsedData[0]
          const missingColumns = Object.keys(CSV_COLUMNS).filter((col) => !(col in firstRow))

          if (missingColumns.length > 0) {
            setError(`CSV 파일에 필수 열이 누락되었습니다: ${missingColumns.join(", ")}`)
            return
          }
        }

        setCsvData(parsedData)
        setActiveTab("validate")
      },
      error: (error) => {
        setError(`CSV 파싱 오류: ${error.message}`)
      },
    })
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
        const isbn = item["ISBN"]

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
          const titleMatch = apiItem.title.includes(item["이름"]) || item["이름"].includes(apiItem.title)
          const isbnMatch = apiItem.isbn === isbn

          // 가격 비교 (숫자로 변환하여 비교)
          const apiPrice = apiItem.discount || "0"
          const csvPrice = item["가격"] || "0"
          const priceMatch = String(apiPrice) === String(csvPrice)

          const isValid = titleMatch && isbnMatch && priceMatch

          validationResults.push({
            original: item,
            isValid,
            apiResponse: apiItem,
            matchDetails: {
              title: titleMatch,
              isbn: isbnMatch,
              discount: priceMatch,
            },
          })
        } catch (error) {
          const errorMessage = `API 호출 오류: ${error instanceof Error ? error.message : String(error)}`
          // AlertDialog로 오류 표시
          setAlertMessage(errorMessage)
          setAlertDialogOpen(true)

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

      if (sortField === "상태") {
        valueA = a.isValid ? 1 : 0
        valueB = b.isValid ? 1 : 0
      } else {
        valueA = a.original[sortField]
        valueB = b.original[sortField]

        // 가격은 숫자로 변환하여 비교
        if (sortField === "가격") {
          valueA = Number(valueA) || 0
          valueB = Number(valueB) || 0
        }
      }

      if (valueA === valueB) return 0

      // 정렬 방향에 따라 비교
      if (sortDirection === "asc") {
        return valueA > valueB ? 1 : -1
      } else {
        return valueA < valueB ? 1 : -1
      }
    })
  }, [results, sortField, sortDirection])

  // 상세 정보 보기
  const showDetails = (result: ValidationResult) => {
    setSelectedResult(result)
    setDetailDialogOpen(true)
  }

  // 정렬 아이콘 표시
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return null

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

  // 검증 결과 CSV 다운로드
  const downloadResultsCSV = () => {
    if (results.length === 0) return

    // 결과를 CSV 형식으로 변환
    const csvData = results.map((result) => {
      const original = result.original
      return {
        ...original,
        검증결과: result.isValid ? "일치" : "불일치",
        오류메시지: result.error || "",
        API도서명: result.apiResponse?.title || "",
        API가격: result.apiResponse?.discount || "",
        API저자: result.apiResponse?.author || "",
        API출판사: result.apiResponse?.publisher || "",
        API출판일: result.apiResponse?.pubdate || "",
      }
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

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6 text-center">도서 정보 검증 도구</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upload">1. 파일 업로드</TabsTrigger>
          <TabsTrigger value="validate" disabled={!file}>
            2. 데이터 검증
          </TabsTrigger>
          <TabsTrigger value="results" disabled={results.length === 0}>
            3. 검증 결과
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload">
          <Card>
            <CardHeader>
              <CardTitle>CSV 파일 업로드</CardTitle>
              <CardDescription>도서 정보가 포함된 CSV 파일을 업로드하세요.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>필수 열 정보</AlertTitle>
                  <AlertDescription>CSV 파일에는 다음 열이 포함되어야 합니다: 이름, ISBN, 가격</AlertDescription>
                </Alert>
              </div>

              <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-12 mb-4">
                <Upload className="h-10 w-10 text-muted-foreground mb-4" />
                <div className="flex flex-col items-center text-center mb-4">
                  <h3 className="font-medium">CSV 파일을 여기에 드래그하거나 클릭하여 업로드하세요</h3>
                  <p className="text-sm text-muted-foreground mt-1">CSV 파일만 지원됩니다</p>
                </div>
                <Input id="file-upload" type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                <Button onClick={() => document.getElementById("file-upload")?.click()}>
                  <FileUp className="mr-2 h-4 w-4" />
                  파일 선택
                </Button>
              </div>

              {file && (
                <Alert className="mt-4">
                  <CheckCircle className="h-4 w-4" />
                  <AlertTitle>파일 업로드 완료</AlertTitle>
                  <AlertDescription>
                    {file.name} ({(file.size / 1024).toFixed(2)} KB) 파일이 업로드되었습니다.
                    {csvData.length > 0 && ` ${csvData.length}개의 행이 로드되었습니다.`}
                  </AlertDescription>
                </Alert>
              )}

              {error && (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>오류</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="validate">
          <Card>
            <CardHeader>
              <CardTitle>데이터 검증</CardTitle>
              <CardDescription>데이터 검증을 시작하세요.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6">
                <div className="space-y-2">
                  <h3 className="font-medium">데이터 미리보기</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>이름</TableHead>
                          <TableHead>ISBN</TableHead>
                          <TableHead>가격</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {csvData.slice(0, 5).map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>{item["이름"]}</TableCell>
                            <TableCell>{item["ISBN"]}</TableCell>
                            <TableCell>{formatPrice(item["가격"])}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {csvData.length > 5 && (
                      <div className="p-2 text-center text-sm text-muted-foreground">
                        외 {csvData.length - 5}개 항목
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4">
                  <Button onClick={validateData} disabled={loading}>
                    {loading ? "검증 중..." : "데이터 검증 시작"}
                  </Button>
                </div>

                {loading && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>검증 진행 중...</span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress} />
                  </div>
                )}

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>오류</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>검증 결과</CardTitle>
                  <CardDescription>
                    총 {results.length}개 항목 중 {getValidCount()}개 일치, {getInvalidCount()}개 불일치
                  </CardDescription>
                </div>
                <Button onClick={downloadResultsCSV} variant="outline" className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  CSV 다운로드
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-green-500"></div>
                    <span>일치: {getValidCount()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-red-500"></div>
                    <span>불일치: {getInvalidCount()}</span>
                  </div>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">번호</TableHead>
                        <TableHead className="cursor-pointer" onClick={() => handleSort("이름")}>
                          도서명 {renderSortIcon("이름")}
                        </TableHead>
                        <TableHead className="cursor-pointer" onClick={() => handleSort("ISBN")}>
                          ISBN {renderSortIcon("ISBN")}
                        </TableHead>
                        <TableHead className="cursor-pointer" onClick={() => handleSort("가격")}>
                          가격 {renderSortIcon("가격")}
                        </TableHead>
                        <TableHead className="cursor-pointer" onClick={() => handleSort("상태")}>
                          상태 {renderSortIcon("상태")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedResults.map((result, index) => (
                        <TableRow
                          key={index}
                          className={`${result.error ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:bg-muted/50"}`}
                          onClick={() => (result.error ? null : showDetails(result))}
                        >
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {result.original["이름"]}
                              {!result.error && result.apiResponse?.link && (
                                <a
                                  href={result.apiResponse.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-primary" />
                                </a>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{result.original["ISBN"]}</TableCell>
                          <TableCell>{formatPrice(result.original["가격"])}</TableCell>
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

                <div className="flex justify-end">
                  <Button onClick={() => setActiveTab("upload")}>새 파일 업로드</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 상세 정보 다이얼로그 */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl">도서 상세 정보</DialogTitle>
            <DialogDescription>
              {selectedResult?.isValid ? (
                <Badge variant="outline" className="bg-green-50 text-green-700 hover:bg-green-50">
                  일치
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-red-50 text-red-700 hover:bg-red-50">
                  불일치
                </Badge>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedResult && (
            <div className="space-y-6">
              {/* 도서 기본 정보 */}
              <div className="bg-muted/30 p-4 rounded-lg">
                <h3 className="text-lg font-medium mb-3">도서 정보</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* CSV 데이터 */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm text-muted-foreground">CSV 데이터</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="font-medium">도서명:</span>
                        <span className="text-right">{selectedResult.original["이름"]}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between">
                        <span className="font-medium">ISBN:</span>
                        <span className="text-right">{selectedResult.original["ISBN"]}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between">
                        <span className="font-medium">가격:</span>
                        <span className="text-right">{formatPrice(selectedResult.original["가격"])}원</span>
                      </div>
                    </div>
                  </div>

                  {/* API 응답 데이터 */}
                  {selectedResult.apiResponse && (
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm text-muted-foreground">API 응답 데이터</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="font-medium">도서명:</span>
                          <span
                            className={`text-right ${selectedResult.matchDetails?.title ? "text-green-600" : "text-red-600"}`}
                          >
                            {selectedResult.apiResponse.title}
                          </span>
                        </div>
                        <Separator />
                        <div className="flex justify-between">
                          <span className="font-medium">ISBN:</span>
                          <span
                            className={`text-right ${selectedResult.matchDetails?.isbn ? "text-green-600" : "text-red-600"}`}
                          >
                            {selectedResult.apiResponse.isbn}
                          </span>
                        </div>
                        <Separator />
                        <div className="flex justify-between">
                          <span className="font-medium">가격:</span>
                          <span
                            className={`text-right ${selectedResult.matchDetails?.discount ? "text-green-600" : "text-red-600"}`}
                          >
                            {formatPrice(selectedResult.apiResponse.discount)}원
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 오류 메시지 */}
              {selectedResult.error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>오류</AlertTitle>
                  <AlertDescription>{selectedResult.error}</AlertDescription>
                </Alert>
              )}

              {/* API 응답 추가 정보 */}
              {selectedResult.apiResponse && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* 추가 메타데이터 */}
                    <div className="md:col-span-2 space-y-4">
                      <h3 className="text-lg font-medium">추가 정보</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-muted/30 p-3 rounded-md">
                          <h4 className="text-sm font-medium text-muted-foreground mb-1">저자</h4>
                          <p>{selectedResult.apiResponse.author || "-"}</p>
                        </div>
                        <div className="bg-muted/30 p-3 rounded-md">
                          <h4 className="text-sm font-medium text-muted-foreground mb-1">출판사</h4>
                          <p>{selectedResult.apiResponse.publisher || "-"}</p>
                        </div>
                        <div className="bg-muted/30 p-3 rounded-md">
                          <h4 className="text-sm font-medium text-muted-foreground mb-1">출판일</h4>
                          <p>{formatPubDate(selectedResult.apiResponse.pubdate) || "-"}</p>
                        </div>
                        <div className="bg-muted/30 p-3 rounded-md">
                          <h4 className="text-sm font-medium text-muted-foreground mb-1">링크</h4>
                          {selectedResult.apiResponse.link ? (
                            <a
                              href={selectedResult.apiResponse.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline flex items-center gap-1"
                            >
                              보기 <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <p>-</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 도서 이미지 */}
                    {selectedResult.apiResponse.image && (
                      <div className="flex justify-center items-start">
                        <div className="border rounded-md p-2 bg-white">
                          <img
                            src={selectedResult.apiResponse.image || "/placeholder.svg"}
                            alt={selectedResult.apiResponse.title}
                            className="max-h-40 object-contain"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 도서 설명 */}
                  {selectedResult.apiResponse.description && (
                    <div className="mt-4 bg-muted/30 p-4 rounded-lg">
                      <h4 className="font-medium mb-2">도서 설명</h4>
                      <p className="text-sm whitespace-pre-line">{selectedResult.apiResponse.description}</p>
                    </div>
                  )}
                </div>
              )}

              {/* 링크 */}
              {selectedResult.apiResponse?.link && (
                <div className="flex justify-end mt-4">
                  <Button asChild variant="outline">
                    <a href={selectedResult.apiResponse.link} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      상세 페이지 보기
                    </a>
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 오류 알림 다이얼로그 */}
      <AlertDialog open={alertDialogOpen} onOpenChange={setAlertDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>API 오류</AlertDialogTitle>
            <AlertDialogDescription>{alertMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>확인</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
