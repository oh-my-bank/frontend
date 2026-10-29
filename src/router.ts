import { createRouter, createWebHistory } from 'vue-router'
import { auth } from './stores/auth'
import DashboardPage from './views/DashboardPage.vue'
import ProductsPage from './views/ProductsPage.vue'
import ProductPage from './views/ProductPage.vue'
import ApplicationPage from './views/ApplicationPage.vue'
import AuthPage from './views/AuthPage.vue'
import StaffPage from './views/StaffPage.vue'

export const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: '/', component: DashboardPage, meta: { title: '내 대시보드', protected: true } },
    { path: '/products', component: ProductsPage, meta: { title: '금융상품' } },
    { path: '/products/:id', component: ProductPage, meta: { title: '상품 상세 · 대출 신청' } },
    {
      path: '/applications/:id',
      component: ApplicationPage,
      meta: { title: '신청 상세', protected: true },
    },
    { path: '/login', component: AuthPage, meta: { title: '로그인' } },
    { path: '/staff', component: StaffPage, meta: { title: '직원 업무', protected: true } },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})
router.beforeEach((to) => {
  if (to.meta.protected && !auth.user) return { path: '/login', query: { redirect: to.fullPath } }
  if (to.path === '/' && auth.user && auth.user.role !== 'CUSTOMER') return '/staff'
  if (to.path === '/login' && auth.user) return '/'
  if (to.path === '/staff' && auth.user?.role === 'CUSTOMER') return '/'
})
router.afterEach((to) => {
  document.title = `${String(to.meta.title ?? '금융거래 시뮬레이션')} · Oh My Bank`
})
