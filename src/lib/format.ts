export const won = (value: number) =>
  new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(value)
export const compactWon = (value: number) =>
  value >= 100000000
    ? `${new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 }).format(value / 100000000)}억원`
    : `${new Intl.NumberFormat('ko-KR').format(value / 10000)}만원`
/** Exact Korean reading of a whole-won amount, e.g. 123만 4,567원. */
export const koreanWon = (value: number) => {
  const group = new Intl.NumberFormat('ko-KR')
  const parts = [
    [Math.floor(value / 100000000), '억'],
    [Math.floor((value % 100000000) / 10000), '만'],
    [value % 10000, ''],
  ] as const
  const text = parts
    .filter(([amount]) => amount > 0)
    .map(([amount, unit]) => `${group.format(amount)}${unit}`)
    .join(' ')
  return `${text || '0'}원`
}
/** Policies keep three decimal places, so the display must not round them away. */
export const rate = (value: string) =>
  Number(value).toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 3 })
export const dateTime = (value: string) =>
  new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Seoul',
  }).format(new Date(value))
export const statusLabel = (status: string) =>
  ({
    APPLIED: '신청 완료',
    UNDER_REVIEW: '심사 중',
    APPROVED: '승인 완료',
    REJECTED: '심사 거절',
    AGREED: '약정 완료',
    EXECUTED: '실행 완료',
    REPAYING: '상환 중',
    PAID_OFF: '완납',
  })[status] ?? status
export const repaymentLabel = (method: string) =>
  ({ EQUAL_PRINCIPAL_AND_INTEREST: '원리금균등분할상환' })[method] ?? method
