<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useCustomSettingsStore } from "@/stores/CustomSettings";
import { Message } from "@arco-design/web-vue";
// 引入图标
import { IconPlayArrow, IconPause, IconRefresh } from "@arco-design/web-vue/es/icon";

// --- 基础配置与 Store ---
const customSettingsStore = useCustomSettingsStore();
const currentPath = window.electron.getAppPath(); // 获取当前路径用于音频加载
const backgroundImage = computed(() => customSettingsStore.customSettings["f-pomodoro-bgi"]);

// --- 卡片数据配置 ---
const pomodoroConfigs = ref([
  { id: 1, title: '深度专注', time: 60, icon: '🔥', bg: '#F7473E' },
  { id: 2, title: '常规番茄', time: 25, icon: '🍅', bg: '#4C8DC7' },
]);

// --- 计时器核心状态 ---
const isTimerActive = ref(false); // 控制是显示卡片还是显示计时器
const isRunning = ref(false); // 计时器运行状态
const percent = ref(0); // 进度条百分比
const totalTime = ref(0); // 当前剩余秒数
const originTime = ref(0); // 记录初始总秒数（用于计算进度）
let intervalId = null; // 定时器ID
let halfFirst = true; // 记录是否已播放过半提醒

// --- 音频播放器引用 ---
const audioFullTimePlayer = ref(null);
const audioHalfTimePlayer = ref(null);
const role = computed(() => customSettingsStore.customSettings.voice.timerV ?? "default");
const isClosed = computed(() => customSettingsStore.customSettings.voice.isClosedV ?? "false");

// --- 计算属性 ---
const minutes = computed(() => Math.floor(totalTime.value / 60).toString().padStart(2, "0"));
const seconds = computed(() => (totalTime.value % 60).toString().padStart(2, "0"));

// --- 核心动作：选择卡片并开始 ---
const selectCard = (config) => {
  // 1. 设置时间
  originTime.value = config.time * 60;
  totalTime.value = originTime.value;
  
  // 2. 状态重置
  percent.value = 0;
  halfFirst = true;
  
  // 3. 切换界面并启动
  isTimerActive.value = true;
  startTimer(); 
};

// --- 计时器逻辑 (移植自 Timer.vue) ---
const startTimer = () => {
  if (intervalId === null) {
    isRunning.value = true;
    intervalId = setInterval(() => {
      if (totalTime.value > 0) {
        totalTime.value--;
        // 更新进度条
        percent.value = Number((1 - totalTime.value / originTime.value).toFixed(2));
        
        // 时间过半提醒
        if (percent.value >= 0.5 && halfFirst) {
          halfFirst = false;
          !isClosed.value && audioHalfTimePlayer.value?.play();
          window.electron.notificationUser("timer-half");
        }
      } else {
        // 时间结束
        clearInterval(intervalId);
        intervalId = null;
        isRunning.value = false;
        percent.value = 1; // 进度条填满
        !isClosed.value && audioFullTimePlayer.value?.play();
        window.electron.notificationUser("timer-full");
      }
    }, 1000);
  }
};

const pauseTimer = () => {
  clearInterval(intervalId);
  intervalId = null;
  isRunning.value = false;
};

// --- 返回卡片选择页 (重置) ---
const resetToCards = () => {
  pauseTimer();
  isTimerActive.value = false;
  totalTime.value = 0;
  percent.value = 0;
};

// --- 生命周期 ---
onUnmounted(() => {
  clearInterval(intervalId);
});
</script>

