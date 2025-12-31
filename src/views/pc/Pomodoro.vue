<script setup>
import { ref, computed, onMounted, onUnmounted, reactive, watch } from "vue";
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
const currentPath = window.electron.getAppPath();
const backgroundImage = computed(
  () => customSettingsStore.customSettings["f-pomodoro-bgi"]
);

// 初始化番茄钟 Store
const pomodoroStore = usePomodoroStore();

// --- 全局设置 (读取长休息配置) ---
const globalSettings = computed(() => {
  return (
    customSettingsStore.customSettings.pomodoroSettings || {
      longBreakDuration: 15,
      longBreakInterval: 4
    }
  );
});

// --- 休息语录轮播 ---
const restQuotes = ref([
  "上厕所",
  "喝水",
  "Dream it possible",
  "不管怎么样，明天又是新的一天",
  "你很棒，坚持下去",
  "休息是为了更好的前进",
  "累了困了，站起来走走",
  "只要不停下脚步，道路就会...不断延伸！",
  "今天也要加油哦",
  "再喝一口水"
]);
const currentQuoteIndex = ref(0);
let quoteIntervalId = null;

// 开始轮播语录
const startQuoteRotation = () => {
  if (quoteIntervalId) clearInterval(quoteIntervalId);
  quoteIntervalId = setInterval(() => {
    currentQuoteIndex.value =
      (currentQuoteIndex.value + 1) % restQuotes.value.length;
  }, 60000);
};

// 停止轮播语录
const stopQuoteRotation = () => {
  if (quoteIntervalId) {
    clearInterval(quoteIntervalId);
    quoteIntervalId = null;
  }
  currentQuoteIndex.value = 0;
};

// --- 计时器核心状态 ---
const isTimerActive = ref(false); // 是否在倒计时界面
const isRunning = ref(false); // 是否正在读秒
const percent = ref(0);
const totalTime = ref(0);
const originTime = ref(0);
let intervalId = null;
let halfFirst = true;

// --- 核心逻辑状态 ---
const currentCard = ref(null); // 当前选中的卡片数据
const cycleCount = ref(0); // 当前已完成的番茄数
// 阶段状态: 'focus'(专注), 'shortBreak'(短休), 'longBreak'(长休)
const currentPhase = ref("focus");

// 计算当前阶段的提示文案
const phaseTip = computed(() => {
  if (currentPhase.value === "shortBreak") return "短休息";
  if (currentPhase.value === "longBreak") return "长休息";
  return "";
});

// --- 模式控制状态 ---
const isEditMode = ref(false);
const settingsVisible = ref(false);
const colorPalette = [
  "#AAB7B8",
  "#B2BEB5",
  "#FFAAA5",
  "#C3B1E1",
  "#A8E6CF",
  "#DCEDC1",
  "#FFD3B6",
  "#FF8B94",
  "#B39DDB",
  "#D8C3A5",
  "#9FA8DA",
  "#90CAF9",
  "#81D4FA",
  "#80DEEA",
  "#4DD0E1",
  "#4DB6AC",
  "#81C784",
  "#AED581",
  "#DCE775",
  "#FFF59D"
];
const editForm = reactive({ id: -1, title: "", time: 25, shortBreak: 5 });
const durationMarks = {
  15: "15",
  20: "20",
  25: "25",
  30: "30",
  35: "35",
  40: "40",
  45: "45",
  50: "50",
  55: "55",
  60: "60",
  90: "90",
  120: "120",
};
const shortBreakMarks = { 3: "3", 6: "6", 9: "9", 12: "12", 15: "15" };

// --- 动作函数 ---
const toggleEditMode = () => {
  if (isEditMode.value) {
    openAddModal();
  } else {
    isEditMode.value = true;
    Message.info("已进入编辑模式");
  }
};
const openAddModal = () => {
  editForm.id = -1;
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
const handleBackgroundClick = e => {
  if (isEditMode.value && e.target.classList.contains("card-container"))
    isEditMode.value = false;
};

// --- 核心：选择卡片并初始化 ---
const selectCard = config => {
  if (isEditMode.value) return;

  // 1. 初始化数据
  currentCard.value = config;
  currentPhase.value = "focus"; // 默认为专注模式
  cycleCount.value = 0; // 重置周期计数

  // 2. 设置时间
  setTimer(config.time);

  // 3. 启动
  isTimerActive.value = true;
  startTimer();
};

// 辅助函数：设置倒计时时间
const setTimer = minutes => {
  originTime.value = minutes * 60;
  totalTime.value = originTime.value;
  percent.value = 0;
  halfFirst = true;
};

// --- 计时器逻辑 ---
// 播放器对象 (新增三个专用播放器)
const audioShortBreakPlayer = ref(null);
const audioLongBreakPlayer = ref(null);
const audioFocusPlayer = ref(null);
// 保持半程提示播放器 (如果 assets/voices/timer 下有这个文件则保留，否则也可以换成 pomodoro 下的)
const audioHalfTimePlayer = ref(null);

const role = computed(
  () => customSettingsStore.customSettings.voice.pomodoroV ?? "default"
); // 注意：这里改为读取番茄钟的角色配置 pomodoroV，而不是 timerV
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
      } else {
        // --- 倒计时结束，处理逻辑流 ---
        handleTimerComplete();
      }
    }, 1000);
  }
};

