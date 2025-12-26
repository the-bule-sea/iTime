<script setup>
import { ref, computed, onMounted, onUnmounted, reactive } from "vue";
import { useCustomSettingsStore } from "@/stores/CustomSettings";
import { Message } from "@arco-design/web-vue";
// 引入图标：新增 IconSettings
import {
  IconPlayArrow,
  IconPause,
  IconRefresh,
  IconSettings
} from "@arco-design/web-vue/es/icon";

// --- 基础配置与 Store ---
const customSettingsStore = useCustomSettingsStore();
const currentPath = window.electron.getAppPath();
const backgroundImage = computed(
  () => customSettingsStore.customSettings["f-pomodoro-bgi"]
);

// --- 卡片数据配置 (已升级数据结构) ---
const pomodoroConfigs = ref([
  // 增加了 shortBreak (休息时间) 字段，默认为 5 分钟
  {
    id: 1,
    title: "深度专注",
    time: 55,
    shortBreak: 10,
    icon: "🔥",
    bg: "#F7473E"
  },
  {
    id: 2,
    title: "常规番茄",
    time: 25,
    shortBreak: 5,
    icon: "🍅",
    bg: "#4C8DC7"
  },
  {
    id: 3,
    title: "快速冲刺",
    time: 15,
    shortBreak: 3,
    icon: "⚡",
    bg: "#E6A23C"
  } // 示例
]);

// --- 计时器核心状态 ---
const isTimerActive = ref(false);
const isRunning = ref(false);
const percent = ref(0);
const totalTime = ref(0);
const originTime = ref(0);
let intervalId = null;
let halfFirst = true;

// --- 编辑弹窗状态 ---
const settingsVisible = ref(false);
const editForm = reactive({
  id: -1,
  title: "",
  time: 25,
  shortBreak: 5
});

// --- 滑块刻度配置 (直接复用 ClockSettings.vue) ---
const durationMarks = {
  1: "1",
  15: "15",
  25: "25",
  35: "35",
  45: "45",
  55: "55",
  65: "65",
  75: "75"
};
const shortBreakMarks = { 
  3: "3", 
  6: "6", 
  9: "9", 
  12: "12", 
  15: "15" 
};

// --- 核心动作：打开设置弹窗 ---
const openSettings = item => {
  // 回显数据到表单
  editForm.id = item.id;
  editForm.title = item.title;
  editForm.time = item.time;
  editForm.shortBreak = item.shortBreak || 5; // 如果没设置过，给个默认值
  settingsVisible.value = true;
};

// --- 核心动作：保存设置 ---
const handleSaveSettings = () => {
  // 找到对应的卡片并更新数据
  const index = pomodoroConfigs.value.findIndex(p => p.id === editForm.id);
  if (index !== -1) {
    pomodoroConfigs.value[index].title = editForm.title;
    pomodoroConfigs.value[index].time = editForm.time;
    pomodoroConfigs.value[index].shortBreak = editForm.shortBreak;
    Message.success("设置已更新");
  }
  settingsVisible.value = false;
};

// --- 核心动作：选择卡片并开始 ---
const selectCard = config => {
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

// --- 音频播放器引用 ---
const audioFullTimePlayer = ref(null);
const audioHalfTimePlayer = ref(null);
const role = computed(
  () => customSettingsStore.customSettings.voice.timerV ?? "default"
);
const isClosed = computed(
  () => customSettingsStore.customSettings.voice.isClosedV ?? "false"
);

// --- 计算属性 ---
const minutes = computed(() =>
  Math.floor(totalTime.value / 60)
    .toString()
    .padStart(2, "0")
);
const seconds = computed(() =>
  (totalTime.value % 60).toString().padStart(2, "0")
);

// --- 计时器逻辑 ---
const startTimer = () => {
  if (intervalId === null) {
    isRunning.value = true;
    intervalId = setInterval(() => {
      if (totalTime.value > 0) {
        totalTime.value--;
        percent.value = Number(
          (1 - totalTime.value / originTime.value).toFixed(2)
        );
        if (percent.value >= 0.5 && halfFirst) {
          halfFirst = false;
          !isClosed.value && audioHalfTimePlayer.value?.play();
          window.electron.notificationUser("timer-half");
        }
      } else {
        clearInterval(intervalId);
        intervalId = null;
        isRunning.value = false;
        percent.value = 1;
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

const resetToCards = () => {
  pauseTimer();
  isTimerActive.value = false;
  totalTime.value = 0;
  percent.value = 0;
};

onUnmounted(() => {
  clearInterval(intervalId);
});
</script>

<template>
  <div class="main" :style="{ backgroundImage: `url(${backgroundImage})` }">
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
            <div class="card-info">
              <div class="card-title">{{ item.title }}</div>
              <div class="card-time">{{ item.time }} min</div>
            </div>
            <div class="settings-btn" @click.stop="openSettings(item)">
              设置
              <icon-settings />
            </div>
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

    <a-modal v-model:visible="settingsVisible" title="番茄钟设置" @ok="handleSaveSettings">
      <a-form :model="editForm" layout="vertical">
        <a-form-item label="标语内容 (标题)">
          <a-input v-model="editForm.title" placeholder="请输入专注卡片的名称..." allow-clear />
        </a-form-item>

        <a-form-item label="专注时段 (分钟)">
          <a-slider
            v-model="editForm.time"
            :min="1"
            :max="75"
            :marks="durationMarks"
            :style="{ width: '100%' }"
          />
        </a-form-item>

        <a-form-item label="短休息 (分钟)">
          <a-slider
            v-model="editForm.shortBreak"
            :min="3"
            :max="15"
            :marks="shortBreakMarks"
            :style="{ width: '100%' }"
          />
        </a-form-item>
      </a-form>
    </a-modal>

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
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-size: cover;
  background-position: center;
  overflow: hidden;
}

/* === 卡片样式 (模仿图1) === */
.card-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
  padding: 20px;
  width: 90%;
  max-width: 800px;
}

.task-card {
  height: 100px; /* 稍微调低高度，更像条幅 */
  border-radius: 8px; /* 圆角改小一点，更像 Material Design */
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  padding: 0 25px;
  color: white;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
  position: relative;
  overflow: hidden;
}

.task-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 15px rgba(0, 0, 0, 0.2);
}

.card-content {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
}

.card-info {
  flex: 1;
  text-align: left;
}
.card-title {
  font-size: 1.5em;
  font-weight: normal;
  margin-bottom: 2px;
}
.card-time {
  opacity: 0.8;
  font-size: 0.9em;
}

/* 设置按钮样式 (图1右侧深色块) */
.settings-btn {
  background: rgba(0, 0, 0, 0.2); /* 半透明深色背景 */
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 0.9em;
  display: flex;
  align-items: center;
  gap: 5px;
  transition: background 0.2s;
  backdrop-filter: blur(2px);
}

.settings-btn:hover {
  background: rgba(0, 0, 0, 0.4);
}

/* === 计时器样式 === */
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

.timer-display {
  font-size: 3.5rem;
  font-weight: bold;
  color: white;
  text-shadow: 0 4px 10px rgba(0, 0, 0, 0.5);
  line-height: 1;
}

:deep(.arco-progress-circle) {
  width: 200px !important;
  height: 200px !important;
}
:deep(.arco-progress-circle-svg) {
  transform: rotate(-90deg);
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
.play-btn {
  width: 64px;
  height: 64px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>