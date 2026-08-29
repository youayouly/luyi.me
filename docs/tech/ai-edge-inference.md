---
title: Edge AI Inference
pageClass: page-article-post
comment: false
toc: true
sidebar: true
---

# Edge AI Inference

**Edge inference** runs neural networks on **device-local** hardware (MCU, MPU, NPU, or GPU SoC) instead of only in the cloud. Goals are lower latency, offline operation, and predictable cost at scale.

## 1. Typical stack

- **Model**: CNN or small Transformer quantized to INT8  
- **Runtime**: TensorFlow Lite, ONNX Runtime, ExecuTorch, or vendor SDKs  
- **Hardware**: Cortex-M55+MVE, Coral Edge TPU, Jetson Orin Nano, etc.  

## 2. Engineering checklist

- Benchmark **latency and RAM** on target silicon  
- Use **representative calibration data** for quantization  
- Version models and bundle them with firmware or OTA updates  

## 3. Project direction (placeholder)

- Pick one vertical (e.g. keyword spotting, person detection, anomaly scores)  
- Ship a reproducible benchmark script and power measurement notes  
