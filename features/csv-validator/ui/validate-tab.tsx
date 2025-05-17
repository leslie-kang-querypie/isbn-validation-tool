"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertCircle, Info } from "lucide-react"
import { formatPrice } from "../lib/utils/price"
import { ColumnMapping } from "../model/types"

interface ValidateTabProps {
  csvData: any[]
  columnMapping: ColumnMapping
  availableColumns: string[]
  mappingComplete: boolean
  loading: boolean
  progress: number
  error: string | null
  onColumnMappingChange: (field: keyof ColumnMapping, column: string) => void
  onConfirmMapping: () => void
  onValidateData: () => void
}

export const ValidateTab = ({
  csvData,
  columnMapping,
  availableColumns,
  mappingComplete,
  loading,
  progress,
  error,
  onColumnMappingChange,
  onConfirmMapping,
  onValidateData,
}: ValidateTabProps) => {
  return (
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
                      onChange={e => onColumnMappingChange("title", e.target.value)}
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
                      onChange={e => onColumnMappingChange("isbn", e.target.value)}
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
                      onChange={e => onColumnMappingChange("price", e.target.value)}
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
                      onChange={e => onColumnMappingChange("author", e.target.value)}
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
                <Button onClick={onConfirmMapping} className="toss-button-primary px-6 py-2.5 w-full md:w-auto">
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
                  onClick={onValidateData}
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
  )
}
