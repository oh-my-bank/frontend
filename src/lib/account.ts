import { request } from './api'
import type { Role } from '../types'

export interface Account {
  id: string
  email: string
  name: string
  role: Role
  createdAt: string
  lastLoginAt: string | null
  previousLoginAt: string | null
  passwordChangedAt: string | null
  loginPolicy: { maxFailures: number; lockMinutes: number }
}

export interface PasswordChange {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export type PasswordField = keyof PasswordChange
export type PasswordErrors = Partial<Record<PasswordField, string>>

export const passwordFieldLabels: Record<PasswordField, string> = {
  currentPassword: '현재 비밀번호',
  newPassword: '새 비밀번호',
  confirmPassword: '새 비밀번호 확인',
}

const MIN_PASSWORD_LENGTH = 10
const MAX_PASSWORD_BYTES = 72

/** Mirrors the server's password rules so most mistakes are shown before the request; the server still decides. */
export function passwordChangeErrors(input: PasswordChange): PasswordErrors {
  const errors: PasswordErrors = {}
  if (!input.currentPassword) errors.currentPassword = '현재 비밀번호를 입력해 주세요.'
  if (input.newPassword.length < MIN_PASSWORD_LENGTH)
    errors.newPassword = `새 비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`
  else if (new TextEncoder().encode(input.newPassword).length > MAX_PASSWORD_BYTES)
    errors.newPassword = `새 비밀번호는 UTF-8 기준 ${MAX_PASSWORD_BYTES}바이트 이하여야 합니다.`
  else if (input.currentPassword && input.newPassword === input.currentPassword)
    errors.newPassword = '새 비밀번호는 현재 비밀번호와 달라야 합니다.'
  if (input.confirmPassword !== input.newPassword)
    errors.confirmPassword = '새 비밀번호와 확인 값이 같지 않습니다.'
  return errors
}

/** Keeps the server's field messages that belong to this form; other keys stay in the general notice. */
export function serverPasswordErrors(fieldErrors: Record<string, string>): PasswordErrors {
  const errors: PasswordErrors = {}
  for (const field of ['currentPassword', 'newPassword'] as const)
    if (fieldErrors[field]) errors[field] = fieldErrors[field]
  return errors
}

export const fetchAccount = (signal?: AbortSignal) =>
  request<Account>('/account', signal ? { signal } : {})

export const changePassword = (input: PasswordChange) =>
  request<Account>('/account/password', {
    method: 'POST',
    body: { currentPassword: input.currentPassword, newPassword: input.newPassword },
  })
