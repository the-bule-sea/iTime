<script setup>
import { ref, computed, onMounted, onUnmounted, reactive } from "vue";
import { useCustomSettingsStore } from "@/stores/CustomSettings";
import { useStatisticsStore } from "@/stores/StatisticsStore";
import { usePomodoroStore } from "@/stores/PomodoroStore";
import { Message, Modal } from "@arco-design/web-vue";
import {
  IconPlayArrow,
  IconPause,
  IconRefresh,
  IconSettings,
  IconClose
} from "@arco-design/web-vue/es/icon";

// --- 基础配置与 Store ---
const customSettingsStore = useCustomSettingsStore();
const statisticsStore = useStatisticsStore();
const currentCard = ref(null);
const currentPath = window.electron.getAppPath();
const backgroundImage = computed(
  () => customSettingsStore.customSettings["f-pomodoro-bgi"]
);

// 初始化番茄钟 Store
const pomodoroStore = usePomodoroStore();

// --- 计时器核心状态 ---
const isTimerActive = ref(false);
const isRunning = ref(false);
const percent = ref(0);
const totalTime = ref(0);
const originTime = ref(0);
let intervalId = null;
let halfFirst = true;

// --- 模式控制状态 ---
const isEditMode = ref(false); // false=显示编辑图标, true=显示新增图标

// --- 编辑弹窗状态 ---
const settingsVisible = ref(false);
const colorPalette = [
  "#AAB7B8", // 灰蓝
  "#B2BEB5", // 灰绿
  "#FFAAA5", // 珊瑚粉
  "#C3B1E1", // 淡紫
  "#A8E6CF", // 薄荷绿
  "#DCEDC1", // 浅绿
  "#FFD3B6", // 蜜桃色
  "#FF8B94", // 柔和红
  "#B39DDB", // 薰衣草紫
  "#D8C3A5", // 杏色
  "#9FA8DA", // 柔和蓝
  "#90CAF9", // 天空蓝
  "#81D4FA", // 淡蓝
  "#80DEEA", // 青色
  "#4DD0E1", // 青绿
  "#4DB6AC", // 青绿
  "#81C784", // 柔和绿
  "#AED581", // 柠檬绿
  "#DCE775", // 浅黄绿
  "#FFF59D" // 柔和黄
];
const editForm = reactive({ id: -1, title: "", time: 25, shortBreak: 5 });
const durationMarks = { 15: "15", 25: "25", 35: "35", 45: "45", 55: "55" };
const shortBreakMarks = { 3: "3", 6: "6", 9: "9", 12: "12", 15: "15" };

// --- 动作函数 ---

// 1. 切换编辑模式 / 触发新增
const toggleEditMode = () => {
  if (isEditMode.value) {
    openAddModal();
  } else {
    isEditMode.value = true;
    Message.info("已进入编辑模式，点击 X 删除卡片，点击右下角 + 新增");
  }
};

// 2. 打开新增弹窗
const openAddModal = () => {
  editForm.id = -1;
  editForm.title = "";
  editForm.time = 25;
  editForm.shortBreak = 5;
  settingsVisible.value = true;
};

// 3. 打开设置弹窗（修改现有）
const openSettings = item => {
  editForm.id = item.id;
  editForm.title = item.title;
  editForm.time = item.time;
  editForm.shortBreak = item.shortBreak || 5;
  settingsVisible.value = true;
};

// 4. 保存设置
const handleSaveSettings = () => {
  if (!editForm.title) {
    Message.warning("请输入标题");
    return;
  }

  if (editForm.id === -1) {
    const newId = Date.now();
    const randomColor =
      colorPalette[Math.floor(Math.random() * colorPalette.length)];
    pomodoroStore.configs.push({
      id: newId,
      title: editForm.title,
      time: editForm.time,
      shortBreak: editForm.shortBreak,
      bg: randomColor
    });
    Message.success("新增成功");
    isEditMode.value = false;
  } else {
    pomodoroStore.updateConfig(editForm);
    Message.success("设置已更新");
  }
  settingsVisible.value = false;
};

// 5. 删除卡片
const deleteCard = item => {
  Modal.warning({
    title: "确认删除",
    content: `确定要删除 ${item.title} 吗？`,
    onOk: () => {
      const index = pomodoroStore.configs.findIndex(i => i.id === item.id);
      if (index !== -1) {
        pomodoroStore.configs.splice(index, 1);
        Message.success("已删除");
        if (pomodoroStore.configs.length === 0) isEditMode.value = false;
      }
    }
  });
};

// 6. 退出编辑模式
const handleBackgroundClick = e => {
  // 确保点击的不是FAB按钮本身才退出
  if (isEditMode.value && e.target.classList.contains("card-container")) {
    isEditMode.value = false;
  }
};

const selectCard = config => {
  if (isEditMode.value) return;
  currentCard.value = config;
  originTime.value = config.time * 60;
  totalTime.value = originTime.value;
  percent.value = 0;
  halfFirst = true;
  isTimerActive.value = true;
  startTimer();
};

