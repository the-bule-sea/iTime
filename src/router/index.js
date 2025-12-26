import { createRouter, createWebHashHistory } from "vue-router";

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),  // 主要是hash模式
  routes: [
    {
      // 软件主界面
      path: "/",
      component: () => import("@/views/layout/LayOutContainer.vue"), // 使用箭头函数可以懒加载
      redirect: "/pomodoro",
      children: [
        {
          path: "/settings",
          redirect: "/settings/global",
          component: () => import("@/views/layout/LayOutSettings.vue"),
          children: [
            {
              path: "/settings/global",
              component: () => import("@/views/settings/GlobalSettings.vue"),
            },
          ],
        },
        { path: "/about", component: () => import("@/views/pc/About.vue") },
        {
          path: "/timer",
          component: () => import("@/views/pc/Timer.vue"),
        },
        {
          path: "/pomodoro",
          component: () => import("@/views/pc/Pomodoro.vue"),
        },
      ],
    },
  ],
});

export default router;
