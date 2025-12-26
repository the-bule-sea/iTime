<script setup>
import { ref, computed, onMounted, onUnmounted, reactive } from "vue";
import { useCustomSettingsStore } from "@/stores/CustomSettings";
import { usePomodoroStore } from "@/stores/PomodoroStore";
import { Message, Modal } from "@arco-design/web-vue";
import {
  IconPlayArrow,
  IconPause,
  IconRefresh,
  IconSettings,
  IconEdit,
  IconPlus,
  IconClose
} from "@arco-design/web-vue/es/icon";

// --- 基础配置与 Store ---
const customSettingsStore = useCustomSettingsStore();
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
const isEditMode = ref(false); // 是否处于“删除模式”

// --- 编辑弹窗状态 ---
const settingsVisible = ref(false);
// 默认背景色池，新增时随机取一个
const colorPalette = [
  "#AAB7B8", // 灰蓝
  "#B2BEB5", // 灰绿
  "#D8C3A5", // 杏色
  "#C3B1E1", // 淡紫
  "#A8E6CF", // 薄荷绿
  "#DCEDC1", // 浅绿
  "#FFD3B6", // 蜜桃色
  "#FFAAA5", // 珊瑚粉
  "#FF8B94", // 柔和红
  "#B39DDB", // 薰衣草紫
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

const toggleEditMode = () => {
  if (isEditMode.value) {
    // 如果已经在编辑模式，点击按钮则视为“新增”
    openAddModal();
  } else {
    // 进入编辑模式（显示删除按钮，FAB 变为 + 号）
    isEditMode.value = true;
    Message.info("已进入编辑模式，点击 X 删除卡片，点击右下角 + 新增");
  }
};

const openAddModal = () => {
  editForm.id = -1; // 标记为新增
  editForm.title = "";
  editForm.time = 25;
  editForm.shortBreak = 5;
  settingsVisible.value = true;
};

const openSettings = item => {
  editForm.id = item.id;
  editForm.title = item.title;
  editForm.time = item.time;
  editForm.shortBreak = item.shortBreak || 5;
  settingsVisible.value = true;
};

const handleSaveSettings = () => {
  if (!editForm.title) {
    Message.warning("请输入标题");
    return;
  }

  if (editForm.id === -1) {
    // 新增逻辑
    const newId = Date.now(); // 简单生成唯一ID
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
    // 新增完退出编辑模式
    isEditMode.value = false;
  } else {
    // 修改逻辑
    pomodoroStore.updateConfig(editForm);
    Message.success("设置已更新");
  }
  settingsVisible.value = false;
};

const deleteCard = item => {
  Modal.warning({
    title: "确认删除",
    content: `确定要删除 ${item.title} 吗？`,
    onOk: () => {
      const index = pomodoroStore.configs.findIndex(i => i.id === item.id);
      if (index !== -1) {
        pomodoroStore.configs.splice(index, 1);
        Message.success("已删除");
        // 如果删完了，自动退出编辑模式
        if (pomodoroStore.configs.length === 0) isEditMode.value = false;
      }
    }
  });
};

const handleBackgroundClick = e => {
  // 只有点击背景容器本身才退出，点击卡片或按钮不退出
  if (isEditMode.value && e.target.classList.contains("card-container")) {
    isEditMode.value = false;
  }
};

const selectCard = config => {
  // 编辑模式下点击卡片不触发计时，只允许删除操作
  if (isEditMode.value) return;

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

    <div v-if="!isTimerActive" class="fab-btn" @click.stop="toggleEditMode">
      <transition name="rotate">
        <icon-plus v-if="isEditMode" size="30" />
        <icon-edit v-else size="30" />
      </transition>
    </div>

    <a-modal
      v-model:visible="settingsVisible"
      :title="editForm.id === -1 ? '新增专注卡片' : '卡片设置'"
      @ok="handleSaveSettings"
    >
      <a-form :model="editForm" layout="vertical">
        <a-form-item label="标语内容 (标题)">
          <a-input v-model="editForm.title" placeholder="请输入名称..." allow-clear maxlength="10" />
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
  position: relative; /* 为FAB定位 */
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

/* 抖动动画 (iOS删除模式风格) */
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

/* 设置按钮 */
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

/* 删除按钮 (红色圆形) */
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

/* 悬浮操作按钮 (FAB) */
.fab-btn {
  position: absolute;
  bottom: 40px;
  right: 40px;
  width: 60px;
  height: 60px;
  background-color: #409eff; /* 蓝色主题 */
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  box-shadow: 0 4px 15px rgba(64, 158, 255, 0.4);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  z-index: 100;
}
.fab-btn:hover {
  transform: scale(1.1);
  box-shadow: 0 8px 25px rgba(64, 158, 255, 0.6);
}
/* 按钮图标旋转动画 */
.rotate-enter-active,
.rotate-leave-active {
  transition: all 0.2s ease;
}
.rotate-enter-from,
.rotate-leave-to {
  opacity: 0;
  transform: rotate(90deg);
}

/* 计时器相关样式 (保持不变) */
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