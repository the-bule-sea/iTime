<script setup>
import { ref, computed, onMounted, onUnmounted, reactive } from "vue";
import { useCustomSettingsStore } from "@/stores/CustomSettings";
import { Message } from "@arco-design/web-vue";
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

// --- 卡片数据配置 ---
const pomodoroConfigs = ref([
  {
    id: 1,
    title: "深度专注",
    time: 60,
    shortBreak: 10,
    bg: "#F7473E"
  },
  {
    id: 2,
    title: "常规番茄",
    time: 25,
    shortBreak: 5,
    bg: "#4C8DC7"
  },
  {
    id: 3,
    title: "快速冲刺",
    time: 15,
    shortBreak: 3,
    bg: "#E6A23C"
  }
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
const editForm = reactive({ id: -1, title: "", time: 25, shortBreak: 5 });
const durationMarks = { 15: "15", 25: "25", 35: "35", 45: "45", 55: "55" };
const shortBreakMarks = { 3: "3", 6: "6", 9: "9", 12: "12", 15: "15" };

// --- 动作函数 ---
const openSettings = item => {
  editForm.id = item.id;
  editForm.title = item.title;
  editForm.time = item.time;
  editForm.shortBreak = item.shortBreak || 5;
  settingsVisible.value = true;
};
const handleSaveSettings = () => {
  const index = pomodoroConfigs.value.findIndex(p => p.id === editForm.id);
  if (index !== -1)
    Object.assign(pomodoroConfigs.value[index], editForm) &&
      Message.success("设置已更新");
  settingsVisible.value = false;
};
const selectCard = config => {
  originTime.value = config.time * 60;
  totalTime.value = originTime.value;
  percent.value = 0;
  halfFirst = true;
  isTimerActive.value = true;
  startTimer();
};

// --- 计时器逻辑 ---
const audioFullTimePlayer = ref(null);
const audioHalfTimePlayer = ref(null);
const role = computed(
  () => customSettingsStore.customSettings.voice.timerV ?? "default"
);
const isClosed = computed(
  () => customSettingsStore.customSettings.voice.isClosedV ?? "false"
);
const minutes = computed(() =>
  Math.floor(totalTime.value / 60)
    .toString()
    .padStart(2, "0")
);
const seconds = computed(() =>
  (totalTime.value % 60).toString().padStart(2, "0")
);

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
onUnmounted(() => clearInterval(intervalId));
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
        <a-progress
          :percent="percent"
          type="circle"
          size="large"
          :width="400"
          color="rgb(12, 228, 140)"
          class="big-timer-progress"
        >
          <template #text>
            <div class="inner-timer-container">
              <div class="timer-display">{{ minutes }}:{{ seconds }}</div>
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
                  <icon-refresh size="24" />
                </a-button>
              </div>
            </div>
          </template>
        </a-progress>
      </div>
    </transition>

    <a-modal v-model:visible="settingsVisible" title="番茄钟设置" @ok="handleSaveSettings">
      <a-form :model="editForm" layout="vertical">
        <a-form-item label="标语内容 (标题)">
          <a-input v-model="editForm.title" placeholder="请输入名称..." allow-clear />
        </a-form-item>
        <a-form-item label="专注时段 (分钟)">
          <a-slider
            v-model="editForm.time"
            :min="15"
            :max="55"
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
.card-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
  padding: 20px;
  width: 90%;
  max-width: 800px;
}
.task-card {
  height: 100px;
  border-radius: 8px;
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
.settings-btn {
  background: rgba(0, 0, 0, 0.2);
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

/* 新版计时器样式 */
.timer-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  animation: fadeIn 0.5s ease;
}

/* 强制覆盖 Arco 圆环尺寸 */
:deep(.arco-progress-circle) {
  width: 400px !important;
  height: 400px !important;
}
:deep(.arco-progress-circle-svg) {
  transform: rotate(-90deg);
}

/* 圆环内部容器布局 */
.inner-timer-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 30px; 
  margin-top: -10px; 
}

.timer-display {
  font-size: 5.5rem; 
  font-weight: bold;
  color: white;
  text-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
  line-height: 1;
}

.controls {
  display: flex;
  gap: 25px;
}

.control-btn {
  background: rgba(255, 255, 255, 0.15);
  border: 2px solid rgba(255, 255, 255, 0.8);
  color: white;
  width: 72px;
  height: 72px;
  transition: all 0.2s;
  backdrop-filter: blur(5px);
}
.control-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.1);
}
.play-btn {
  width: 72px;
  height: 72px;
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