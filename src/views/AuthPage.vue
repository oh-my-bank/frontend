<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { auth, login, register } from '../stores/auth'
import AppIcon from '../components/AppIcon.vue'
import ErrorNotice from '../components/ErrorNotice.vue'
const route = useRoute()
const router = useRouter()
const registering = ref(false)
const email = ref('')
const password = ref('')
const name = ref('')
const pending = ref(false)
const error = ref<unknown>(null)
function toggleMode() {
  registering.value = !registering.value
  error.value = null
}
async function submit() {
  pending.value = true
  error.value = null
  try {
    if (registering.value)
      await register({
        email: email.value.trim(),
        password: password.value,
        name: name.value.trim(),
      })
    else await login({ email: email.value.trim(), password: password.value })
    const destination =
      typeof route.query.redirect === 'string' &&
      route.query.redirect.startsWith('/') &&
      !route.query.redirect.startsWith('//')
        ? route.query.redirect
        : '/'
    await router.push(destination)
  } catch (cause) {
    error.value = cause
  } finally {
    pending.value = false
  }
}
</script>
<template>
  <div class="auth-layout">
    <section class="auth-story">
      <RouterLink to="/products" class="brand"
        ><span class="brand-symbol"><i></i><i></i></span
        ><span>oh my bank<span class="brand-dot">.</span></span></RouterLink
      >
      <div class="auth-story-content">
        <span class="pill pill-outline">YOUR FIRST FINANCIAL JOURNEY</span>
        <h1>금융의 흐름을,<br />나의 경험으로.</h1>
        <p>상품을 알아보고, 대출을 신청하고.<br />가상의 금융 생활에서 진짜 이해를 시작하세요.</p>
        <div class="auth-art" aria-hidden="true">
          <div class="art-ring ring-one"></div>
          <div class="art-ring ring-two"></div>
          <div class="art-card">
            <span>OH MY BANK</span><strong>금융을 배우는<br />새로운 시작.</strong>
            <div class="art-card-bottom"><i></i><span>SIMULATION ONLY</span></div>
          </div>
          <span class="art-star">✳</span>
        </div>
      </div>
      <p class="auth-disclaimer">
        <AppIcon name="shield" :size="16" /> 실제 자금 이동 없는 안전한 가상 환경
      </p>
    </section>
    <main id="main" class="auth-form-panel">
      <div class="auth-form-wrap">
        <span class="eyebrow">WELCOME TO OMB</span>
        <h2>{{ registering ? '새로운 시작을 함께해요.' : '다시 만나 반가워요.' }}</h2>
        <p class="muted">
          {{
            registering
              ? '가상의 정보로 테스트 계정을 만들어 주세요.'
              : '로그인하고 나의 금융 여정을 이어가세요.'
          }}
        </p>
        <div v-if="auth.error" class="info-banner">
          {{ auth.error }} 백엔드가 실행 중인지 확인해 주세요.
        </div>
        <ErrorNotice :error="error" />
        <form @submit.prevent="submit" class="stack-form">
          <label v-if="registering"
            >이름<input
              v-model="name"
              required
              maxlength="60"
              autocomplete="name"
              placeholder="가상 고객 이름"
          /></label>
          <label
            >이메일<input
              v-model="email"
              type="email"
              required
              maxlength="254"
              autocomplete="username"
              placeholder="name@example.com"
          /></label>
          <label
            >비밀번호<input
              v-model="password"
              type="password"
              required
              :minlength="registering ? 10 : undefined"
              maxlength="72"
              :autocomplete="registering ? 'new-password' : 'current-password'"
              placeholder="비밀번호를 입력해 주세요"
            /><small v-if="registering" class="muted"
              >10자 이상, UTF-8 기준 72바이트 이하로 입력해 주세요.</small
            ></label
          >
          <button class="button button-dark full" :disabled="pending">
            {{ pending ? '처리 중…' : registering ? '테스트 계정 만들기' : '로그인'
            }}<AppIcon name="arrow" :size="18" />
          </button>
        </form>
        <p class="auth-switch">
          {{ registering ? '이미 계정이 있나요?' : '처음 방문하셨나요?' }}
          <button class="text-button" :disabled="pending" @click="toggleMode">
            {{ registering ? '로그인' : '테스트 계정 만들기' }}
          </button>
        </p>
        <RouterLink to="/products" class="auth-browse"
          >로그인 없이 금융상품 둘러보기 <AppIcon name="arrow" :size="15"
        /></RouterLink>
        <div class="auth-footnote">
          학습용 서비스입니다. 실제 개인정보나 금융정보를 입력하지 마세요.
        </div>
      </div>
    </main>
  </div>
</template>
