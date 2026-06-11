---
title: "TRVP: Transformer-VAE Framework for 3D Point Cloud Instance Segmentation"
content_type: publication
authors:
  - Jiangmai Cheng
  - Bo Jiang
  - Tianfang Sun
  - WangBoyu
date: 2025-11-13
publication_types:
  - article-journal
publication: "electronics"
abstract: "Transformers perform well in feature extraction but face challenges in 3D point cloud instance segmentation. This paper presents TRVP—a 3D segmentation network that deeply integrates the Transformer architecture with a variational autoencoder (VAE). Through targeted improvements, the framework addresses three core limitations of Transformers in 3D processing: First, a VAE-based generation strategy is introduced, regulating the process via joint optimization of KL divergence and reconstruction loss to enhance generalization and ease data acquisition; second, a feature enhancement module combining multi-branch CNNs and Transformer layers enables joint extraction of local geometry and global context; third, optimized residual connections stabilize gradient propagation and accelerate convergence in deep networks. Experiments on S3DIS and ScanNetV2 show TRVP achieves mean precision scores of 0.74 and 0.52, respectively, demonstrating superior performance. Ablation studies further verify the effectiveness of each component."
tags:
featured: false
links:
image:
  filename: featured.jpg
---
