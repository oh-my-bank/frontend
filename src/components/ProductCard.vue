<script setup lang="ts">
import type { Product } from '../types'
import { compactWon, rate } from '../lib/format'
import AppIcon from './AppIcon.vue'
defineProps<{ product: Product; index?: number }>()
</script>
<template>
  <RouterLink :to="`/products/${product.id}`" class="product-card">
    <div class="product-card-top"><span class="product-mark" :class="`mark-${(index ?? 0) % 3}`"><AppIcon :name="(index ?? 0) % 2 ? 'shield' : 'layers'" :size="24" /></span><span class="eyebrow">고정금리 · 정책 v{{ product.policyVersion }}</span></div>
    <h3>{{ product.name }}</h3><p class="muted product-description">{{ product.description }}</p>
    <div class="product-rate"><span>연</span> {{ rate(product.annualInterestRate) }}<span>%</span></div>
    <div class="product-card-bottom"><div><small>최대 한도</small><strong>{{ compactWon(product.maxAmount) }}</strong></div><span class="round-arrow"><AppIcon name="arrow" :size="18" /></span></div>
  </RouterLink>
</template>
