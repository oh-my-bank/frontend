export type Role = 'CUSTOMER' | 'REVIEWER' | 'ADMIN'
export interface User {
  id: string
  email: string
  name: string
  role: Role
}
export interface Product {
  id: string
  name: string
  description: string
  policyVersion: number
  annualInterestRate: string
  minAmount: number
  maxAmount: number
  minTermMonths: number
  maxTermMonths: number
  repaymentMethod: 'EQUAL_PRINCIPAL_AND_INTEREST'
}
export interface LoanApplication {
  id: string
  productId: string
  productName: string
  policyVersion: number
  requestedAmount: number
  termMonths: number
  annualInterestRate: string
  status: string
  createdAt: string
  /** Mock review result, present only once a reviewer approved or rejected the application. */
  decision?: ApplicationDecision | null
}
export interface ApplicationDecision {
  result: 'APPROVED' | 'REJECTED'
  decidedAt: string
  approvedTerms: { amount: number; termMonths: number; annualInterestRate: string } | null
  reasonCode: string | null
  reasonMessage: string | null
  notice: string
}
export interface ApplicationInput {
  productId: string
  requestedAmount: number
  termMonths: number
  annualIncome: number
}
export interface PolicyTerms {
  annualInterestRate: string
  minAmount: number
  maxAmount: number
  minTermMonths: number
  maxTermMonths: number
  repaymentMethod: 'EQUAL_PRINCIPAL_AND_INTEREST'
  explanationVersion: string
}
export interface PolicyVersion extends PolicyTerms {
  version: number
  createdAt: string
}
export interface AdminProduct {
  id: string
  name: string
  description: string
  active: boolean
  createdAt: string
  deactivatedAt: string | null
  /** Current name and description version; edits append a new version. */
  detailVersion: number
  currentPolicy: PolicyVersion
}
export interface ProductInput {
  name: string
  description: string
  policy: PolicyTerms
}
