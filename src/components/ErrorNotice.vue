<script setup lang="ts">
import { ApiError, errorMessage } from '../lib/api'
defineProps<{ error: unknown }>()
</script>
<template><div v-if="error" class="error-notice" role="alert"><strong>요청을 확인해 주세요</strong><p>{{ errorMessage(error) }}</p><small v-if="error instanceof ApiError && error.traceId">오류 추적 ID · {{ error.traceId }}</small></div></template>