<template>
  <div class="main" :style="{ backgroundImage: `url({backgroundImage})` }">
    
    <transition name="fade" mode="out-in">
      <div v-if="!isTimerActive" class="card-container" key="cards">
        <div 
          v-for="item in pomodoroConfigs" 
          :key="item.id" 
          class="task-card"
          :style="{ background: item.bg }"
          @click="selectCard(item)"
        >
          <div class="card-content">
            <span class="card-icon">{{ item.icon }}</span>
            <div class="card-info">
              <div class="card-title">{{ item.title }}</div>
              <div class="card-time">{{ item.time }} 分钟</div>
            </div>
            <div class="start-btn">开始</div>
          </div>
        </div>
      </div>

      <div v-else class="timer-wrapper" key="timer">
        <div class="timer-box">
          <a-progress
            status="warning"
            :percent="percent"
            type="circle"
            size="large"
            :width="80"
            color="rgb(12, 228, 140)"
            class="timer-progress"
          >
            <template #text>
               <div class="timer-display">{{ minutes }}:{{ seconds }}</div>
            </template>
          </a-progress>

          <div class="controls">
            <a-button
              @click="isRunning ? pauseTimer() : startTimer()"
              shape="circle"
              size="large"
              class="control-btn play-btn"
            >
              <icon-pause v-if="isRunning" size="24" />
              <icon-play-arrow v-else size="24" />
            </a-button>

            <a-button
              @click="resetToCards"
              shape="circle"
              size="large"
              class="control-btn reset-btn"
            >
              <icon-refresh size="20" />
            </a-button>
          </div>
        </div>
      </div>
    </transition>

    <!-- 播放音频 |时间过半|时间到|-->
    <audio
      ref="audioHalfTimePlayer"
      :src="`${currentPath}/assets/voices/timer/${role}/halfTime.wav`"
    ></audio>
    <audio
      ref="audioFullTimePlayer"
      :src="`${currentPath}/assets/voices/timer/${role}/fullTime.wav`"
    ></audio>

  </div>
</template>

<style scoped>
/* 全局容器 */
.main {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  background-size: cover;
  background-position: center;
  overflow: hidden;
}

/* === 卡片部分样式 === */
.card-container {
  display: grid;
  /* 核心修改：使用 repeat(auto-fit, ...) 实现自动响应 */
  /* 意思就是：每列最小300px，如果空间不够容纳两列(600px)，就自动变成一列 */
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); 
  gap: 20px;
  padding: 20px;
  width: 90%;
  max-width: 800px;
}
.task-card {
  height: 120px;
  border-radius: 15px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex; align-items: center;
  padding: 0 25px;
  color: white;
  box-shadow: 0 8px 15px rgba(0,0,0,0.2);
}

.task-card:hover {
  transform: translateY(-5px) scale(1.02);
  box-shadow: 0 15px 30px rgba(0,0,0,0.3);
}

.card-content { display: flex; width: 100%; align-items: center; }
.card-icon { font-size: 2.5em; margin-right: 20px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2)); }
.card-info { flex: 1; text-align: left; }
.card-title { font-size: 1.4em; font-weight: bold; margin-bottom: 5px;}
.card-time { opacity: 0.9; font-size: 1em; }

.start-btn {
  background: rgba(255,255,255,0.2);
  padding: 8px 18px;
  border-radius: 20px;
  backdrop-filter: blur(5px);
  border: 1px solid rgba(255,255,255,0.4);
  font-weight: bold;
}

/* === 计时器部分样式 (复刻图3) === */
.timer-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  animation: fadeIn 0.5s ease;
}

.timer-box {
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(10px);
  padding: 40px 60px;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 30px;
}

/* 覆盖 Arco Progress 内部文字样式 */
.timer-display {
  font-size: 3.5rem;
  font-weight: bold;
  color: white;
  text-shadow: 0 4px 10px rgba(0,0,0,0.5);
  line-height: 1;
}

/* 调整 Progress 圆环大小 */
:deep(.arco-progress-circle) {
  width: 200px !important;
  height: 200px !important;
}
:deep(.arco-progress-circle-svg) {
  transform: rotate(-90deg); /* 让进度条从顶部开始 */
}

.controls {
  display: flex;
  gap: 20px;
}

.control-btn {
  background: transparent;
  border: 2px solid white;
  color: white;
  width: 50px;
  height: 50px;
  transition: all 0.2s;
}

.control-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: scale(1.1);
}

.play-btn { width: 64px; height: 64px; } /* 播放按钮大一点 */

/* 过渡动画 */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
</style>