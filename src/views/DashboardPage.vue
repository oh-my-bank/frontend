<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { auth } from '../stores/auth'
import { request } from '../lib/api'
import { dateTime, statusLabel, won } from '../lib/format'
import type { LoanApplication, Product } from '../types'
import AppIcon from '../components/AppIcon.vue'
import ErrorNotice from '../components/ErrorNotice.vue'
import ProductCard from '../components/ProductCard.vue'
const applications = ref<LoanApplication[]>([])
const products = ref<Product[]>([])
const pending = ref(true)
const error = ref<unknown>(null)
const inReview = computed(
  () =>
    applications.value.filter((item) => ['APPLIED', 'UNDER_REVIEW'].includes(item.status)).length,
)
const approved = computed(
  () => applications.value.filter((item) => item.status === 'APPROVED').length,
)
async function load() {
  pending.value = true
  error.value = null
  try {
    const productResult = request<{ items: Product[] }>('/loan-products')
    const applicationResult =
      auth.user?.role === 'CUSTOMER'
        ? request<{ items: LoanApplication[] }>('/loan-applications')
        : Promise.resolve({ items: [] as LoanApplication[] })
    const [p, a] = await Promise.all([productResult, applicationResult])
    products.value = p.items
    applications.value = a.items
  } catch (cause) {
    error.value = cause
  } finally {
    pending.value = false
  }
}
onMounted(load)
</script>
<template>
  <section class="page-heading">
    <div>
      <span class="eyebrow">MY OVERVIEW</span>
      <h1>{{ auth.user?.name }}님, 반가워요<span class="heading-dot">.</span></h1>
      <p>오늘도 차근차근, 나의 금융 흐름을 알아가요.</p>
    </div>
    <span class="simulation-pill"><span class="live-dot"></span>SIMULATION MODE</span>
  </section>
  <ErrorNotice :error="error" /><button v-if="error" class="text-button retry-button" @click="load">
    다시 불러오기
  </button>
  <div v-if="auth.user?.role !== 'CUSTOMER'" class="info-banner">
    직원 계정으로 로그인했습니다. 현재 고객 신청 기능까지 제공하며, 심사·상품 관리 기능은 다음
    단계에서 연결합니다. <RouterLink to="/staff">직원 업무 범위 확인 →</RouterLink>
  </div>
  <section class="journey-banner">
    <div>
      <span class="tiny-label">ONE STEP AT A TIME</span>
      <h2>나에게 맞는 상품부터,<br />첫 금융 여정을 시작해 보세요.</h2>
      <p>실제 돈은 움직이지 않아요. 경험과 이해만 쌓이죠.</p>
      <RouterLink class="button button-lime" to="/products"
        >금융상품 둘러보기<AppIcon name="arrow" :size="18"
      /></RouterLink>
    </div>
    <div class="journey-illustration" aria-hidden="true">
      <div class="mini-card card-back">
        <span>FINANCIAL<br />CONFIDENCE</span>
      </div>
      <div class="mini-card card-front">
        <span>oh my bank.</span>
        <div class="mini-card-chip"></div>
        <strong>나의 첫 금융 경험</strong><small>EVERY STEP COUNTS</small>
      </div>
      <div class="spark">✳</div>
    </div>
  </section>
  <section class="stats-grid" aria-label="나의 신청 현황" :aria-busy="pending">
    <div class="stat-card">
      <div class="stat-top"><span>전체 신청</span><AppIcon name="document" /></div>
      <strong>{{ pending || error ? '—' : applications.length }}<small>건</small></strong>
      <p>접수된 나의 대출 신청</p>
    </div>
    <div class="stat-card">
      <div class="stat-top"><span>심사 대기·진행</span><AppIcon name="clock" /></div>
      <strong>{{ pending || error ? '—' : inReview }}<small>건</small></strong>
      <p>신청 완료 및 심사 중인 건</p>
    </div>
    <div class="stat-card">
      <div class="stat-top"><span>심사 승인</span><AppIcon name="check" /></div>
      <strong>{{ pending || error ? '—' : approved }}<small>건</small></strong>
      <p>승인 결과가 등록된 건</p>
    </div>
  </section>
  <section class="section-block">
    <div class="section-heading">
      <div>
        <h2>
          나의 신청 내역<span class="count-tag">{{
            pending || error ? '—' : applications.length
          }}</span>
        </h2>
        <p>접수부터 결과까지, 진행 상황을 확인하세요.</p>
      </div>
    </div>
    <div v-if="pending" class="empty-state" role="status">신청 내역을 불러오고 있어요…</div>
    <div v-else-if="error" class="empty-state">서버에 연결되면 나의 신청 내역이 표시됩니다.</div>
    <div v-else-if="applications.length === 0" class="empty-state">
      <span class="empty-icon"><AppIcon name="document" :size="27" /></span>
      <h3>아직 신청한 대출이 없어요.</h3>
      <p>상품의 조건을 확인하고 첫 신청을 시작해 보세요.</p>
      <RouterLink to="/products" class="text-button"
        >상품 살펴보기 <AppIcon name="arrow" :size="16"
      /></RouterLink>
    </div>
    <div v-else class="application-list">
      <RouterLink
        v-for="item in applications"
        :key="item.id"
        :to="`/applications/${item.id}`"
        class="application-row"
        ><span class="application-row-icon"><AppIcon name="document" /></span>
        <div class="application-row-name">
          <strong>{{ item.productName }}</strong
          ><small>{{ dateTime(item.createdAt) }} · {{ item.termMonths }}개월</small>
        </div>
        <strong class="application-amount">{{ won(item.requestedAmount) }}</strong
        ><span class="status-badge" :class="item.status.toLowerCase()">{{
          statusLabel(item.status)
        }}</span
        ><AppIcon name="chevron" :size="18"
      /></RouterLink>
    </div>
  </section>
  <section v-if="products.length" class="section-block">
    <div class="section-heading">
      <div>
        <span class="eyebrow">FIND YOUR NEXT STEP</span>
        <h2>이런 금융상품은 어때요?</h2>
      </div>
      <RouterLink to="/products" class="text-button"
        >전체 보기 <AppIcon name="arrow" :size="16"
      /></RouterLink>
    </div>
    <div class="product-grid">
      <ProductCard
        v-for="(product, index) in products.slice(0, 3)"
        :key="product.id"
        :product="product"
        :index="index"
      />
    </div>
  </section>
  <div class="learning-note">
    <AppIcon name="shield" :size="20" />
    <p>
      Oh My Bank는 금융 업무를 배우기 위한 시뮬레이션이에요.<br /><span
        >상품 조건과 심사 결과는 가상의 규칙이며, 실제 대출 가능 여부와 관계없습니다.</span
      >
    </p>
  </div>
</template>
