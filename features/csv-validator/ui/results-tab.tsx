"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Download,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Filter,
} from "lucide-react"
import { formatPrice } from "../lib/utils/price"
import { ColumnMapping, ValidationResult, SortField, SortDirection } from "../model/types"
import { useState } from "react"

interface ResultsTabProps {
  results: ValidationResult[]
  loading: boolean
  progress: number
  csvData: any[]
  columnMapping: ColumnMapping
  sortField: SortField
  sortDirection: SortDirection
  onSort: (field: SortField) => void
  onShowDetails: (result: ValidationResult) => void
  onDownloadResults: () => void
  onNewUpload: () => void
}

export const ResultsTab = ({
  results,
  loading,
  progress,
  csvData,
  columnMapping,
  sortField,
  sortDirection,
  onSort,
  onShowDetails,
  onDownloadResults,
  onNewUpload,
}: ResultsTabProps) => {
  const [activeFilters, setActiveFilters] = useState<string[]>([])

  const getValidCount = () => {
    return results.filter(r => r.isValid).length
  }

  const getInvalidCount = () => {
    return results.filter(r => !r.isValid).length
  }

  const getFilteredResults = () => {
    if (activeFilters.length === 0) return results

    return results.filter(result => {
      if (activeFilters.includes("valid") && result.isValid) return true
      if (activeFilters.includes("invalid") && !result.isValid && !result.error && !result.notFound) return true
      if (activeFilters.includes("notFound") && result.notFound) return true
      if (activeFilters.includes("error") && result.error && !result.notFound) return true
      return false
    })
  }

  const toggleFilter = (filter: string) => {
    setActiveFilters(prev => (prev.includes(filter) ? prev.filter(f => f !== filter) : [...prev, filter]))
  }

  // 정렬 아이콘 표시
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 inline ml-1 text-gray-400" />
    }

    if (!sortDirection) {
      return <ArrowUpDown className="h-4 w-4 inline ml-1 text-gray-400" />
    }

    return sortDirection === "asc" ? (
      <ChevronUp className="h-4 w-4 inline ml-1 text-primary" />
    ) : (
      <ChevronDown className="h-4 w-4 inline ml-1 text-primary" />
    )
  }

  // 상태 아이콘 렌더링
  const renderStatusIcon = (result: ValidationResult) => {
    if (result.error && !result.notFound) {
      return <AlertCircle className="h-5 w-5 text-red-500" aria-label="API 오류" />
    }

    if (result.notFound) {
      return <AlertCircle className="h-5 w-5 text-orange-500" aria-label="ISBN을 찾을 수 없음" />
    }

    if (!result.isValid) {
      return <AlertTriangle className="h-5 w-5 text-yellow-500" aria-label="데이터 불일치" />
    }

    return <CheckCircle className="h-5 w-5 text-green-500" aria-label="일치" />
  }

  return (
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
            onClick={onDownloadResults}
            className="toss-button-outline mt-4 md:mt-0 px-5 py-2.5 flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            CSV 다운로드
          </Button>
        </div>

        {loading && (
          <div className="mb-6 bg-blue-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                <span className="font-medium">검증 진행 중...</span>
              </div>
              <span className="text-primary font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2 bg-blue-100" />
            <div className="mt-2 text-sm text-gray-600">
              {csvData.length > 0 && (
                <p>
                  현재 {results.length} / {csvData.length}개 항목 처리 완료
                </p>
              )}
            </div>
          </div>
        )}

        <div className="space-y-6">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Filter className="h-4 w-4" />
              <span>상태별 필터</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <div
                onClick={() => toggleFilter("valid")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm cursor-pointer transition-colors ${
                  activeFilters.includes("valid")
                    ? "bg-green-50 text-green-700 ring-1 ring-green-200"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                }`}
              >
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span>일치</span>
              </div>
              <div
                onClick={() => toggleFilter("invalid")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm cursor-pointer transition-colors ${
                  activeFilters.includes("invalid")
                    ? "bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                }`}
              >
                <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                <span>데이터 불일치</span>
              </div>
              <div
                onClick={() => toggleFilter("notFound")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm cursor-pointer transition-colors ${
                  activeFilters.includes("notFound")
                    ? "bg-orange-50 text-orange-700 ring-1 ring-orange-200"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                }`}
              >
                <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                <span>ISBN 없음</span>
              </div>
              <div
                onClick={() => toggleFilter("error")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm cursor-pointer transition-colors ${
                  activeFilters.includes("error")
                    ? "bg-red-50 text-red-700 ring-1 ring-red-200"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                }`}
              >
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                <span>API 오류</span>
              </div>
            </div>
          </div>

          <div className="border border-gray-100 rounded-lg overflow-hidden bg-white shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="w-[50px] font-medium">번호</TableHead>
                  {columnMapping.title && (
                    <TableHead
                      className="cursor-pointer font-medium w-[30%] hover:text-primary transition-colors"
                      onClick={() => onSort("title")}
                    >
                      도서명 {renderSortIcon("title")}
                    </TableHead>
                  )}
                  <TableHead
                    className="cursor-pointer font-medium hover:text-primary transition-colors"
                    onClick={() => onSort("isbn")}
                  >
                    ISBN {renderSortIcon("isbn")}
                  </TableHead>
                  <TableHead
                    className="cursor-pointer font-medium hover:text-primary transition-colors"
                    onClick={() => onSort("price")}
                  >
                    가격 {renderSortIcon("price")}
                  </TableHead>
                  {columnMapping.author && (
                    <TableHead
                      className="cursor-pointer font-medium hover:text-primary transition-colors"
                      onClick={() => onSort("author")}
                    >
                      작가명 {renderSortIcon("author")}
                    </TableHead>
                  )}
                  <TableHead
                    className="cursor-pointer font-medium hover:text-primary transition-colors"
                    onClick={() => onSort("status")}
                  >
                    결과 {renderSortIcon("status")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {getFilteredResults().map((result, index) => {
                  const hasApiResponse = result.apiResponse && !result.notFound
                  const isDisabled = !hasApiResponse || (result.error && !result.notFound)

                  return (
                    <TableRow
                      key={index}
                      className={`hover:bg-gray-50 ${isDisabled ? "bg-gray-100 opacity-70" : "cursor-pointer"}`}
                      onClick={() => (isDisabled ? null : onShowDetails(result))}
                    >
                      <TableCell>{index + 1}</TableCell>
                      {columnMapping.title && (
                        <TableCell className="truncate max-w-[200px]">
                          <div className="flex items-center gap-2">
                            <span
                              className="truncate"
                              title={hasApiResponse ? result.apiResponse.title : result.original[columnMapping.title]}
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
                      <TableCell className={result.matchDetails?.isbn ? "text-green-600 font-medium" : "text-red-600"}>
                        {hasApiResponse ? result.apiResponse.isbn : result.original[columnMapping.isbn]}
                      </TableCell>
                      <TableCell className={result.matchDetails?.discount ? "text-green-600 font-medium" : "text-red-600"}>
                        {hasApiResponse
                          ? formatPrice(result.apiResponse.discount)
                          : formatPrice(result.original[columnMapping.price])}
                      </TableCell>
                      {columnMapping.author && (
                        <TableCell className={result.matchDetails?.author ? "text-green-600 font-medium" : "text-red-600"}>
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
            <Button onClick={onNewUpload} className="toss-button-primary px-6 py-2.5">
              새 파일 업로드
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
