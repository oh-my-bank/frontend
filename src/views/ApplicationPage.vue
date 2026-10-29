<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { request } from '../lib/api'
import { dateTime, rate, statusLabel, won } from '../lib/format'
import type { LoanApplication } from '../types'
import AppIcon from '../components/AppIcon.vue'
import ErrorNotice from '../components/ErrorNotice.vue'
const route = useRoute(); const application = ref<LoanApplication | null>(null); const pending = ref(true); const error = ref<unknown>(null)
async function load() { pending.value = true; error.value = null; try { application.value = await request<LoanApplication>(`/loan-applications/${encodeURIComponent(String(route.params.id))}`) } catch (cause) { error.value = cause } finally { pending.value = false } }
onMounted(load)
</script>
<template>
  <RouterLink to="/" class="back-link">← 내 대시보드</RouterLink><ErrorNotice :error="error" /><button v-if="error" class="text-button" @click="load">다시 불러오기</button><div v-if="pending" class="empty-state" role="status">신청 정보를 불러오고 있어요…</div>
  <template v-if="application && !pending"><section class="confirmation-heading"><span class="success-mark"><AppIcon name="check" :size="30" /></span><span class="eyebrow">YOUR FINANCIAL JOURNEY</span><h1>신청 내역을 확인하세요<span class="heading-dot">.</span></h1><p>신청 조건과 현재 진행 상태를 한곳에서 확인할 수 있어요.</p></section><section class="application-detail-card"><div class="section-heading"><div><span class="eyebrow">APPLICATION DETAILS</span><h2>{{ application.productName }}</h2></div><span class="status-badge" :class="application.status.toLowerCase()">{{ statusLabel(application.status) }}</span></div><div class="application-principal"><small>신청 금액</small><strong>{{ won(application.requestedAmount) }}</strong></div><dl class="details-list"><div><dt>신청 번호</dt><dd class="monospace">{{ application.id }}</dd></div><div><dt>신청 시각</dt><dd>{{ dateTime(application.createdAt) }}</dd></div><div><dt>신청 기간</dt><dd>{{ application.termMonths }}개월</dd></div><div><dt>신청 당시 금리</dt><dd>연 {{ rate(application.annualInterestRate) }}%</dd></div><div><dt>상품 정책</dt><dd>v{{ application.policyVersion }} · 신청 당시 조건 보존</dd></div><div><dt>상환 방식</dt><dd>원리금균등분할상환</dd></div></dl><div class="info-banner">현재 단계에서는 신청 접수와 내역 조회를 제공합니다. 모의 심사, 약정, 대출 실행·상환은 다음 단계에서 순차적으로 연결합니다.</div><RouterLink to="/" class="button button-dark">대시보드로 돌아가기 <AppIcon name="arrow" :size="18" /></RouterLink></section></template>
</template>
