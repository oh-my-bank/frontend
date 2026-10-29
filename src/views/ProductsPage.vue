<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { request } from '../lib/api'
import type { Product } from '../types'
import ProductCard from '../components/ProductCard.vue'
import ErrorNotice from '../components/ErrorNotice.vue'
const products = ref<Product[]>([])
const pending = ref(true)
const error = ref<unknown>(null)
async function load() {
  pending.value = true
  error.value = null
  try {
    products.value = (await request<{ items: Product[] }>('/loan-products')).items
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
      <span class="eyebrow">EXPLORE PRODUCTS</span>
      <h1>나에게 맞는 금융상품<span class="heading-dot">.</span></h1>
      <p>금리, 한도, 기간을 비교하고 한 걸음 더 알아보세요.</p>
    </div>
    <span class="outline-tag">고정금리 · 원리금균등분할상환</span>
  </section>
  <div class="info-banner">
    가상의 상품으로 금융 흐름을 경험하세요. 실제 금융상품을 판매하거나 대출을 중개하지 않습니다.
  </div>
  <ErrorNotice :error="error" />
  <button v-if="error" class="button button-outline" @click="load">다시 불러오기</button>
  <div v-if="pending" class="empty-state" role="status">상품을 불러오고 있어요…</div>
  <div v-else-if="!error && !products.length" class="empty-state">
    <h3>등록된 상품이 없어요.</h3>
    <p>상품이 등록되면 이곳에서 확인할 수 있어요.</p>
  </div>
  <div v-else-if="products.length" class="product-grid products-page-grid">
    <ProductCard
      v-for="(product, index) in products"
      :key="product.id"
      :product="product"
      :index="index"
    />
  </div>
  <section class="how-it-works">
    <span class="eyebrow">HOW IT WORKS</span>
    <h2>금융 여정, 이렇게 이어져요.</h2>
    <div class="steps">
      <div>
        <span>01</span><strong>상품 살펴보기</strong>
        <p>조건과 한도를 비교해요.</p>
      </div>
      <div>
        <span>02</span><strong>대출 신청하기</strong>
        <p>가상의 정보로 신청해요.</p>
      </div>
      <div>
        <span>03</span><strong>심사 결과 확인</strong>
        <p>다음 개발 단계에서 제공해요.</p>
      </div>
      <div>
        <span>04</span><strong>약정·실행·상환</strong>
        <p>순차적으로 연결할 예정이에요.</p>
      </div>
    </div>
  </section>
</template>
