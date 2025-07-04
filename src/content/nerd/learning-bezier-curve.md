---
id: c3999183-1a8c-4d70-aecd-0e412f472844
title: Learning Bezier Curve
description: Learning Bezier Curve
pubDate: 2023-03-03T20:00:00+08:00
modDate: 2023-03-03T20:00:00+08:00
kind: nerd
tags: [Bezier Curve]
language: zh-Hans
---

# 简介与曲线方程

贝塞尔曲线是一种参数曲线，由一组控制点 $P_0$ 到 $P_n$ 定义，n 称为贝塞尔曲线的*阶 (order)*，其中 $P_0$ 和 $P_n$ 分别是曲线的两个端点，而其他控制点通常不在曲线上。

## 参数方程

曲线方程可以写成关于 t 的参数方程形式，t 取值范围为 $[0, 1]$：

- 一阶： $B(t)=P_0+t(P_1-P_0)=(1-t)P_0+tP_1$ 
- 二阶： $B(t)=(1-t)^2P_0+2(1-t)tP_1+t^2P_2$
- 三阶： $B(t)=(1-t)^3P_0+3(1-t)^2tP_1+3(1-t)t^2P_2+t^3P_3$
- n 阶： $\sum_{i=0}^n(_i^n)(1-t)^{n-i}t^iP_i=(1-t)^nP_0+(_1^n)(1-t)^{n-1}tP_1+\dots+(_{n-1}^n)(1-t)t^{n-1}P_{n-1}+t^nP_n,0{\le}n{\le}1$

我们一般多使用二阶和三阶贝塞尔曲线。

# 曲线的绘制

> 下面图像绘制大小为 1000x1000

## 系统 API 绘制

在 SwiftUI 中绘制贝塞尔曲线非常简单：

```Swift
struct Bezier: Shape {
    // ...
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: p0)
        path.addCurve(to: p3, control1: p1, control2: p2)
        return path
    }
}
// execution time: 1.073e-06s
```

<img src="https://github.com/user-attachments/assets/bfc43222-19f8-423d-a6cc-7016a7a987b8" width="400" alt="This is a image" />

## 手动计算绘制
接下来我们不用系统的 API，自己来画，也很简单，只需要从 0-1 代入上面的公式依次计算曲线上面的各个点的坐标值即可：

```Swift
struct Bezier: Shape {
    // ...
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: p0)
        let step = 0.02
        var t: Double = 0
        while t <= 1 {
            let px = pow(1 - t, 3) * p0.x + 3 * pow(1 - t, 2) * t * p1.x + 3 * (1 - t) * pow(t, 2) * p2.x + pow(t, 3) * p3.x
            let py = pow(1 - t, 3) * p0.y + 3 * pow(1 - t, 2) * t * p1.y + 3 * (1 - t) * pow(t, 2) * p2.y + pow(t, 3) * p3.y
            path.addLine(to: CGPoint(x: px, y: py))
            t += step
        }
        return path
    }
}
// execution time: 1.597e-05
```
我们采用了 0.02 的步长，效果看起来差不多也很平滑，执行速度和系统 API 相差无几！

<img src="https://github.com/user-attachments/assets/a743a8e5-dfe1-4b7b-94b4-d552999c64de" width="400" alt="This is a image" />

## De Casteljau 算法

