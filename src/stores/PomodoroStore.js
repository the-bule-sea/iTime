import { defineStore } from "pinia";
import { ref } from "vue";
// 记录用户时间card信息
export const usePomodoroStore = defineStore('pomodoro-data', {
  // state: 定义我们需要保存的数据
  state: () => ({
    configs: [
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
    ]
  }),
  
  // actions: 定义修改数据的方法
  actions: {
    updateConfig(newConfig) {
      const index = this.configs.findIndex(i => i.id === newConfig.id);
      if (index !== -1) {
        // 更新对应卡片的数据
        Object.assign(this.configs[index], newConfig);
      }
    },
    // 可选：如果用户搞乱了，提供一个重置回默认的方法
    resetToDefault() {
        this.$reset();
    }
  },

  // 核心：开启持久化
  // 数据会自动保存到 localStorage 中，key 为 'pomodoro-data'
  persist: true
});