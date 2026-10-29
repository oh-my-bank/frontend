export default function ProgressSteps({ current }: { current?: 1 | 2 | 3 }) {
  const labels = ['상품 선택', '신청정보 입력', '접수 완료']
  return (
    <ol className="progress-steps" aria-label="대출 신청 단계">
      {labels.map((label, index) => (
        <li
          key={label}
          className={
            index + 1 === current ? 'current' : current && index + 1 < current ? 'complete' : ''
          }
          aria-current={index + 1 === current ? 'step' : undefined}
        >
          <span className="step-number">
            {current && index + 1 < current ? '✓' : String(index + 1).padStart(2, '0')}
          </span>
          <span>{label}</span>
        </li>
      ))}
    </ol>
  )
}