// --- 计时器逻辑 (保持不变) ---
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
        if (currentCard.value) {
          statisticsStore.addRecord({
            cardTitle: currentCard.value.title,
            duration: currentCard.value.time, // 记录设定的时长（分钟）
            type: "focus"
          });
        }
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
  <div
    class="main"
    :style="{ backgroundImage: `url(${backgroundImage})` }"
    @click="handleBackgroundClick"
  >
    <transition name="fade" mode="out-in">
      <div v-if="!isTimerActive" class="card-container" key="cards">
        <div
          v-for="item in pomodoroStore.configs"
          :key="item.id"
          class="task-card"
          :class="{ 'shake-animation': isEditMode }"
          :style="{ background: item.bg }"
          @click="selectCard(item)"
        >
          <div class="card-content">
            <div class="card-info">
              <div class="card-title">{{ item.title }}</div>
              <div class="card-time">{{ item.time }} min</div>
            </div>
            <div v-if="!isEditMode" class="settings-btn" @click.stop="openSettings(item)">
              设置
              <icon-settings />
            </div>
            <div v-else class="delete-btn" @click.stop="deleteCard(item)">
              <icon-close />
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

    <label v-if="!isTimerActive" class="fab-container" @click.prevent.stop="toggleEditMode">
      <input type="checkbox" :checked="isEditMode" />

      <svg
        class="icon-edit"
        xmlns="http://www.w3.org/2000/svg"
        width="100"
        height="1em"
        viewBox="0 0 30 30"
      >
        <path
          d="M 22.828125 3 C 22.316375 3 21.804562 3.1954375 21.414062 3.5859375 L 19 6 L 24 11 L 26.414062 8.5859375 C 27.195062 7.8049375 27.195062 6.5388125 26.414062 5.7578125 L 24.242188 3.5859375 C 23.851688 3.1954375 23.339875 3 22.828125 3 z M 17 8 L 5.2597656 19.740234 C 5.2597656 19.740234 6.1775313 19.658 6.5195312 20 C 6.8615312 20.342 6.58 22.58 7 23 C 7.42 23.42 9.6438906 23.124359 9.9628906 23.443359 C 10.281891 23.762359 10.259766 24.740234 10.259766 24.740234 L 22 13 L 17 8 z M 4 23 L 3.0566406 25.671875 A 1 1 0 0 0 3 26 A 1 1 0 0 0 4 27 A 1 1 0 0 0 4.328125 26.943359 A 1 1 0 0 0 4.3378906 26.939453 L 4.3632812 26.931641 A 1 1 0 0 0 4.3691406 26.927734 L 7 26 L 5.5 24.5 L 4 23 z"
        />
      </svg>

      <svg class="icon-add" xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 448 512">
        <path
          d="M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32V224H48c-17.7 0-32 14.3-32 32s14.3 32 32 32H192V432c0 17.7 14.3 32 32 32s32-14.3 32-32V288H400c17.7 0 32-14.3 32-32s-14.3-32-32-32H256V80z"
        />
      </svg>
    </label>

    <a-modal
      v-model:visible="settingsVisible"
      :title="editForm.id === -1 ? '新增专注卡片' : '卡片设置'"
      @ok="handleSaveSettings"
    >
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
      :src="`currentPath/assets/voices/timer/{currentPath}/assets/voices/timer/currentPath/assets/voices/timer/{role}/halfTime.wav`"
    ></audio>
    <audio
      ref="audioFullTimePlayer"
      :src="`currentPath/assets/voices/timer/{currentPath}/assets/voices/timer/currentPath/assets/voices/timer/{role}/fullTime.wav`"
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
  position: relative;
}
.card-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
  padding: 20px;
  width: 90%;
  max-width: 800px;
  min-height: 50vh;
  align-content: start;
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
@keyframes shake {
  0% {
    transform: rotate(0deg);
  }
  25% {
    transform: rotate(1deg);
  }
  50% {
    transform: rotate(0deg);
  }
  75% {
    transform: rotate(-1deg);
  }
  100% {
    transform: rotate(0deg);
  }
}
.shake-animation {
  animation: shake 0.3s infinite ease-in-out;
  cursor: default;
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
.delete-btn {
  background: rgba(255, 0, 0, 0.7);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
.delete-btn:hover {
  background: red;
  transform: scale(1.1);
}

/* === 新版 SVG 动画 FAB 按钮样式 === */
.fab-container {
  /* 基础定位和样式 (继承自原先的蓝色圆形按钮) */
  position: absolute;
  bottom: 40px;
  right: 40px;
  width: 60px;
  height: 60px;
  background-color: #409eff;
  border-radius: 50%;
  box-shadow: 0 4px 15px rgba(64, 158, 255, 0.4);
  cursor: pointer;
  z-index: 100;
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);

  /* Flex 布局用于居中 SVG */
  display: flex;
  justify-content: center;
  align-items: center;

  /* SVG 基础设置 */
  font-size: 30px; /* 控制图标大小 */
  fill: white; /* 图标颜色 */
  user-select: none;
}

/* 整体 Hover 效果 */
.fab-container:hover {
  transform: scale(1.1);
  box-shadow: 0 8px 25px rgba(64, 158, 255, 0.6);
}

/* 隐藏 input checkbox */
.fab-container input {
  position: absolute;
  opacity: 0;
  cursor: pointer;
  height: 0;
  width: 0;
}

/* SVG 动画逻辑 */
.fab-container .icon-edit {
  position: absolute;
  animation: keyframes-fill 0.3s;
}
.fab-container .icon-add {
  position: absolute;
  display: none;
  animation: keyframes-fill 0.3s;
}

/* 根据 checkbox 状态切换显示 */
.fab-container input:checked ~ .icon-edit {
  display: none;
}
.fab-container input:checked ~ .icon-add {
  display: block;
}

/* 动画关键帧 */
@keyframes keyframes-fill {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  50% {
    transform: scale(1.1);
  }
}

/* 计时器样式 (保持不变) */
.timer-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  animation: fadeIn 0.5s ease;
}
:deep(.arco-progress-circle) {
  width: 400px !important;
  height: 400px !important;
}
:deep(.arco-progress-circle-svg) {
  transform: rotate(-90deg);
}
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