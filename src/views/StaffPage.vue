<script setup lang="ts">
import AppIcon from '../components/AppIcon.vue'
</script>
<template><section class="page-heading"><div><span class="eyebrow">STAFF WORKSPACE</span><h1>직원 업무 공간<span class="heading-dot">.</span></h1><p>고객의 금융 여정과 운영의 흐름을 연결합니다.</p></div></section><section class="empty-state staff-empty"><span class="empty-icon"><AppIcon name="shield" :size="32" /></span><h2>직원 업무 기능을 준비하고 있어요.</h2><p>현재 인증과 역할 분리, 고객 상품 조회·신청 기능이 연결되어 있습니다.<br />심사 승인·거절, 상품 관리, 거래 모니터링과 감사 로그는 후속 단계입니다.</p><RouterLink to="/products" class="button button-dark">현재 상품 둘러보기 <AppIcon name="arrow" :size="18" /></RouterLink></section></template>