接下来我们看另一种计算贝塞尔曲线坐标点的算法，De Casteljau 算法，虽然在常见的机器架构上可能没有直接代入公式计算性能好，但这是一种[数值稳定](https://en.wikipedia.org/wiki/Numerical_stability)的算法，而且可以用于在任意 t 值处将一条贝塞尔曲线分割成两段。

该算法是一个递归算法，如下图所示，绿色的四个点是我们要绘制的三阶贝塞尔曲线的四个控制点，假设 t=0.5：
- 我们可以使用线性插值（亦即一阶贝塞尔曲线）分别 在 $P_0$、$P_1$、$P_2$、$P_3$ 之间计算出三个新的点 $P'_0$、$P'_1$、$P'_2$，即图中的三个蓝色点；
- 同样我们也为这三个新点计算插值，可以得到浅紫色的两个点 $P''_0$、$P''_1$；
- 最后再为这两个新点计算插值，得到的红色点就是所求的三阶贝塞尔曲线在 t=0.5 处的插值点。

<img src="https://github.com/user-attachments/assets/f5a461c1-da94-4e0b-82aa-b7971559b05f" width="400" alt="This is a image" />

实现如下：

```Swift
struct Bezier: Shape {
    // ...
    private func calPoint(points: [CGPoint], t: Double) -> CGPoint {
        if points.count == 1 {
            return points[0]
        }
        var tmp = [CGPoint]()
        for i in 0..<(points.count-1) {
            tmp.append(CGPoint(x: points[i].x * (1 - t) + points[i + 1].x * t,
                               y: points[i].y * (1 - t) + points[i + 1].y * t))
        }
        return calPoint(points: tmp, t: t)
    }

    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: p0)
        let points = [p0, p1, p2, p3]
        let step = 0.01
        var t: Double = 0
        while t <= 1 {
            path.addLine(to: calPoint(points: points, t: t))
            t += step
        }
        path.addLine(to: p3)
        return path
    }
}
// execution time: 0.00029
```

<img src="https://github.com/user-attachments/assets/45a21265-90b0-43c3-82e9-7ae34b0f71d7" width="500" alt="This is a image" />

# 根据 x 求 y

上面介绍了如何计算各个点 (x, y) 以绘制图形，另一种常见的需求是给定 x 坐标值求 y 坐标值，比如我们常用的 ease 系列的动画曲线插值。思路比较简单：对于给定的 x 值，我们可以根据公式求出对应的 t 值，然后再将 t 带入公式即可求出 y 值。对于一阶、二阶贝塞尔曲线，求 t 值比较简单，但是针对三阶就比较复杂了：

$$x(t)=a(1-t)^3+3b(1-t)^2t+3c(1-t)t^2+dt^3$$

其中 a、b、c、d 分别是四个控制点的 x 坐标值，可以写成

$$x(t)=(-a+3b-3c+d)t^3+(3a-6b+3c)t^2+(-3a+3b)t+a$$

怎么求解就是数学问题了，详细参见这篇文章 [Solving the Cubic Equation (Algebra)](https://trans4mind.com/personal_development/mathematics/polynomials/cubicAlgebra.htm)

我将里面的公式翻译成了代码：

```Swift
    func calculateRoot(x: CGFloat) -> CGFloat {
        let c3 = -p0.x + 3 * p1.x - 3 * p2.x + p3.x
        let c2 = 3 * p0.x - 6 * p1.x + 3 * p2.x
        let c1 = -3 * p0.x + 3 * p1.x
        let c0 = p0.x - x

        let a = c2 / c3
        let b = c1 / c3
        let c = c0 / c3

        let p = (3 * b - pow(a, 2)) / 3
        let q = (2 * pow(a, 3) - 9 * a * b + 27 * c) / 27

        if p == 0 {
            return pow(-1 * q, 1 / 3) - a / 3
        }

        if q == 0 {
            let x1 = -1 * a / 3
            if x1 >= 0 && x1 <= 1 {
                return x1
            }
            let x2 = pow(-1 * p, 1 / 2) - a / 3
            if x2 >= 0 && x2 <= 1 {
                return x2
            } else {
                return -1
            }
        }

        let r = pow(pow(-1 * p / 3, 3), 1 / 2)
        let phi = acos(-1 * q / (2 * r))
        let x1 = 2 * pow(r, 1 / 3) * cos(phi / 3) - a / 3
        if x1 >= 0 && x1 <= 1 {
            return x1
        }
        let x2 = 2 * pow(r, 1 / 3) * cos((phi + 2 * CGFloat.pi) / 3) - a / 3
        if x2 >= 0 && x2 <= 1 {
            return x2
        }
        let x3 = 2 * pow(r, 1 / 3) * cos((phi + 4 * CGFloat.pi) / 3) - a / 3
        if x3 >= 0 && x3 <= 1 {
            return x3
        }
        return -1
    }
```

<img src="https://github.com/user-attachments/assets/e1b52516-52ad-40f7-b930-a2db5459d702" width="600" alt="This is a image" />

# References
- [Bézier curve - Wikipedia](https://en.wikipedia.org/wiki/B%C3%A9zier_curve)
- [A Primer on Bézier Curves](https://pomax.github.io/bezierinfo)
- [Solving the Cubic Equation (Algebra)](https://trans4mind.com/personal_development/mathematics/polynomials/cubicAlgebra.htm)
- [skia - SKGeometry.cpp](https://github.com/google/skia/blob/main/src/core/SkGeometry.cpp)
````
