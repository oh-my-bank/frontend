import { Link } from 'react-router-dom'
export default function BrandLogo({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="brand" aria-label="Oh My Bank 홈">
      <span className="brand-symbol">
        <i />
        <i />
      </span>
      <span>
        oh my bank<span className="brand-dot">.</span>
      </span>
    </Link>
  )
}
