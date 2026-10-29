<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { auth, logout } from './stores/auth'
import AppIcon from './components/AppIcon.vue'
import ErrorNotice from './components/ErrorNotice.vue'
const route = useRoute()
const router = useRouter()
const logoutError = ref<unknown>(null)
const loggingOut = ref(false)
const roleName = computed(
  () =>
    ({ CUSTOMER: '고객', REVIEWER: '심사 담당자', ADMIN: '운영 관리자' })[
      auth.user?.role ?? 'CUSTOMER'
    ],
)
watch(
  () => auth.user,
  (user) => {
    if (!user && route.meta.protected)
      void router.push({ path: '/login', query: { redirect: route.fullPath } })
  },
)
async function signOut() {
  loggingOut.value = true
  logoutError.value = null
  try {
    await logout()
    await router.push('/login')
  } catch (error) {
    logoutError.value = error
  } finally {
    loggingOut.value = false
  }
}
</script>
<template>
  <a class="skip-link" href="#main">본문으로 건너뛰기</a>
  <div v-if="route.path === '/login'" class="auth-root"><RouterView /></div>
  <div v-else class="app-layout">
    <aside class="sidebar">
      <RouterLink to="/" class="brand" aria-label="Oh My Bank 홈"
        ><span class="brand-symbol"><i></i><i></i></span
        ><span>oh my bank<span class="brand-dot">.</span></span></RouterLink
      >
      <div class="workspace-label">MY FINANCIAL WORKSPACE</div>
      <nav class="main-nav" aria-label="주 메뉴">
        <RouterLink
          v-if="!auth.user || auth.user.role === 'CUSTOMER'"
          to="/"
          exact-active-class="active"
          ><AppIcon name="grid" />내 대시보드</RouterLink
        >
        <RouterLink to="/products" active-class="active"
          ><AppIcon name="layers" />금융상품<span class="nav-dot"></span
        ></RouterLink>
        <RouterLink
          v-if="auth.user && auth.user.role !== 'CUSTOMER'"
          to="/staff"
          active-class="active"
          ><AppIcon name="shield" />직원 업무</RouterLink
        >
      </nav>
      <div class="sidebar-note">
        <span class="tiny-label">LEARN BY DOING</span>
        <h3>작은 경험이<br />금융의 이해로.</h3>
        <p>모든 거래는 가상 데이터로<br />안전하게 진행됩니다.</p>
        <div class="note-orbit"><span>OMB</span></div>
      </div>
      <div class="sidebar-bottom">
        <span class="live-dot"></span>금융 시뮬레이션<span class="version">v0.1</span>
      </div>
    </aside>
    <div class="main-shell">
      <header class="topbar">
        <div class="breadcrumb">
          Workspace <AppIcon name="chevron" :size="14" /><strong>{{ route.meta.title }}</strong>
        </div>
        <div class="user-menu" v-if="auth.user">
          <span class="avatar">{{ auth.user.name.slice(0, 1) }}</span>
          <div>
            <strong>{{ auth.user.name }}</strong
            ><small>{{ roleName }} 계정</small>
          </div>
          <button
            class="icon-button"
            :disabled="loggingOut"
            @click="signOut"
            aria-label="로그아웃"
            title="로그아웃"
          >
            <AppIcon name="logout" :size="18" />
          </button>
        </div>
        <RouterLink v-else class="button button-dark small" to="/login"
          >로그인 <AppIcon name="arrow" :size="16"
        /></RouterLink>
      </header>
      <main id="main" class="main-content">
        <ErrorNotice :error="logoutError" /><RouterView :key="route.path" />
      </main>
      <footer class="page-footer">
        <span>© {{ new Date().getFullYear() }} Oh My Bank</span
        ><span>학습용 가상 금융거래 시뮬레이션 · 실제 대출 및 자금 이동 없음</span>
      </footer>
    </div>
  </div>
</template>
