import { toast } from "sonner"

export interface ApiError {
  message: string
  status?: number
  code?: string
}

export class AppError extends Error {
  public readonly status: number
  public readonly code: string
  public readonly isOperational: boolean

  constructor(message: string, status = 500, code = "INTERNAL_ERROR", isOperational = true) {
    super(message)
    this.name = "AppError"
    this.status = status
    this.code = code
    this.isOperational = isOperational

    Error.captureStackTrace(this, this.constructor)
  }
}

export class NetworkError extends AppError {
  constructor(message = "네트워크 연결을 확인해주세요") {
    super(message, 0, "NETWORK_ERROR")
    this.name = "NetworkError"
  }
}

export class ApiTimeoutError extends AppError {
  constructor(message = "요청 시간이 초과되었습니다") {
    super(message, 408, "TIMEOUT_ERROR")
    this.name = "ApiTimeoutError"
  }
}

export class ValidationError extends AppError {
  constructor(message = "입력 데이터가 올바르지 않습니다") {
    super(message, 400, "VALIDATION_ERROR")
    this.name = "ValidationError"
  }
}

export class AuthenticationError extends AppError {
  constructor(message = "인증이 필요합니다") {
    super(message, 401, "AUTH_ERROR")
    this.name = "AuthenticationError"
  }
}

export class AuthorizationError extends AppError {
  constructor(message = "권한이 없습니다") {
    super(message, 403, "AUTHORIZATION_ERROR")
    this.name = "AuthorizationError"
  }
}

export class NotFoundError extends AppError {
  constructor(message = "요청한 리소스를 찾을 수 없습니다") {
    super(message, 404, "NOT_FOUND_ERROR")
    this.name = "NotFoundError"
  }
}

export function handleApiError(error: unknown): AppError {
  console.error("[v0] API Error:", error)

  if (error instanceof AppError) {
    return error
  }

  if (error instanceof TypeError && error.message.includes("fetch")) {
    return new NetworkError()
  }

  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return new ApiTimeoutError()
    }

    // Try to parse error response
    try {
      const errorData = JSON.parse(error.message)
      if (errorData.status) {
        switch (errorData.status) {
          case 400:
            return new ValidationError(errorData.message)
          case 401:
            return new AuthenticationError(errorData.message)
          case 403:
            return new AuthorizationError(errorData.message)
          case 404:
            return new NotFoundError(errorData.message)
          default:
            return new AppError(errorData.message, errorData.status)
        }
      }
    } catch {
      // Not a JSON error, continue with generic handling
    }

    return new AppError(error.message)
  }

  return new AppError("알 수 없는 오류가 발생했습니다")
}

export function showErrorToast(error: unknown) {
  const appError = handleApiError(error)

  let toastMessage = appError.message
  let duration = 4000

  switch (appError.code) {
    case "NETWORK_ERROR":
      toastMessage = "인터넷 연결을 확인해주세요"
      duration = 6000
      break
    case "TIMEOUT_ERROR":
      toastMessage = "요청 시간이 초과되었습니다. 다시 시도해주세요"
      duration = 5000
      break
    case "AUTH_ERROR":
      toastMessage = "로그인이 필요합니다"
      duration = 5000
      break
    case "AUTHORIZATION_ERROR":
      toastMessage = "접근 권한이 없습니다"
      duration = 5000
      break
    case "NOT_FOUND_ERROR":
      toastMessage = "요청한 정보를 찾을 수 없습니다"
      duration = 4000
      break
    case "VALIDATION_ERROR":
      duration = 6000
      break
  }

  toast.error(toastMessage, { duration })
}

export function showApiWarningToast(message: string) {
  toast.warning(message, {
    duration: 5000,
    description: "API 연결이 복구되면 실제 데이터가 표시됩니다.",
  })
}

export function retryWithExponentialBackoff<T>(fn: () => Promise<T>, maxRetries = 3, baseDelay = 1000): Promise<T> {
  return new Promise((resolve, reject) => {
    let retries = 0

    const attempt = async () => {
      try {
        const result = await fn()
        resolve(result)
      } catch (error) {
        retries++

        if (retries >= maxRetries) {
          reject(error)
          return
        }

        const delay = baseDelay * Math.pow(2, retries - 1)
        console.log(`[v0] Retrying in ${delay}ms (attempt ${retries}/${maxRetries})`)

        setTimeout(attempt, delay)
      }
    }

    attempt()
  })
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof NetworkError || error instanceof ApiTimeoutError) {
    return true
  }

  if (error instanceof AppError) {
    return error.status >= 500 || error.status === 0
  }

  return false
}
