<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { auth } from '../stores/auth'
import { request } from '../lib/api'
import { createApplicationRequest } from '../lib/idempotency'
import { compactWon, rate, won } from '../lib/format'
import type { ApplicationInput, LoanApplication, Product } from '../types'
import AppIcon from '../components/AppIcon.vue'
import ErrorNotice from '../components/ErrorNotice.vue'
const route = useRoute()
const router = useRouter()
const product = ref<Product | null>(null)
const pending = ref(true)
const submitting = ref(false)
const error = ref<unknown>(null)
const submitError = ref<unknown>(null)
const amount = ref<number | ''>('')
const months = ref<number | ''>('')
const income = ref<number | ''>('')
const acknowledged = ref(false)
const identity = createApplicationRequest()
const valid = computed(
  () =>
    product.value &&
    Number.isSafeInteger(amount.value) &&
    Number(amount.value) >= product.value.minAmount &&
    Number(amount.value) <= product.value.maxAmount &&
    Number.isSafeInteger(months.value) &&
    Number(months.value) >= product.value.minTermMonths &&
    Number(months.value) <= product.value.maxTermMonths &&
    Number.isSafeInteger(income.value) &&
    Number(income.value) >= 0 &&
    Number(income.value) <= 100000000000 &&
    acknowledged.value,
)
async function load() {
  pending.value = true
  error.value = null
  try {
    product.value = await request<Product>(
      `/loan-products/${encodeURIComponent(String(route.params.id))}`,
    )
    months.value = product.value.minTermMonths
  } catch (cause) {
    error.value = cause
  } finally {
    pending.value = false
  }
}
async function submit() {
  if (!valid.value || !product.value || submitting.value || auth.user?.role !== 'CUSTOMER') return
  submitting.value = true
  submitError.value = null
  const body: ApplicationInput = {
    productId: product.value.id,
    requestedAmount: Number(amount.value),
    termMonths: Number(months.value),
    annualIncome: Number(income.value),
  }
  try {
    const result = await request<LoanApplication>('/loan-applications', {
      method: 'POST',
      body,
      idempotencyKey: identity.keyFor(body),
    })
    identity.clear()
    await router.push(`/applications/${result.id}`)
  } catch (cause) {
    submitError.value = cause
  } finally {
    submitting.value = false
  }
}
onMounted(load)
</script>
<template>
  <RouterLink to="/products" class="back-link">← 금융상품 목록</RouterLink
  ><ErrorNotice :error="error" /><button v-if="error" class="text-button" @click="load">
    다시 불러오기
  </button>
  <div v-if="pending" class="empty-state" role="status">상품 정보를 불러오고 있어요…</div>
  <template v-if="product && !pending"
    ><section class="page-heading">
      <div>
        <span class="eyebrow">A STEP TOWARD UNDERSTANDING</span>
        <h1>{{ product.name }}<span class="heading-dot">.</span></h1>
        <p>{{ product.description }}</p>
      </div>
      <span class="outline-tag">정책 v{{ product.policyVersion }}</span>
    </section>
    <div class="detail-grid">
      <section class="product-detail">
        <div class="detail-hero">
          <span class="pill pill-outline">가상 금융상품 · 고정금리</span>
          <p>연 이자율</p>
          <div class="detail-rate">{{ rate(product.annualInterestRate) }}<span>%</span></div>
          <span>나에게 맞는 조건을 천천히 확인해 보세요.</span>
        </div>
        <dl class="details-list">
          <div>
            <dt>대출 한도</dt>
            <dd>{{ compactWon(product.minAmount) }} ~ {{ compactWon(product.maxAmount) }}</dd>
          </div>
          <div>
            <dt>대출 기간</dt>
            <dd>{{ product.minTermMonths }} ~ {{ product.maxTermMonths }}개월</dd>
          </div>
          <div>
            <dt>상환 방식</dt>
            <dd>원리금균등분할상환</dd>
          </div>
          <div>
            <dt>적용 금리</dt>
            <dd>연 {{ rate(product.annualInterestRate) }}% · 고정금리</dd>
          </div>
        </dl>
        <div class="detail-notice">
          <AppIcon name="shield" :size="20" />
          <p>
            본 상품은 학습용 가상 상품입니다. 입력된 소득정보는 모의 심사에만 사용하며, 실제 대출
            가능 여부를 판단하지 않습니다.
          </p>
        </div>
      </section>
      <section class="form-card">
        <span class="eyebrow">YOUR APPLICATION</span>
        <h2>대출 신청하기</h2>
        <p class="muted">희망하는 조건을 입력해 주세요.</p>
        <div v-if="!auth.user" class="empty-state compact">
          <h3>로그인 후 신청할 수 있어요.</h3>
          <RouterLink
            :to="{ path: '/login', query: { redirect: route.fullPath } }"
            class="button button-dark"
            >로그인하기 <AppIcon name="arrow" :size="16"
          /></RouterLink>
        </div>
        <div v-else-if="auth.user.role !== 'CUSTOMER'" class="info-banner">
          대출 신청은 고객 계정으로 이용해 주세요.
        </div>
        <form v-else @submit.prevent="submit" class="stack-form">
          <ErrorNotice :error="submitError" />
          <fieldset :disabled="submitting" class="form-fieldset">
            <label
              >신청 금액<span class="input-unit"
                ><input
                  v-model.number="amount"
                  type="number"
                  :min="product.minAmount"
                  :max="product.maxAmount"
                  step="1"
                  required
                  placeholder="희망 금액 입력"
                  inputmode="numeric"
                /><span>원</span></span
              ><small>{{ won(product.minAmount) }} ~ {{ won(product.maxAmount) }}</small></label
            ><label
              >대출 기간<span class="input-unit"
                ><input
                  v-model.number="months"
                  type="number"
                  :min="product.minTermMonths"
                  :max="product.maxTermMonths"
                  step="1"
                  required
                  inputmode="numeric"
                /><span>개월</span></span
              ><small
                >{{ product.minTermMonths }} ~ {{ product.maxTermMonths }}개월 중 선택</small
              ></label
            ><label
              >가상 연 소득<span class="input-unit"
                ><input
                  v-model.number="income"
                  type="number"
                  min="0"
                  max="100000000000"
                  step="1"
                  required
                  placeholder="테스트용 연 소득 입력"
                  inputmode="numeric"
                /><span>원</span></span
              ><small>실제 소득 대신 가상의 금액을 입력해 주세요.</small></label
            ><label class="checkbox-label"
              ><input v-model="acknowledged" type="checkbox" required /><span
                >학습용 가상 신청이며, 입력한 상품 조건과 시뮬레이션 안내를 확인했습니다.</span
              ></label
            ><button class="button button-dark full" :disabled="!valid || submitting">
              {{ submitting ? '신청 접수 중…' : '이 조건으로 신청하기'
              }}<AppIcon name="arrow" :size="18" />
            </button>
          </fieldset>
          <p class="form-help">
            신청 이후 심사 결과에 따라 최종 조건이 달라질 수 있습니다. 재시도는 동일한 요청 키로
            처리합니다.
          </p>
        </form>
      </section>
    </div></template
  >
</template>
