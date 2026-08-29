<script setup>
import { onMounted } from 'vue'
import { syncAvatarFromStorage, useAvatarSrc } from '../utils/avatarPref.js'

defineProps({
  className: { type: String, default: '' },
  alt: { type: String, default: 'Avatar' },
})

const avatarSrc = useAvatarSrc()

onMounted(() => {
  syncAvatarFromStorage()
})
</script>

<template>
  <img :class="className" :src="avatarSrc" :alt="alt" />
</template>
