<script setup>
import { ref } from "vue";
import { useCustomSettingsStore } from "@/stores/CustomSettings";
import { Message } from "@arco-design/web-vue";
const customSettingsStore = useCustomSettingsStore();

let form = ref({ ...customSettingsStore.customSettings.shortcutKeys }); // 解构避免对象出现响应性

// 恢复默认设置
const resetForm = () => {
  customSettingsStore.resetShortcutKeys();
  updateForm(); // 重新渲染
  Message.success("重置成功🙂");
};

// 添加时钟设置相关的状态
const clockForm = ref({
  duration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  longBreakInterval: 4,
});

// 初始化时钟设置表单
if (customSettingsStore.customSettings.pomodoroSettings) {
  clockForm.value = customSettingsStore.customSettings.pomodoroSettings;
}

// 重置时钟设置表单
const resetClockForm = () => {
  const defaultForm = {
    duration: 25,
    shortBreakDuration: 5,
    longBreakDuration: 15,
    longBreakInterval: 4,
  };
  Object.assign(clockForm.value, defaultForm);
  Message.success("时钟设置已重置🙂");
};

// 滑动栏刻度配置
const durationMarks = {
  15: "15",
  25: "25",
  35: "35",
  45: "45",
  55: "55",
};
const shortBreakDurationMarks = {
  3: "3",
  6: "6",
  9: "9",
  12: "12",
  15: "15",
};
const longBreakDurationMarks = {
  5: "5",
  10: "10",
  15: "15",
  20: "20",
  25: "25",
};
const longBreakIntervalMarks = {
  2: "2",
  3: "3",
  4: "4",
  5: "5",
  6: "6",
};

// 背景图相关状态
const fFile = ref(null);
const wFile = ref(null);

// 处理路径
const handlePath = (originPath) => {
  const formattedValue = originPath.replace(/\\/g, "/").replace(/\s/g, "%20");
  return `file:///${formattedValue}`;
};

// 显示上传进度
const onFProgress = (currentFile) => {
  fFile.value = currentFile;
};
const onWProgress = (currentFile) => {
  wFile.value = currentFile;
};

// 存储全屏背景图片
const onFChange = (_, currentFile) => {
  fFile.value = {
    ...currentFile,
  };
  window.electron
    .saveFile("f-pomodoro", fFile.value.file.path)
    .then((filepath) => {
      if (filepath) {
        Message.success(`背景图设置成功 ٩(◕‿◕｡)۶`);
        customSettingsStore.customSettings["f-pomodoro-bgi"] = handlePath(
          window.electron.getAppPath() + filepath
        );
      }
    })
    .catch((error) => {
      console.log(error);
      Message.error("背景图设置失败 (｡•́︿•̀｡)");
    });
};

// 重置背景图
const resetBGI = () => {
  customSettingsStore.resetPomodoroBGI();
  Message.success("重置成功🙂");
  fFile.value = null;
  wFile.value = null;
};

// 语音设置
const voiceForm = ref(null);
voiceForm.value = customSettingsStore.customSettings.voice;

// 重置语音设置表单
const resetVoiceForm = () => {
  customSettingsStore.resetVoiceSettings();
  voiceForm.value = customSettingsStore.customSettings.voice;
  Message.success("重置成功🙂");
};
</script>

