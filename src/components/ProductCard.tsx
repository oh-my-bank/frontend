import { Link } from 'react-router-dom'
import type { Product } from '../types'
import { compactWon, rate } from '../lib/format'
import AppIcon from './AppIcon'
import '../styles/banking-products.css'

export default function ProductCard({ product }: { product: Product; index?: number }) {
  return (
    <article className="bank-product-card">
      <div className="bank-product-copy">
        <span className="bank-product-tag">고정금리</span>
        <h3>
          <Link to={`/products/${product.id}`}>{product.name}</Link>
        </h3>
        <p>{product.description}</p>
      </div>
      <dl className="bank-product-metrics">
        <div className="bank-product-interest">
          <dt>대출금리</dt>
          <dd>
            <span>연</span> <strong>{rate(product.annualInterestRate)}</strong>
            <span>%</span>
          </dd>
        </div>
        <div>
          <dt>최대 한도</dt>
          <dd>{compactWon(product.maxAmount)}</dd>
        </div>
        <div>
          <dt>대출 기간</dt>
          <dd>
            {product.minTermMonths}~{product.maxTermMonths}개월
          </dd>
        </div>
      </dl>
      <div className="bank-product-actions">
        <Link
          className="button button-outline small"
          to={`/products/${product.id}`}
          aria-label={`${product.name} 상품안내`}
        >
          상품안내 <AppIcon name="chevron" size={14} />
        </Link>
        <Link
          className="button button-primary small"
          to={`/products/${product.id}#apply`}
          aria-label={`${product.name} 신청하기`}
        >
          신청하기
        </Link>
      </div>
    </article>
  )
}
