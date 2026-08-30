---
title: Edge AI 部署流水线的几笔记录
description: 设备端推理前的最小检查清单草稿。
date: 2026-04-12
cover: /gallery/article-soft-edge-ai.png
tags: [Embedded, ML]
pageClass: page-article-post
comment: false
toc: true
---

# Edge AI 部署流水线的几笔记录

## 目标

在资源受限设备上跑通 **导出 -> 优化 -> 部署 -> 验收**，避免每次项目从零摸索。

## 清单（草稿）

1. **导出格式**：ONNX / TFLite / vendor SDK 是否满足算子覆盖。
2. **输入规格**：NCHW / NHWC、归一化是否与训练一致。
3. **量化**：PTQ / QAT 对指标的影响，留一份 baseline 日志。
4. **推理线程**：是否绑定大核、批大小是否为 1。
5. **验收**：固定一组 golden input，对比误差阈值。

## 延伸阅读

更完整的工程案例仍建议写在 **Projects** 各子页（如 [Edge AI Inference](/tech/ai-edge-inference.html)），这里只作随笔占位。

---

*Last updated: 2026-04-12*