<template>
  <div class="app">
    <!-- 时钟设置 -->
    <div class="section-title">时钟设置</div>
    <a-form :model="clockForm" :style="{ width: '600px' }">
      <a-form-item
        field="longBreakDuration"
        tooltip="一个番茄周期后休息的时间"
        label="长休息"
      >
        <a-slider
          v-model="clockForm.longBreakDuration"
          :default-value="15"
          :style="{ width: '300px' }"
          :max="25"
          :min="5"
          :marks="longBreakDurationMarks"
        />
      </a-form-item>
      <a-form-item
        field="longBreakInterval"
        tooltip="您本次专注的轮数"
        label="番茄周期"
      >
        <a-slider
          v-model="clockForm.longBreakInterval"
          :default-value="4"
          :style="{ width: '300px' }"
          :max="6"
          :min="2"
          :marks="longBreakIntervalMarks"
        />
      </a-form-item>
      <a-form-item>
        <a-button @click="resetClockForm">恢复默认设置</a-button>
      </a-form-item>
    </a-form>

    <a-divider></a-divider>

    <!-- 背景图设置 -->
    <div class="section-title">背景图设置</div>
    <div class="background">
      <div class="hint" style="color: rgb(78, 89, 105); margin: 20px 0px 0 10px">
        更改全屏背景图：
      </div>
      <a-upload
        action="/"
        :fileList="fFile ? [fFile] : []"
        :show-file-list="false"
        @change="onFChange"
        @process="onFProgress"
        :auto-upload="false"
      >
        <template #upload-button>
          <div
            :class="`arco-upload-list-item${
              fFile && fFile.status === 'error'
                ? ' arco-upload-list-item-error'
                : ''
            }`"
          >
            <div
              class="arco-upload-list-picture custom-upload-avatar"
              v-if="fFile && fFile.url"
            >
              <img :src="fFile.url" style="object-fit: cover" />
              <div class="arco-upload-list-picture-mask">
                <IconEdit />
              </div>
              <a-progress
                v-if="fFile.status === 'uploading' && fFile.percent < 100"
                :percent="fFile.percent"
                type="circle"
                size="mini"
                :style="{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: 'translateX(-50%) translateY(-50%)',
                }"
              />
            </div>
            <div class="arco-upload-picture-card" v-else>
              <div class="arco-upload-picture-card-text">
                <IconPlus />
                <div style="margin-top: 10px; font-weight: 600">上传</div>
              </div>
            </div>
          </div>
        </template>
      </a-upload>
      <!-- 重置背景图按钮 -->
      <a-button @click="resetBGI" style="margin: auto 0px auto 30px"
        >恢复默认背景</a-button
      >
    </div>

    <a-divider></a-divider>

    <!-- 语音设置 -->
    <div class="section-title">语音设置</div>
    <a-form :model="voiceForm" layout="inline">
      <a-form-item field="voiceForm.pomodoroV" label="番茄钟">
        <a-select
          size="small"
          style="width: 100px"
          v-model="voiceForm.pomodoroV"
        >
          <a-option value="default">东雪莲</a-option>
          <a-option value="dingzhen">丁真</a-option>
          <a-option value="jiaran">嘉然</a-option>
          <a-option value="Kobe">科比</a-option>
        </a-select>
      </a-form-item>

      <a-form-item field="voiceForm.timerV" label="计时器">
        <a-select size="small" style="width: 100px" v-model="voiceForm.timerV">
          <a-option value="default">东雪莲</a-option>
          <a-option value="dingzhen">丁真</a-option>
          <a-option value="jiaran">嘉然</a-option>
          <a-option value="Kobe">科比</a-option>
        </a-select>
      </a-form-item>
      <a-form-item field="voiceForm.todoV" label="待办">
        <a-select size="small" style="width: 100px" v-model="voiceForm.todoV">
          <a-option value="default">东雪莲</a-option>
          <a-option value="dingzhen">丁真</a-option>
          <a-option value="jiaran">嘉然</a-option>
          <a-option value="Kobe">科比</a-option>
        </a-select>
      </a-form-item>
      <a-form-item field="voiceForm.isClosedV" label="关闭语音提示">
        <a-switch v-model="voiceForm.isClosedV" />
      </a-form-item>
      <a-form-item>
        <a-button @click="resetVoiceForm">恢复默认</a-button>
      </a-form-item>
    </a-form>
  </div>
</template>


<style scoped>
.app {
  padding: 20px;
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 20px;
  color: var(--color-text-1);
}

/* 背景图设置部分样式 */
.background {
  display: flex;
  margin: 40px 0px 0px 0px;
}

/* 对arco design的组件间距进行微调 */
:deep(.arco-form-item-label-col) {
  line-height: 60px;
}

:deep(.arco-form-item) {
  margin-bottom: 0px;
}
</style>
