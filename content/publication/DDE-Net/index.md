---
title: "DDE-Net: Dynamic Density-Driven Estimation for Arbitrary-Oriented Object Detection"
content_type: publication
authors:
  - WangBoyu
  - Donglin Jing
  - Xiaokai Xia
  - Yu Liu
  - Luo Xu
  - Jiangmai Cheng
date: 2024-08-11
publication_types:
  - article-journal
publication: "electronics"
abstract: |
  Abstract
  Compared with general images, objects in remote sensing (RS) images typically exhibit a conspicuous diversity due to their arbitrary orientations. However, many of the prevalent detectors generally apply an inflexible strategy in setting the angles of anchor, ignoring the fact that the number of possible orientations is predictable. Consequently, their processes integrate numerous superfluous angular considerations and hinder their efficiency. To deal with this situation, we propose a dynamic density-driven estimation network (DDE-Net). We design three core modules in DDE-Net: a density-map and mask generation module (DGM), mask routing prediction module (MRM), and spatial-balance calculation module (SCM). DGM is designed for the generation of a density map and mask, which can extract salient features. MRM is for the prediction of object orientation and corresponding weights, which are used to calculate feature maps. SCM is used to affine transform the convolution kernel, which applies an adaptive weighted compute mechanism to enhance the average feature, so as to balance the spatial difference to the rotation feature extraction. A broad array of experimental evaluations have conclusively shown that our methodology outperforms existing state-of-the-art detectors on common aerial object datasets (DOTA and HRSC2016).
tags:
featured: false
links:
image:
  filename: featured.jpg
---
