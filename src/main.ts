import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import { bootstrapAuth } from './stores/auth'
import './style.css'

await bootstrapAuth()
createApp(App).use(router).mount('#app')
