import { ApiError, request } from './api'

/** The phrase the server requires in `confirm`; typing it is the customer's explicit intent. */
export const WITHDRAWAL_CONFIRM_PHRASE = 'WITHDRAW'

export interface WithdrawalInput {
  currentPassword: string
  confirm: string
}

export type WithdrawalField = keyof WithdrawalInput
export type WithdrawalErrors = Partial<Record<WithdrawalField, string>>

export interface WithdrawalResult {
  status: 'WITHDRAWN'
  withdrawnAt: string
  deleted: { strategySaves: number; learningProgress: number; requestRecords: number }
  simulationClosed: boolean
  retainedLoanApplications: number
}

/** What happens to each kind of data, shown before the customer confirms (L08 table, summarized). */
export const withdrawalEffects = {
  deleted: [
    '이메일·이름·비밀번호(암호화 값)와 로그인 시각 — 계정에서 지우고 식별할 수 없는 값으로 바꿉니다.',
    '저장한 전략(입력한 소득·지출·자산 등)과 학습 진도·확인 문제 기록',
    '로그인 실패 기록과 중복 요청 방지용 요청 기록',
    '이 계정의 모든 로그인(다른 기기·브라우저 포함)',
  ],
  retained: [
    '대출 신청·심사·약정·대출·거래원장·납부 기록 — 거래 기록의 무결성을 위해 지우지 않고, 누구의 기록인지 알 수 없는 탈퇴 회원 기록으로 남습니다.',
    '모의 운용 기록 — 진행 중이면 종료하고, 가상 거래·이벤트는 탈퇴 회원 기록으로 남습니다.',
    '약관 동의 이력과 감사 기록 — 언제 무엇이 처리됐는지 증명하는 기록으로, 회원 번호만 남고 이메일·이름은 들어 있지 않습니다.',
  ],
} as const

/** Mirrors the server checks so the dialog opens only for a request that can succeed; the server still decides. */
export function withdrawalErrors(input: WithdrawalInput): WithdrawalErrors {
  const errors: WithdrawalErrors = {}
  if (!input.currentPassword) errors.currentPassword = '현재 비밀번호를 입력해 주세요.'
  if (input.confirm !== WITHDRAWAL_CONFIRM_PHRASE)
    errors.confirm = `확인 문구로 ${WITHDRAWAL_CONFIRM_PHRASE}를 정확히 입력해 주세요.`
  return errors
}

/** Keeps the server's field messages that belong to this form. */
export function serverWithdrawalErrors(fieldErrors: Record<string, string>): WithdrawalErrors {
  const errors: WithdrawalErrors = {}
  for (const field of ['currentPassword', 'confirm'] as const)
    if (fieldErrors[field]) errors[field] = fieldErrors[field]
  return errors
}

/** Explains a failed withdrawal. Null keeps the server message as it is. */
export function withdrawalErrorMessage(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null
  switch (error.code) {
    case 'WITHDRAWAL_BLOCKED_ACTIVE_LOAN':
      return `${error.message} 납부 기록이 없는 대출은 대출 상세 화면에서 철회할 수 있습니다.`
    case 'LOGIN_LOCKED':
      return `${error.message} 제한이 끝날 때까지 탈퇴할 수 없습니다.`
    case 'NETWORK_ERROR':
      return '서버 응답을 받지 못했습니다. 탈퇴가 이미 처리됐을 수 있으니 페이지를 새로 고쳐 로그인 상태를 확인해 주세요.'
    case 'AUTHENTICATION_REQUIRED':
      return '로그인이 끝났습니다. 이미 탈퇴가 처리됐거나 로그인 시간이 지났습니다.'
    default:
      return null
  }
}

/** The notice shown on the home page after the session ended. */
export function withdrawalNotice(result: WithdrawalResult): string {
  const parts = ['회원 탈퇴가 처리되어 로그아웃되었습니다.']
  if (result.retainedLoanApplications > 0)
    parts.push(
      `대출 신청 ${result.retainedLoanApplications}건의 기록은 거래 기록 보존을 위해 누구의 것인지 알 수 없는 상태로 남았습니다.`,
    )
  parts.push('같은 이메일로 다시 가입할 수 있으며, 이전 기록은 새 계정에 연결되지 않습니다.')
  return parts.join(' ')
}

export const withdrawAccount = (input: WithdrawalInput) =>
  request<WithdrawalResult>('/account/withdrawal', {
    method: 'POST',
    body: { currentPassword: input.currentPassword, confirm: input.confirm },
  })
