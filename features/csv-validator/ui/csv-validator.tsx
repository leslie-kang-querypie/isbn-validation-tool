"use client"

import { useState, useMemo, useEffect } from "react"
import { useToast } from "@/hooks/use-toast"
import { useCsvValidator } from "../model/use-csv-validator"
import { UploadTab } from "./upload-tab"
import { ValidateTab } from "./validate-tab"
import { ResultsTab } from "./results-tab"
import { DetailDialog } from "./detail-dialog"
import type { SortField, SortDirection, ValidationResult } from "../model/types"
import Papa from "papaparse"

export const CsvValidator = () => {
  const [activeTab, setActiveTab] = useState<string>("upload")
  const [sortField, setSortField] = useState<SortField>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)
  const [selectedResult, setSelectedResult] = useState<ValidationResult | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState<boolean>(false)
  const [isClient, setIsClient] = useState(false)
  const { toast } = useToast()

  const {
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
  } = useCsvValidator()

  useEffect(() => {
    setIsClient(true)
  }, [])

  // 파일 업로드 핸들러
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError("")
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      const fileExtension = selectedFile.name.split(".").pop()?.toLowerCase()
      if (fileExtension !== "csv") {
        setError("CSV 파일만 업로드 가능합니다.")
        return
      }
      setFile(selectedFile)
      parseCSV(selectedFile)
      setActiveTab("validate")
    }
  }

  // 열 매핑 변경 핸들러
  const handleColumnMappingChange = (field: keyof typeof columnMapping, column: string) => {
    setColumnMapping(prev => ({
      ...prev,
      [field]: column,
    }))
  }

  // 매핑 확인 핸들러
  const confirmMapping = () => {
    if (!columnMapping.title || !columnMapping.isbn || !columnMapping.price || !columnMapping.author) {
      toast({
        title: "필드 매핑 필요",
        description: "도서명, ISBN, 가격, 작가명 필드를 모두 매핑해주세요.",
        variant: "destructive",
      })
      return
    }

    setMappingComplete(true)
    setActiveTab("results")
    validateData() // 매핑 완료 후 자동으로 검증 시작
  }

  // 데이터 검증 함수
  const handleValidateData = async () => {
    await validateData()
    setActiveTab("results")
  }

  // 정렬 처리 함수
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === "asc") {
        setSortDirection("desc")
      } else if (sortDirection === "desc") {
        setSortField(null)
        setSortDirection(null)
      } else {
        setSortDirection("asc")
      }
    } else {
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
        // 상태 우선순위: 일치(4) > 데이터 불일치(3) > ISBN 없음(2) > API 오류(1)
        if (a.isValid) valueA = 4
        else if (!a.isValid && !a.error && !a.notFound) valueA = 3
        else if (a.notFound) valueA = 2
        else valueA = 1

        if (b.isValid) valueB = 4
        else if (!b.isValid && !b.error && !b.notFound) valueB = 3
        else if (b.notFound) valueB = 2
        else valueB = 1
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

  // 결과 다운로드
  const downloadResultsCSV = () => {
    if (results.length === 0) return

    const csvData = results.map(result => {
      const original = result.original
      const resultObj: any = {
        검증결과: result.isValid ? "일치" : "불일치",
        오류메시지: result.error || "",
      }

      if (columnMapping.title) resultObj["원본_도서명"] = original[columnMapping.title] || ""
      if (columnMapping.isbn) resultObj["원본_ISBN"] = original[columnMapping.isbn] || ""
      if (columnMapping.price) resultObj["원본_가격"] = original[columnMapping.price] || ""
      if (columnMapping.author) resultObj["원본_작가명"] = original[columnMapping.author] || ""

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

    const csv = Papa.unparse(csvData)
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

          {activeTab === "upload" && <UploadTab file={file} error={error} onFileUpload={handleFileUpload} />}

          {activeTab === "validate" && (
            <ValidateTab
              csvData={csvData}
              columnMapping={columnMapping}
              availableColumns={availableColumns}
              mappingComplete={mappingComplete}
              loading={loading}
              progress={progress}
              error={error}
              onColumnMappingChange={handleColumnMappingChange}
              onConfirmMapping={confirmMapping}
              onValidateData={handleValidateData}
            />
          )}

          {activeTab === "results" && (
            <ResultsTab
              results={sortedResults}
              loading={loading}
              progress={progress}
              csvData={csvData}
              columnMapping={columnMapping}
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
              onShowDetails={showDetails}
              onDownloadResults={downloadResultsCSV}
              onNewUpload={() => setActiveTab("upload")}
            />
          )}

          <DetailDialog
            open={detailDialogOpen}
            onOpenChange={setDetailDialogOpen}
            selectedResult={selectedResult}
            columnMapping={columnMapping}
          />
        </>
      ) : (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}
    </div>
  )
}
