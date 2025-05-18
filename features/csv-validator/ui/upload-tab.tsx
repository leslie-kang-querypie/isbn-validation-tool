"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Upload, FileUp, CheckCircle, AlertCircle, Info } from "lucide-react"

interface UploadTabProps {
  file: File | null
  error: string
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export const UploadTab = ({ file, error, onFileUpload }: UploadTabProps) => {
  return (
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
                CSV 파일에는 다음 열이 포함되어야 합니다: <b>도서명, ISBN, 가격, 작가명.</b>
              </p>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-lg p-12 mb-6">
            <Upload className="h-12 w-12 text-gray-400 mb-4" />
            <div className="flex flex-col items-center text-center mb-6">
              <h3 className="font-medium mb-1">CSV 파일을 여기에 드래그하거나 클릭하여 업로드하세요</h3>
              <p className="text-sm text-gray-500">CSV 파일만 지원됩니다</p>
            </div>
            <Input id="file-upload" type="file" accept=".csv" className="hidden" onChange={onFileUpload} />
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
  )
}
