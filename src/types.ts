export type Role = 'CUSTOMER' | 'REVIEWER' | 'ADMIN'
export interface User { id: string; email: string; name: string; role: Role }
export interface Product {
  id: string; name: string; description: string; policyVersion: number;
  annualInterestRate: string; minAmount: number; maxAmount: number;
  minTermMonths: number; maxTermMonths: number; repaymentMethod: 'EQUAL_PRINCIPAL_AND_INTEREST'
}
export interface LoanApplication {
  id: string; productId: string; productName: string; policyVersion: number;
  requestedAmount: number; termMonths: number; annualInterestRate: string;
  status: string; createdAt: string
}
export interface ApplicationInput { productId: string; requestedAmount: number; termMonths: number; annualIncome: number }