// --- 核心：时间结束处理逻辑 (状态机 + 音效) ---
const handleTimerComplete = () => {
  clearInterval(intervalId);
  intervalId = null;
  isRunning.value = false;
  percent.value = 1;

  // 1. 判断当前阶段并流转
  if (currentPhase.value === "focus" && currentCard.value) {
    // 专注结束 -> 记录数据
    statisticsStore.addRecord({
      cardTitle: currentCard.value.title,
      duration: currentCard.value.time,
      type: "focus"
    });
    cycleCount.value++;

    const interval = globalSettings.value.longBreakInterval || 4;

    // 判断是长休息还是短休息
    if (cycleCount.value % interval === 0) {
      // -> 进入长休息
      currentPhase.value = "longBreak";
      const longBreakTime = globalSettings.value.longBreakDuration || 15;
      setTimer(longBreakTime);
      startQuoteRotation();

      // 播放长休息音效
      !isClosed.value && audioLongBreakPlayer.value?.play();
      window.electron.notificationUser("pomodoro-longBreak");
      Message.success(`恭喜完成一轮！开始 ${longBreakTime} 分钟长休息`);
    } else {
      // -> 进入短休息
      currentPhase.value = "shortBreak";
      // 优先使用卡片单独设置的短休息时间
      const shortBreakTime = currentCard.value.shortBreak || 5;
      stopQuoteRotation();
      setTimer(shortBreakTime);

      // 播放短休息音效
      !isClosed.value && audioShortBreakPlayer.value?.play();
      window.electron.notificationUser("pomodoro-shortBreak");
      Message.info(`专注结束，休息 ${shortBreakTime} 分钟`);
    }
  } else {
    // 休息结束 -> 专注
    currentPhase.value = "focus";
    setTimer(currentCard.value.time);

    // 播放专注开始音效
    !isClosed.value && audioFocusPlayer.value?.play();
    window.electron.notificationUser("pomodoro-work");
    Message.info("休息结束，准备开始新一轮专注");
  }

  // 自动开始下一轮
  startTimer();
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
        <transition name="fade">
          <div
            v-if="currentPhase === 'longBreak'"
            class="rest-quote"
            key="quote"
          >{{ restQuotes[currentQuoteIndex] }}</div>
        </transition>

        <a-progress
          :percent="percent"
          type="circle"
          size="large"
          :width="400"
          :color="currentPhase === 'focus' ? 'rgb(12, 228, 140)' : '#409EFF'"
          class="big-timer-progress"
        >
          <template #text>
            <div class="inner-timer-container">
              <div class="phase-info" :class="currentPhase">
                <div v-if="currentPhase != 'focus'" class="phase-badge">{{ phaseTip }}</div>
              </div>

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
            :max="120"
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
      :src="`${currentPath}/assets/voices/timer/{role}/halfTime.wav`"
    ></audio>
    <audio
      ref="audioShortBreakPlayer"
      :src="`${currentPath}/assets/voices/pomodoro/{role}/shortBreak.wav`"
    ></audio>
    <audio
      ref="audioLongBreakPlayer"
      :src="`${currentPath}/assets/voices/pomodoro/{role}/longBreak.wav`"
    ></audio>
    <audio
      ref="audioFocusPlayer"
      :src="`${currentPath}/assets/voices/pomodoro/{role}/focus.wav`"
    ></audio>
  </div>
</template>

<style scoped>
/* 保持所有样式不变，无需改动 */
.phase-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  margin-bottom: 5px;
}
.phase-badge {
  font-size: 1.5rem;
  font-weight: bold;
  color: #fff;
  background: rgba(255, 255, 255, 0.2);
  padding: 5px 15px;
  border-radius: 20px;
  backdrop-filter: blur(5px);
}
.cycle-count {
  font-size: 0.9rem;
  opacity: 0.8;
  color: white;
}
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
.fab-container {
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
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 30px;
  fill: white;
  user-select: none;
}
.fab-container:hover {
  transform: scale(1.1);
  box-shadow: 0 8px 25px rgba(64, 158, 255, 0.6);
}
.fab-container input {
  position: absolute;
  opacity: 0;
  cursor: pointer;
  height: 0;
  width: 0;
}
.fab-container .icon-edit {
  position: absolute;
  animation: keyframes-fill 0.3s;
}
.fab-container .icon-add {
  position: absolute;
  display: none;
  animation: keyframes-fill 0.3s;
}
.fab-container input:checked ~ .icon-edit {
  display: none;
}
.fab-container input:checked ~ .icon-add {
  display: block;
}
@keyframes keyframes-fill {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  50% {
    transform: scale(1.1);
  }
}
.timer-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  animation: fadeIn 0.5s ease;
  position: relative;
}
.rest-quote {
  position: absolute;
  top: -80px;
  left: 50%;
  transform: translateX(-50%);
  width: max-content;
  max-width: 600px;
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
  font-size: 1.6rem;
  font-weight: bold;
  color: #fff;
  background: rgba(255, 255, 255, 0.15);
  padding: 10px 25px;
  border-radius: 15px;
  backdrop-filter: blur(5px);
  z-index: 10;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
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