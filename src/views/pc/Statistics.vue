<script setup>
import { computed } from "vue";
import { useStatisticsStore } from "@/stores/StatisticsStore";
import { use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { PieChart, LineChart, BarChart } from "echarts/charts";
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent
} from "echarts/components";
import VChart from "vue-echarts";

// 注册 ECharts 组件
use([
  CanvasRenderer,
  PieChart,
  LineChart,
  BarChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent
]);

const statsStore = useStatisticsStore();

// --- 图表配置 ---
const colorPalette = [
  "#AAB7B8", // 灰蓝
  "#FFAAA5", // 珊瑚粉
  "#C3B1E1", // 淡紫
  "#A8E6CF", // 薄荷绿
  "#90CAF9", // 天空蓝
  "#D8C3A5", // 杏色
  "#DCEDC1", // 浅绿
  "#FFD3B6", // 蜜桃色
  "#FFAAA5", // 珊瑚粉
  "#FF8B94", // 柔和红
  "#B39DDB", // 薰衣草紫
  "#9FA8DA", // 柔和蓝
  "#81D4FA", // 淡蓝
  "#80DEEA", // 青色
  "#4DD0E1", // 青绿
  "#4DB6AC", // 青绿
  "#81C784", // 柔和绿
  "#AED581", // 柠檬绿
  "#DCE775", // 浅黄绿
  "#FFF59D", // 柔和黄
  "#B2BEB5" // 灰绿
];

// 1. 饼图配置 (专注分布)
const pieOption = computed(() => ({
  title: { text: "专注内容分布", left: "center" },
  tooltip: { trigger: "item", formatter: "{b}: {c}分钟 ({d}%)" },
  legend: { bottom: "0%", left: "center" },
  series: [
    {
      name: "专注内容",
      type: "pie",
      radius: ["40%", "70%"], // 环形图
      color: colorPalette,
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 10, borderColor: "#fff", borderWidth: 2 },
      label: { show: false, position: "center" },
      emphasis: {
        label: { show: true, fontSize: 20, fontWeight: "bold" }
      },
      data:
        statsStore.categoryDistribution.length > 0
          ? statsStore.categoryDistribution
          : [{ value: 0, name: "暂无数据" }]
    }
  ]
}));

// 2. 折线图配置 (近7天趋势)
const lineOption = computed(() => {
  const trendData = statsStore.last7DaysTrend;
  return {
    title: { text: "近7天专注时长 (分钟)" },
    tooltip: { trigger: "axis" },
    grid: { left: "3%", right: "4%", bottom: "3%", containLabel: true },
    xAxis: { type: "category", boundaryGap: false, data: trendData.days },
    yAxis: { type: "value" },

    series: [
      {
        name: "时长",
        type: "line",
        stack: "Total",
        smooth: true,
        lineStyle: { width: 0 },
        showSymbol: false,
        areaStyle: { opacity: 0.8, color: "#9FA8DA" },
        emphasis: { focus: "series" },
        data: trendData.data
      }
    ]
  };
});
// 清除数据按钮(调试用)
const handleClearData = () => {
  if (confirm("确定要清除所有统计数据吗？")) {
    statsStore.clearData();
  }
}
</script>

<template>
  <div class="stats-container">
    <div class="overview-cards">
      <div class="stat-card pink">
        <div class="stat-label">累计专注 (次)</div>
        <div class="stat-value">{{ statsStore.totalCount }}</div>
      </div>
      <div class="stat-card blue">
        <div class="stat-label">累计时长 (分钟)</div>
        <div class="stat-value">{{ statsStore.totalDuration }}</div>
      </div>
      <div class="stat-card yellow">
        <div class="stat-label">今日专注 (次)</div>
        <div class="stat-value">{{ statsStore.todayStats.count }}</div>
      </div>
      <div class="stat-card green">
        <div class="stat-label">今日时长 (分钟)</div>
        <div class="stat-value">{{ statsStore.todayStats.duration }}</div>
      </div>
    </div>

    <div class="charts-row">
      <div class="chart-box">
        <v-chart class="chart" :option="lineOption" autoresize />
      </div>
      <div class="chart-box">
        <v-chart class="chart" :option="pieOption" autoresize />
      </div>
    </div>
    <div class="clear-btn-container">
      <button @click="handleClearData" class="clear-btn">清除统计数据</button>
    </div>
  </div>
</template>

<style scoped>
.stats-container {
  padding: 30px;
  height: 100%;
  overflow-y: auto;
  background-color: #f7f8fa; /* 浅灰背景，突出卡片 */
}

/* --- 概览卡片样式 --- */
.overview-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 30px;
}

.stat-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  transition: transform 0.2s;
  color: white; /* 文字白色 */
}

.stat-card:hover {
  transform: translateY(-4px);
}

.pink {
  background: #ff8b94;
}
.blue {
  background: #c4b7d6;
}
.yellow {
  background: #d8c3a5;
}
.green {
  background: #c1dcbb;
}

.stat-label {
  font-size: 14px;
  opacity: 0.9;
  margin-bottom: 10px;
}

.stat-value {
  font-size: 32px;
  font-weight: bold;
}

/* --- 图表样式 --- */
.charts-row {
  display: grid;
  grid-template-columns: 2fr 1fr; /* 左2右1比例 */
  gap: 20px;
  height: 400px;
}

.chart-box {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
}

.chart {
  height: 100%;
  width: 100%;
}

/* 清除按钮样式 */
.clear-btn-container {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 20px;
}

.clear-btn {
  background-color: #FF8B94;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s;
}

.clear-btn:hover {
  background-color: #FF6B75;
}

</style>