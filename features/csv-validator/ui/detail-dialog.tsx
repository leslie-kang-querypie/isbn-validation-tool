"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { ExternalLink, AlertCircle } from "lucide-react"
import { formatPrice } from "../lib/utils/price"
import { formatPubDate } from "../lib/utils/date"
import { ColumnMapping, ValidationResult } from "../model/types"

interface DetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedResult: ValidationResult | null
  columnMapping: ColumnMapping
}

export const DetailDialog = ({ open, onOpenChange, selectedResult, columnMapping }: DetailDialogProps) => {
  if (!selectedResult) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 rounded-lg overflow-hidden">
        <div className="bg-primary p-5">
          <DialogHeader>
            <DialogTitle className="text-lg text-white">도서 상세 정보</DialogTitle>
            <div className="mt-2">
              {selectedResult.isValid ? (
                <span className="toss-badge-success">일치</span>
              ) : selectedResult.notFound ? (
                <span className="toss-badge-error">ISBN 없음</span>
              ) : (
                <span className="toss-badge-error">불일치</span>
              )}
            </div>
          </DialogHeader>
        </div>

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
                    <span className="detail-item-value">{formatPrice(selectedResult.original[columnMapping.price])}원</span>
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
      </DialogContent>
    </Dialog>
  )
}
