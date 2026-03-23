<script setup lang="ts">
import TheSidebar from '@/components/TheSidebar.vue'
</script>

<template>
  <div class="flex h-screen bg-gray-50">
    <TheSidebar />
    <main class="flex-1 overflow-auto">
      <router-view />
    </main>
  </div>
</template>
