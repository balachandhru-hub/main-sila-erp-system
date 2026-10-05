export interface ErrorResponseDto {
  statusCode: number,
  message: string,
  description: string
}

export const isErrorResponse = (
  data: unknown
): data is ErrorResponseDto =>
  !!data && typeof data === 'object' && 'statusCode' in data && (data as any).statusCode >= 400;