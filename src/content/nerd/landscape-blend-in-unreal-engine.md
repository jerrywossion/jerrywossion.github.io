---
id: 5c0d7f94-6e47-41de-a53b-1750a5bb9750
title: Layer Blend in Unreal Engine
description: Understanding blend modes of Layer Blend node in Landscape Material, and Layer Info Object kinds in landscape painting.
pubDate: Fri Jun 20 23:35:26 CST 2025
modDate: Fri Jun 20 23:35:26 CST 2025
kind: nerd
tags: [Unreal Engine 5]
language: zh-Hans
---

Layer Blend node 中的各个 layer，在 Editor 的 Landscape Paint panel 中，可以自动生成对应的各个 layer。

想要进行绘制，还需要给每一个 layer 创建一个 layer info object，该 object 中保存的一项重要数据是对应 layer 的 weight map，当我们选中一个 layer 开始绘制时，其实等价于在绘制一张 weight map，你也可以直接在 Editor 中把这些 weight map 导出成图片来看看它们长什么样子。Layer Blend node 在 blend 各个 layer 时，会以这些 weight map 作为各个 layer 的输入来计算最终的输出颜色。

在创建 layer info object 时，我们需要指定其类型，有两种：Weight-Blended 或 Non Weight-Blended，注意这里的类型和 Layer Blend node 的 blend mode（LB Weight Blend、LB Alpha Blend、LB Height Blend）没有任何关系，这里的类型仅用于控制各个 layer 的 weight 赋值逻辑。而 Layer Blend node 的 blend mode，是用于控制它拿到这些 weight 输入后 blend 过程的计算逻辑。

# Layer Info Object Kinds

首先，Editor 中各个 layer 的顺序对 weight map 的生成是没有影响的。其次，所有的 Weight-Blended layers 在绘制的时候会彼此影响，而各个 Non Weight-Blended layers 是完全独立的，在绘制时不会影响其他的 Weight-Blended 和 Non Weight-Blended layers。

在绘制一个 Weight-Blended layer 时，如果在 $(x, y)$ 处绘制了 weight 值 $w$，那么对于其余所有的 n 个 Weight-Blended layers，会先计算出它们在该点的 weight 值的和 $sum$，然后再将每个 layer $i$ 的 weight 值 $w_i$ 调整为 $(255 - w) * (w_i / sum)$。

这就是文档中所说的“绘制一个 Weight-Blended layer 时会降低所有其他 Weight-Blended layer 的 weight 值”。
具体的处理和计算逻辑源码在 `FLandscapeEditDataInterface::SetAlphaData` 函数中。

![paint](https://github.com/user-attachments/assets/38b1307b-d1a8-4f13-868e-2feac04542ee)

如果减少一个 Weight-Based layer 的 weight 值，则会相应地提升其他 Weight-Based layer 的 weight 值，但这个行为比较古怪，如果一个 layer 的旧 weight 值为 255，因为其它 layer 的 weight 值是 0，Editor 会尝试选择一个 layer 来提升其 weight 值，如果没有找到一个 layer，则没法降低当前 layer 的 weight 值，操作起来像是没反应一样。同时即使能找到一个 layer，这个查找的规则也比较反直觉，具体规则还没有理清。UE 文档也推荐只增量绘制。

# Layer Blend Modes

Layer Blend node 的 blend 具体实现逻辑在 `MaterialExpressionLandscapeLayerBlend.cpp` 中，主要分为三个 pass。

## Pass 1

遍历所有的 LB Weight-Blend 和 LB Heigh-Blend layers，计算每个 $layer_i$ 的 $weight$ 并放到 $weights[i]$ 数组中，同时将这些 weight 值累加并最终得到所有这两种类型的 layer 的 weight 值之和 $weightSum$。两种类型 layer 的取值计算逻辑为：
- 对于 LB Weight-Blend layer，直接从 weight map 中取值。
- 对于 LB Heigh-Blend layer，依次从 weight map 中取值 $w$，从 height 输入中取出值 $h$，然后按下列公式计算： $weight=clamp(lerp(-1.f, 1.f, w) + h, 0.0001, 1.f)$

## Pass 2

开始执行 blend 操作，设最终的输出颜色为 $output$，遍历所有的 LB Weight-Blend 和 LB Heigh-Blend layers，对每个 $layer_i$：
- 只要存在至少一个 LB Heigh-Blend layer，则需要对 weight 值做归一化处理： $output = output + texture_i * weight[i] / weightSum$
- 否则： $output = output + texture_i * weight[i]$
  
## Pass 3

上两个 pass 都忽略了 LB Alpha-Blend layer，pass 3 则只遍历所有的 LB Alpha-Blend layer，按照顺序，依次执行该计算公式： $output = lerp(output, texture_i, weight_i)$

![blend](https://github.com/user-attachments/assets/2784d3f1-5438-4c4f-ba67-c123baea6ac7)

