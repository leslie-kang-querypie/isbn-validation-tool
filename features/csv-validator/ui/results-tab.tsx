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
import { useState, useEffect, useMemo, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"

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
  const [activeFilter, setActiveFilter] = useState<FilterType>("all")
  const router = useRouter()
  const searchParams = useSearchParams()

  // URL 쿼리 파라미터에서 필터 상태 복원
  useEffect(() => {
    const filters = searchParams.get("filters")
    if (filters) {
      setActiveFilter(filters.split(",")[0] as FilterType)
    } else {
      setActiveFilter("all")
    }
  }, [searchParams])

  // 필터 상태가 변경될 때 URL 업데이트
  useEffect(() => {
    const params = new URLSearchParams(searchParams)
    if (activeFilter) {
      params.set("filters", activeFilter)
    } else {
      params.delete("filters")
    }
    router.push(`?${params.toString()}`)
  }, [activeFilter, router, searchParams])

  const getValidCount = () => {
    return results.filter(r => r.isValid).length
  }

  const getInvalidCount = () => {
    return results.filter(r => !r.isValid).length
  }

  const getFilteredResults = () => {
    if (activeFilter === "all") return results

    return results.filter(result => {
      return activeFilter === "valid"
        ? result.isValid
        : activeFilter === "invalid"
        ? !result.isValid && !result.error && !result.notFound
        : activeFilter === "notFound"
        ? result.notFound
        : activeFilter === "error"
        ? result.error && !result.notFound
        : false
    })
  }

  const filteredResults = useMemo(() => {
    switch (activeFilter) {
      case "all":
        return results
      case "valid":
        return results.filter(r => r.isValid)
      case "invalid":
        return results.filter(r => !r.isValid && !r.notFound && !r.error)
      case "notFound":
        return results.filter(r => r.notFound)
      case "error":
        return results.filter(r => r.error && !r.notFound)
      default:
        return results
    }
  }, [results, activeFilter])

  const sortedResults = useMemo(() => {
    if (!sortField || !sortDirection) return filteredResults
    return [...filteredResults].sort((a, b) => {
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
      if (sortDirection === "asc") {
        return valueA > valueB ? 1 : -1
      } else {
        return valueA < valueB ? 1 : -1
      }
    })
  }, [filteredResults, sortField, sortDirection, columnMapping])

  const showDetails = useCallback(
    (result: ValidationResult) => {
      if (!result.apiResponse || result.error) return
      onShowDetails(result)
    },
    [onShowDetails],
  )

  const filteredResultsLength = useMemo(() => filteredResults.length, [filteredResults])
  const filterStats = {
    total: results.length,
    valid: results.filter(r => r.isValid).length,
    invalid: results.filter(r => !r.isValid && !r.error && !r.notFound).length,
    notFound: results.filter(r => r.notFound).length,
    error: results.filter(r => r.error && !r.notFound).length,
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
      return <AlertCircle className="h-5 w-5 text-gray-700" aria-label="ISBN을 찾을 수 없음" />
    }

    if (!result.isValid) {
      return <AlertTriangle className="h-5 w-5 text-yellow-500" aria-label="데이터 불일치" />
    }

    return <CheckCircle className="h-5 w-5 text-green-500" aria-label="일치" />
  }

  // 필터 타입 정의
  const FILTERS = [
    { key: "all", label: "전체", color: "bg-gray-200 text-gray-800" },
    { key: "valid", label: "일치", color: "bg-green-100 text-green-800" },
    { key: "invalid", label: "불일치", color: "bg-yellow-100 text-yellow-800" },
    { key: "notFound", label: "ISBN 없음", color: "bg-gray-100 text-gray-800" },
    { key: "error", label: "API 오류", color: "bg-red-100 text-red-800" },
  ] as const
  type FilterType = (typeof FILTERS)[number]["key"]

  // 필터 버튼 렌더링 함수
  const renderFilterButton = (filter: (typeof FILTERS)[number]) => (
    <button
      key={filter.key}
      className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors
        ${activeFilter === filter.key ? "bg-primary text-white" : "bg-gray-100 text-gray-900 hover:bg-gray-200"}`}
      onClick={() => setActiveFilter(filter.key)}
      type="button"
    >
      <span>{filter.label}</span>
      <span className={`${filter.color} rounded-full px-2 py-0.5 text-xs`}>
        {filter.key === "all"
          ? results.length
          : filter.key === "valid"
          ? filterStats.valid
          : filter.key === "invalid"
          ? filterStats.invalid
          : filter.key === "notFound"
          ? filterStats.notFound
          : filterStats.error}
      </span>
    </button>
  )

  return (
    <Card className="toss-card">
      <CardContent className="p-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
          <div>
            <h2 className="text-xl font-bold mb-1">검증 결과</h2>
            <p className="text-gray-500 text-sm">
              총 {results.length}개 항목 중<span className="ml-1 text-green-600 font-semibold">{getValidCount()}</span>개
              일치,
              <span className="ml-1 text-red-600 font-semibold">{getInvalidCount()}</span>개 불일치
            </p>
          </div>
          <div className="flex gap-2 mt-4 md:mt-0">
            <Button onClick={onDownloadResults} className="toss-button-outline px-5 py-2.5 flex items-center gap-2">
              <Download className="h-4 w-4" />
              CSV 다운로드
            </Button>
            <Button onClick={onNewUpload} className="toss-button-primary px-5 py-2.5">
              새 파일 업로드
            </Button>
          </div>
        </div>

        {/* 필터링 UI */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-gray-500" />
            <h3 className="text-sm font-medium text-gray-700">필터</h3>
          </div>
          <div className="flex flex-wrap gap-2">{FILTERS.map(renderFilterButton)}</div>
        </div>

        {/* 필터링된 결과 통계 */}
        {activeFilter !== "all" && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">필터링된 결과:</span>
                <span className="text-sm text-gray-600">{filteredResultsLength}개</span>
              </div>
              {activeFilter === "valid" && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">일치:</span>
                  <span className="text-sm text-gray-600">{filterStats.valid}개</span>
                </div>
              )}
              {activeFilter === "invalid" && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">데이터 불일치:</span>
                  <span className="text-sm text-gray-600">{filterStats.invalid}개</span>
                </div>
              )}
              {activeFilter === "notFound" && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">ISBN 없음:</span>
                  <span className="text-sm text-gray-600">{filterStats.notFound}개</span>
                </div>
              )}
              {activeFilter === "error" && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">API 오류:</span>
                  <span className="text-sm text-gray-600">{filterStats.error}개</span>
                </div>
              )}
            </div>
          </div>
        )}

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
                {sortedResults.length > 0 ? (
                  sortedResults.map((result, index) => {
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
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={columnMapping.author ? 6 : 5} className="text-center py-8 text-gray-500">
                      {activeFilter === "all" ? "검증 결과가 없습니다." : "선택한 필터에 해당하는 결과가 없습니다."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// 필터 버튼 컴포넌트
const FilterButton = ({
  label,
  count,
  isActive,
  onClick,
  color,
  pill = true,
  countBg,
  countText,
  className = "",
}: {
  label: string
  count: number
  isActive: boolean
  onClick: () => void
  color: string // tailwind 색상
  pill?: boolean
  countBg: string
  countText: string
  className?: string
}) => {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-6 py-2 ${
        pill ? "rounded-full" : "rounded-md"
      } text-base font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 select-none
        ${isActive ? color : "bg-gray-50 text-gray-700 hover:bg-gray-100"} ${className}`}
      style={{ boxShadow: "none" }}
    >
      <span>{label}</span>
      <span className={`ml-1 px-2 py-0.5 rounded-full text-sm font-semibold ${countBg} ${countText}`}>{count}</span>
    </button>
  )
}
