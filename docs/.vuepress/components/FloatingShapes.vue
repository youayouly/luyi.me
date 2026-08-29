<template>
  <div class="lk-shapes" aria-hidden="true">
    <div v-for="s in shapes" :key="s.id"
      class="lk-shape"
      :class="`lk-shape--${s.type} lk-shape--${s.side}`"
      :style="s.style"
    />
  </div>
</template>

<script setup>
const shapes = [
  // left side
  { id: 1,  type: 'circle',   side: 'left',  style: { width: '60px',  height: '60px',  top: '12%',  left: '2%',   animationDelay: '0s',   animationDuration: '7s'  } },
  { id: 2,  type: 'ring',     side: 'left',  style: { width: '100px', height: '100px', top: '28%',  left: '5%',   animationDelay: '1.5s', animationDuration: '9s'  } },
  { id: 3,  type: 'dot',      side: 'left',  style: { width: '14px',  height: '14px',  top: '55%',  left: '3%',   animationDelay: '0.8s', animationDuration: '6s'  } },
  { id: 4,  type: 'triangle', side: 'left',  style: { width: '40px',  height: '40px',  top: '70%',  left: '7%',   animationDelay: '2.2s', animationDuration: '8s'  } },
  { id: 5,  type: 'dot',      side: 'left',  style: { width: '8px',   height: '8px',   top: '42%',  left: '9%',   animationDelay: '3.1s', animationDuration: '5s'  } },
  { id: 6,  type: 'circle',   side: 'left',  style: { width: '28px',  height: '28px',  top: '85%',  left: '1%',   animationDelay: '1s',   animationDuration: '11s' } },
  // right side
  { id: 7,  type: 'ring',     side: 'right', style: { width: '80px',  height: '80px',  top: '8%',   right: '3%',  animationDelay: '0.5s', animationDuration: '8s'  } },
  { id: 8,  type: 'circle',   side: 'right', style: { width: '44px',  height: '44px',  top: '35%',  right: '2%',  animationDelay: '2s',   animationDuration: '7s'  } },
  { id: 9,  type: 'dot',      side: 'right', style: { width: '18px',  height: '18px',  top: '60%',  right: '6%',  animationDelay: '1.2s', animationDuration: '9s'  } },
  { id: 10, type: 'triangle', side: 'right', style: { width: '36px',  height: '36px',  top: '20%',  right: '7%',  animationDelay: '3s',   animationDuration: '6s'  } },
  { id: 11, type: 'ring',     side: 'right', style: { width: '55px',  height: '55px',  top: '78%',  right: '4%',  animationDelay: '0.3s', animationDuration: '10s' } },
  { id: 12, type: 'dot',      side: 'right', style: { width: '10px',  height: '10px',  top: '48%',  right: '9%',  animationDelay: '2.7s', animationDuration: '5s'  } },
]
</script>

<style scoped>
.lk-shapes {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2;
  /* Only visible on wider screens — below 1100px they just add noise */
  display: none;
}

@media (min-width: 1100px) {
  .lk-shapes {
    display: block;
  }
}

.lk-shape {
  position: absolute;
  opacity: 0.18;
  animation: lk-float linear infinite;
}

/* Circles */
.lk-shape--circle {
  border-radius: 50%;
  background: linear-gradient(135deg, #7dd3fc, #a78bfa);
}

/* Hollow rings */
.lk-shape--ring {
  border-radius: 50%;
  border: 2px solid rgba(125, 211, 252, 0.7);
  background: transparent;
}

/* Small dots */
.lk-shape--dot {
  border-radius: 50%;
  background: #f9a8d4;
}

/* Triangles via clip-path */
.lk-shape--triangle {
  background: linear-gradient(135deg, #a78bfa, #7dd3fc);
  clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
  border-radius: 0;
}

/* Float animation — alternates direction per side */
.lk-shape--left {
  animation-name: lk-float-left;
}

.lk-shape--right {
  animation-name: lk-float-right;
}

@keyframes lk-float-left {
  0%   { transform: translateY(0)   rotate(0deg);   opacity: 0.18; }
  25%  { transform: translateY(-18px) rotate(8deg);  opacity: 0.28; }
  50%  { transform: translateY(0)   rotate(0deg);   opacity: 0.18; }
  75%  { transform: translateY(14px) rotate(-6deg); opacity: 0.26; }
  100% { transform: translateY(0)   rotate(0deg);   opacity: 0.18; }
}

@keyframes lk-float-right {
  0%   { transform: translateY(0)   rotate(0deg);   opacity: 0.18; }
  25%  { transform: translateY(14px) rotate(-8deg); opacity: 0.26; }
  50%  { transform: translateY(0)   rotate(0deg);   opacity: 0.18; }
  75%  { transform: translateY(-18px) rotate(6deg); opacity: 0.28; }
  100% { transform: translateY(0)   rotate(0deg);   opacity: 0.18; }
}
</style>
