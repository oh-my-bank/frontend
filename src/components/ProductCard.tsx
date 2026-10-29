import { Link } from 'react-router-dom'
import type { Product } from '../types'
import { compactWon, rate } from '../lib/format'
import AppIcon from './AppIcon'

export default function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  return (
    <Link to={`/products/${product.id}`} className="product-card">
      <div className="product-card-top">
        <span className={`product-mark mark-${index % 3}`}>
          <AppIcon name={index % 2 ? 'shield' : 'layers'} size={24} />
        </span>
        <span className="eyebrow">고정금리 · 정책 v{product.policyVersion}</span>
      </div>
      <h3>{product.name}</h3>
      <p className="muted product-description">{product.description}</p>
      <div className="product-rate">
        <span>연</span> {rate(product.annualInterestRate)}
        <span>%</span>
      </div>
      <div className="product-card-bottom">
        <div>
          <small>최대 한도</small>
          <strong>{compactWon(product.maxAmount)}</strong>
        </div>
        <span className="round-arrow">
          <AppIcon name="arrow" size={18} />
        </span>
      </div>
    </Link>
  )
}
