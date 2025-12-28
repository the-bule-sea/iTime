import { defineStore } from "pinia";
import dayjs from 'dayjs';
// 记录历史数据
export const useStatisticsStore = defineStore('statistics-data', {
  state: () => ({
    // 历史记录列表
    // 结构示例: { id: 170123456789, cardTitle: "深度专注", duration: 25, startTime: "...", endTime: "..." }
    history: []
  }),

  getters: {
    // 1. 累计专注次数
    totalCount: (state) => state.history.length,

    // 2. 累计专注时长 (分钟)
    totalDuration: (state) => {
      return state.history.reduce((sum, item) => sum + item.duration, 0);
    },

    // 3. 今日数据 { count, duration }
    todayStats: (state) => {
      const today = dayjs().format('YYYY-MM-DD');
      const todayRecords = state.history.filter(item => 
        dayjs(item.startTime).format('YYYY-MM-DD') === today
      );
      return {
        count: todayRecords.length,
        duration: todayRecords.reduce((sum, item) => sum + item.duration, 0)
      };
    },

    // 4. 专注内容分布 (用于饼图)
    categoryDistribution: (state) => {
      const map = {};
      state.history.forEach(item => {
        if (!map[item.cardTitle]) map[item.cardTitle] = 0;
        map[item.cardTitle] += item.duration;
      });
      // 转换为 ECharts 需要的格式 { name: '深度专注', value: 120 }
      return Object.keys(map).map(key => ({
        name: key,
        value: map[key]
      }));
    },

    // 5. 近7天趋势 (用于折线图)
    last7DaysTrend: (state) => {
      const days = [];
      const data = [];
      for (let i = 6; i >= 0; i--) {
        const dateStr = dayjs().subtract(i, 'day').format('YYYY-MM-DD');
        days.push(dayjs().subtract(i, 'day').format('MM-DD')); // X轴日期
        
        // 计算那天的总时长
        const dailySum = state.history
          .filter(item => dayjs(item.startTime).format('YYYY-MM-DD') === dateStr)
          .reduce((sum, item) => sum + item.duration, 0);
        
        data.push(dailySum);
      }
      return { days, data };
    }
  },

  actions: {
    // 记录一次专注
    addRecord(record) {
      this.history.push({
        id: Date.now(),
        startTime: new Date().toISOString(), // 实际上应该是开始时间，这里简化为结束时记录
        ...record
      });
    },
    
    // 清空数据（调试用）
    clearData() {
        this.history = [];
    }
  },

  // 开启持久化
  persist: true
});