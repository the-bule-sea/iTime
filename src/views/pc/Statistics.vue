<script setup>
import { computed, ref } from "vue";
import dayjs from "dayjs"; 
import { useStatisticsStore } from "@/stores/StatisticsStore";
import { use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { PieChart, LineChart } from "echarts/charts";
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent
} from "echarts/components";
import VChart from "vue-echarts";
import { DatePicker } from '@arco-design/web-vue';
import '@arco-design/web-vue/dist/arco.css';

use([
  CanvasRenderer,
  PieChart,
  LineChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent
]);

const statsStore = useStatisticsStore();

// --- 月份筛选逻辑 ---
// 默认为当前时间
const selectedMonth = ref(Date.now());

// 计算属性：将选中的日期对象转为 "YYYY-MM" 字符串
// 监听 selectedMonth 变化，传给 Store
const currentMonthStr = computed(() => {
  return dayjs(selectedMonth.value).format('YYYY-MM');
});

const colorPalette = [
  "#AAB7B8", "#FFAAA5", "#C3B1E1", "#A8E6CF", "#90CAF9", 
  "#D8C3A5", "#DCEDC1", "#FFD3B6", "#FF8B94", "#B39DDB", 
  "#9FA8DA", "#81D4FA", "#80DEEA", "#4DD0E1", "#4DB6AC"
];

// --- 图表配置 ---
const pieOption = computed(() => {
  // 调用 Store 中按月筛选的方法
  const data = statsStore.categoryDistributionByMonth(currentMonthStr.value);

  return {
    title: { 
      text: "专注内容分布", 
      left: "center",
      top: 10,
      textStyle: { fontSize: 16 }
    },
    tooltip: { trigger: "item", formatter: "{b}: {c}分钟 ({d}%)" },
    legend: { bottom: "5%", left: "center" },
    series: [
      {
        name: "专注内容",
        type: "pie",
        radius: ["40%", "65%"],
        center: ['50%', '55%'],
        color: colorPalette,
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 10, borderColor: "#fff", borderWidth: 2 },
        label: { show: false },
        emphasis: {
          label: { show: true, fontSize: 18, fontWeight: "bold" }
        },
        data: data.length > 0 ? data : [{ value: 0, name: "暂无数据" }]
      }
    ]
  };
});

const lineOption = computed(() => {
  const trendData = statsStore.last7DaysTrend;
  return {
    title: { 
      text: "近7天专注时长 (分钟)", 
      left: "center",
      top: 10
    },
    tooltip: { trigger: "axis" },
    grid: { left: "3%", right: "4%", bottom: "3%", containLabel: true },
    xAxis: { type: "category", boundaryGap: false, data: trendData.days },
    yAxis: { type: "value" },
    series: [
      {
        name: "时长",
        type: "line",
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 3, color: '#9FA8DA' },
        areaStyle: { opacity: 0.3, color: "#9FA8DA" },
        data: trendData.data
      }
    ]
  };
});
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
      <div class="chart-box left-chart">
        <v-chart class="chart" :option="lineOption" autoresize />
      </div>

      <div class="right-column">
        <div class="month-selector-box">
           <a-month-picker 
             v-model="selectedMonth"
             picker="month" 
             style="width: 100%;" 
             placeholder="选择月份"
           />
        </div>
        
        <div class="chart-box right-chart">
          <v-chart class="chart" :option="pieOption" autoresize />
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* --- 0. 核心修复：强制全局盒模型 --- */
/* 这行代码能解决 99% 的对齐和溢出问题 */
* {
  box-sizing: border-box;
}

/* 整个容器撑满父元素 */
.stats-container {
  height: 100%;
  padding: 20px;
  background-color: #f7f8fa;
  display: flex;
  flex-direction: column;
  overflow: hidden; /* 禁止页面滚动 */
}

/* --- 顶部概览卡片 --- */
.overview-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 20px;
  flex-shrink: 0; /* 防止被图表挤压 */
}

.stat-card {
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  color: white;
  transition: transform 0.2s;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.stat-card:hover { transform: translateY(-3px); }

.pink { background: #ff8b94; }
.blue { background: #c4b7d6; }
.yellow { background: #d8c3a5; }
.green { background: #c1dcbb; }

.stat-label { font-size: 14px; opacity: 0.9; margin-bottom: 8px; }
.stat-value { font-size: 32px; font-weight: bold; }

/* --- 图表区域布局 --- */
.charts-row {
  display: grid;
  grid-template-columns: 2fr 1fr; /* 左2右1 */
  gap: 20px;
  /* 自动占满剩余空间 */
  flex: 1; 
  /* 关键：防止Grid溢出 */
  min-height: 0; 
  /* 关键：Grid 默认行为是 stretch (拉伸)，这保证左右两列高度物理一致 */
  align-items: stretch; 
  padding-bottom: 5px;
}

/* --- 左侧盒子 --- */
.left-chart {
  /* 直接复用 chart-box 样式，不需要额外的高度 hack */
  height: 100% !important; /* 强制填满 Grid 单元格 */
  position: relative;
}

/* --- 右侧列布局 --- */
.right-column {
  display: flex;
  flex-direction: column;
  gap: 15px;
  height: 100%;
  min-height: 0;
}

/* 通用白盒子样式 */
.chart-box, .month-selector-box {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.chart-box {
  padding: 20px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* 月份选择器容器 */
.month-selector-box {
  padding: 10px;
  flex-shrink: 0; /* 固定高度，不被压缩 */
}

/* 右侧饼图容器 */
.right-chart {
  flex: 1; /* 占满右侧剩余空间 */
  height: auto; /* 让 flex 控制高度 */
  min-height: 0;
}

.chart {
  width: 100%;
  height: 100%;
}
</style>