---
title: "一些 AppKit 的坑"
date: 2022-01-10T13:06:00+08:00
postType: tech
draft: false
tags: [AppKit, macOS Development]
---

## NSTableCellView 动态高度实现

- 在 VC 里持有一个 measuringCell
- VC 实现 tableViewDelegate 的 rowHeight 方法，设置好 measuringCell 数据后，传入 tableView.bounds.width - 32 计算所需的高度并返回。32 是个神奇的数字，cell 本身确实比 tableView 要窄，32 是差值，可能不同系统版本不一样，没有试过
- 注意，如果使用 NSDiffableDataSource，在设置好 dataSource 之后，在 append 任意数据之前要先设置好 tableView 的 delegate，要不然会失效

## NSTableCellView horizontal grid frame

NSTableCellView 横向分割线的 frame 与 cell 的 subviews 中最后一个 NSTextField （~~非 NSTextField 的其他 view 还没试，我的场景最后一个 subview 是 NSTextField~~验证了，NSView 不行，只能是 NSTextField）有关

## NSTextField AutoLayout 动态高度的实现：

- Subclass NSTextField，override intrinsicContentSize，返回使用 `preferredMaxLayoutWidth` 计算得来的 size
- 在 delegate 的 `controlTextDidChange` 方法中，调用 textField 的 `invalidateIntrinsicContentSize`；同时，需要访问一下 `stringValue`，否则不会立即变更

## NSTableViewDiffableDataSource

- 在调用 `snapshot()` 前，要先初始化过 dataSource：手动创建一个 snapshot，然后让 dataSource apply
- 继承 NSTableViewDiffableDataSource 以实现 NSTableViewDataSource 的方法时，要用 @objc 标记这些方法，否则不会被调用
- 实现 Drag & Drop，在 `acceptDrop` 方法中移动相应的 row 时，最后 apply snapshot 的时候 animatingDifferences 要设置成 false，否则 cell 会诡异地消失

## NSTableRowView

Finder 风格的选中样式（只有浅灰色背景，且文字颜色不翻转）：
```Swift
override var isEmphasized: Bool {
    get { false }
    set {}
}
```

Override drawSelection 方法会有诡异的问题：选中让 cell 行高发生变化，在 tableView 初始化后第一次选中一个 cell，行高会变，但是 cell 的高度不会