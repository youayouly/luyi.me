<script setup>
import { RouterLink } from 'vue-router'
import { PROJECT_ROLES } from '../data/projectRoles.js'

const roles = PROJECT_ROLES
</script>

<template>
  <div class="lk-proj-roles">
    <div class="lk-proj-roles__title">岗位 / 方向</div>
    <ul class="lk-proj-roles__list">
      <li v-for="(item, i) in roles" :key="i" class="lk-proj-roles__item">
        <RouterLink class="lk-proj-roles__row" :to="item.to">
          <span class="lk-proj-roles__name">{{ item.label }}</span>
          <span class="lk-proj-roles__count">{{ item.count }}</span>
        </RouterLink>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.lk-proj-roles {
  position: static;
  padding: 0.72rem 0.55rem 0.8rem;
  border-radius: 10px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 4px 24px rgba(15, 23, 42, 0.08);
}

.lk-proj-roles__title {
  font-size: 0.75rem;
  font-weight: 600;
  color: #0a0a0a;
  margin: 0 0 0.45rem 0.32rem;
}

.lk-proj-roles__list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.lk-proj-roles__item {
  margin: 0;
  padding: 0;
}

.lk-proj-roles__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.34rem 0.4rem;
  margin: 0.1rem 0;
  border-radius: 8px;
  text-decoration: none;
  color: #0a0a0a;
  font-size: 0.8125rem;
  line-height: 1.4;
  border-left: 3px solid transparent;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;
  overflow: hidden;
}

.lk-proj-roles__row:hover {
  background: rgba(99, 102, 241, 0.09);
  color: #1d4ed8;
}

.lk-proj-roles__row:focus-visible {
  outline: 2px solid rgba(74, 144, 217, 0.55);
  outline-offset: 1px;
}

.lk-proj-roles__name {
  flex: 1;
  min-width: 0;
}

.lk-proj-roles__count {
  flex-shrink: 0;
  min-width: 1.75rem;
  text-align: center;
  font-size: 0.65rem;
  font-weight: 600;
  color: #0a0a0a;
  background: #e5e7eb;
  border-radius: 6px;
  padding: 0.1rem 0.35rem;
}

[data-theme='dark'] .lk-proj-roles {
  background: #141414;
  border-color: rgba(248, 250, 252, 0.12);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.45);
}

[data-theme='dark'] .lk-proj-roles__title {
  color: #f8fafc;
}

[data-theme='dark'] .lk-proj-roles__row {
  color: #f8fafc;
}

[data-theme='dark'] .lk-proj-roles__row:hover {
  background: rgba(147, 197, 253, 0.12);
  color: #bfdbfe;
}

[data-theme='dark'] .lk-proj-roles__count {
  background: rgba(248, 250, 252, 0.12);
  color: #f1f5f9;
}
</style>
