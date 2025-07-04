---
id: 74513a1d-0b14-4ae5-824b-cfa16a28680b
title: Notes on Swift Concurrency
description: Notes on Swift Concurrency
pubDate: 2024-03-26T21:30:50+08:00
modDate: 2024-03-26T21:30:50+08:00
kind: nerd
tags: [Swift]
language: zh-Hans
---

# 异步函数

## 异步函数概念

异步和并发是两个不同的概念，并发（Concurrency）是指多个任务同时执行，这里的同时不是严格意义上的同一时刻，而是在稍大时间粒度上，多个任务可以同时推进，并发的实现可以是单线程，也可以是多线程、多核、多设备。

在 Swift 中，异步函数是一种特殊的函数，它可以在执行过程中中断执行，放弃当前线程供其他函数执行，并可以在之后的某个时刻从中断的地方恢复执行。

同步函数在执行过程中，可以调用别的函数，但这时控制权转移到别的函数身上（push 一个新的 stack frame），调用者只能等到别的函数执行完成（pop）之后，控制权才会回到该函数身上，并继续剩余的代码。在这个过程中同步函数的 stack frame 还是在当前线程的 stack 上面。

而异步函数和同步函数类似，当调用别的函数时也是等到别的函数执行完成之后控制权再回到自己身上，但不同的是，异步函数可以完全放弃当前线程，它的 stack frame 被从当前线程的 stack 中清除，保存在堆上额外分配的空间里，并在恢复执行的时候再 push 到执行线程的 stack 上。这里有一点需要注意，异步函数恢复执行时所在的线程不一定和中断之前所在的线程相同，线程作为一个底层的实现细节，并不是 Swift 语言自身接口的一部分，因此开发者不能错误地假定异步函数在放弃线程前后的两部分执行在同一个线程上面。

调用异步函数时，需要用 `await` 关键字等待异步函数的返回。Await 标记了一个 possible suspension point。Suspension point 是指异步函数放弃当前线程的一个时机，possible 表明这是一个潜在的中断时机。

## 异步函数的实现

在现代操作系统中，同步函数的执行是基于 call stack 的，一个线程拥有一个 call stack，因此同步函数依附于一个具体的线程。异步函数的执行类似于这种依附关系，不过在更高一级抽象出了 Task 这一概念，Task 之于异步函数如同线程之于同步函数，保存维护着异步函数的上下文，所有异步函数都在一个 task 中执行。但在执行过程中，task 可能会在不同的线程之间进行切换。

Swift 使用 coroutine 来实现异步函数。Coroutine 是一种可以中断（suspend）的函数，当到达一个 suspend point 时，它的执行结束，控制流返回给它的调用者，之后它可以被从上一个 suspend point 恢复执行（或者被销毁）。

从线程的视角来看，异步函数是一个 coroutine，线程执行一系列的 partial functions，在任意时刻，这些 partial function 可能会 return，在逻辑上 suspend 该 task。而从 task 的视角看，异步函数只是一个常规的函数（routine），一个 task 在任意时刻只执行一个函数。异步函数 A 调用异步函数 B 时，B 也在同一个 task 上执行，A 必须等待 B 返回之后才会恢复执行。

深究的话，Swift 异步函数严格意义上讲不是 coroutine，因为 Swift 异步函数的语义只约束了它需要等待其他异步函数返回，但实现起来可以采用开启新线程阻塞当前线程等其他方式，coroutine 是和 subroutine（即常规函数）对比的概念，Swift 只是拿它来作为实现方式。下面讲 Swift 异步函数的实现机制，其实也是 coroutine 的实现方式，不再做区分。

异步函数的实现方式是 function splitting：将原函数拆分成若干个 partial async functions：

- 在各个 potential waiting point 之间执行
- 总是 tail call 下一个待执行的部分
- wait 其实就是直接 return

![image](https://github.com/user-attachments/assets/2528ecb2-3014-49e7-9447-4278a4f3c1b3)

![image](https://github.com/user-attachments/assets/f27f218e-a294-4a65-b5c7-67e037a8e253)

**Stack Allocation**

异步函数使用 Task 的 allocator 来分配 stack，同线程的 stack 类似，这也是一种 LIFO 的结构，但是并不像 stack 那样使用连续的内存空间、只修改栈顶指针来分配、释放内存，所以开销也大一些。

![image](https://github.com/user-attachments/assets/6613adc2-5556-40ac-8f7e-025fda780a85)

- 由 caller 负责分配 callee 的 frame，由于无法提前获知 frame size，因此需要从内存某处动态加载同 callee 关联的 size 信息（body 内第一行）；
- 紧接着，初始化 callee frame，写入 caller、从哪里 resume 等信息；
- 然后把该 frame 作为参数来调用 callee（caller 本身也是这个流程，它的参数 frame 也是由它的 caller 传入）

![image](https://github.com/user-attachments/assets/10963193-966a-4ada-a415-bf0a81445ab8)

![image](https://github.com/user-attachments/assets/3af0ab51-37ac-4111-8d62-215bebdbe4cf)

跨 fragment 存在的 value 也会保存到 context 中。

# 结构化并发

Swift Structured Concurrency 的基础是 Task，每个异步函数都执行在一个 task 中，task 可以创建若干并发执行的 child tasks，从而形成一个树状的层级结构，child tasks 会被隐式地等待，parent 在 return 之前会确保它们都执行完毕/被 cancel /抛出异常，因此 child task 的生命周期不会超过它的 parent。当一个 child task 的优先级设置的比较高时，其 parent 的优先级也会被提高，以避免出现优先级反转的问题。

创建 child task 的接口是先调用 `withTaskGroup` 等一系列异步方法来创建一个 task group，这一系列方法都接收一个闭包参数，并且提供创建的 TaskGroup 实例作为闭包参数，通过调用 TaskGroup 实例的 `addTask` 来向 TaskGroup 中添加 child task。注意这里虽然叫做“创建”，但是创建的实例是作为闭包参数提供给闭包 body，不能传到外界持有引用。

示例：

```swift
func demo() async {
    print("Before task group")
    await withTaskGroup(of: Void.self) { group in
        group.addTask {
            print("Child task 1 begin executing")
            try! await Task.sleep(for: .seconds(1))
            print("Child task 1 finish executing")
        }
        group.addTask {
            print("Child task 2 begin executing")
            try! await Task.sleep(for: .seconds(2))
            print("Child task 2 finish executing")
        }
    }
    print("After task group")
}

await demo()
print("Finish demo")
```

执行输出：

```
Before task group
Child task 1 begin executing
Child task 2 begin executing
Child task 1 finish executing
Child task 2 finish executing
After task group
Finish demo
```

在结构化并发中，所有的 Task 都按照这种树状层级组织。首先，withTaskGroup 是一个异步函数，必须在一个异步函数中调用，而且必须被 await，而调用它的异步函数本身也是在一个 Task 中执行，这样鸡生蛋蛋生鸡，一直到最上层的 main 函数。

一个程序可以使用 `@main` 来修饰一个 async `main()` 函数：

```swift
@main
struct Eat {
  static func main() async throws {
    let meal = try await makeDinner()
    print(meal)
  }
}
```

语义上，Swift 会创建一个新的 task 来执行 `main()` ，一旦该 task 执行完毕，程序便会终止。

不使用 main 的 top-level 代码（Swift Scripts）也可以调用异步函数，如：

```swift
// main.swift or a Swift script
let meal = try await makeDinner()
print(meal)
```

和 `@main` 一样，Swift 也会创建一个新的 task 来执行 `main()` ，一旦该 task 执行完毕，程序便会终止。

## TaskGroup 相关源码一览

直接看代码比纠结这些绕口的文字说明清晰多了

> 代码都经过一定删减以方便阅读

**创建 TaskGroup，两个全局方法**

```swift
public func withTaskGroup<ChildTaskResult, GroupResult>(
  of childTaskResultType: ChildTaskResult.Type,
  returning returnType: GroupResult.Type = GroupResult.self,
  body: (inout TaskGroup<ChildTaskResult>) async -> GroupResult
) async -> GroupResult {
  let _group = Builtin.createTaskGroup(ChildTaskResult.self)
  var group = TaskGroup<ChildTaskResult>(group: _group)

  // Run the withTaskGroup body.
  let result = await body(&group)

  await group.awaitAllRemainingTasks()

  Builtin.destroyTaskGroup(_group)
  return result
}

public func withThrowingTaskGroup<ChildTaskResult, GroupResult>(
  of childTaskResultType: ChildTaskResult.Type,
  returning returnType: GroupResult.Type = GroupResult.self,
  body: (inout ThrowingTaskGroup<ChildTaskResult, Error>) async throws -> GroupResult
) async rethrows -> GroupResult {
  let _group = Builtin.createTaskGroup(ChildTaskResult.self)
  var group = ThrowingTaskGroup<ChildTaskResult, Error>(group: _group)

  do {
    // Run the withTaskGroup body.
    let result = try await body(&group)

    await group.awaitAllRemainingTasks()
    Builtin.destroyTaskGroup(_group)

    return result
  } catch {
    group.cancelAll()

    await group.awaitAllRemainingTasks()
    Builtin.destroyTaskGroup(_group)

    throw error
  }
}
```

**struct TaskGroup**

```swift
// public struct TaskGroup<ChildTaskResult: Sendable>

internal let _group: Builtin.RawPointer

public mutating func addTask(
    priority _: TaskPriority? = nil,
    operation _: __owned @Sendable @escaping @isolated(any) () async -> ChildTaskResult
) {
    let flags = taskCreateFlags(/.../)

    // Create the task in this group.
    #if $BuiltinCreateTask
        let builtinSerialExecutor =
            Builtin.extractFunctionIsolation(operation)?.unownedExecutor.executor
        _ = Builtin.createTask(flags: flags,
                               initialSerialExecutor: builtinSerialExecutor,
                               taskGroup: _group,
                               operation: operation)
    #else
        _ = Builtin.createAsyncTaskInGroup(flags, _group, operation)
    #endif
}

public mutating func next() async -> ChildTaskResult? {
    // try!-safe because this function only exists for Failure == Never,
    // and as such, it is impossible to spawn a throwing child task.
    return try! await _taskGroupWaitNext(group: _group) // !-safe cannot throw, we're a non-throwing TaskGroup
}

internal mutating func awaitAllRemainingTasks() async {
    while let _ = await next() {}
}

public mutating func waitForAll() async {
    await awaitAllRemainingTasks()
}

public func cancelAll() {
    _taskGroupCancelAll(group: _group)
}
  
public var isCancelled: Bool {
    return _taskGroupIsCancelled(group: _group)
}
```

TaskGroup.swift 中主要是定义了一些供 Swift 用户使用的一些接口类型和方法，实现里面会调用一些 C++ 实现的 Runtime 方法，主要在 TaskGroup.cpp 文件中定义。

## 非结构化并发

Swift 也提供非结构化并发的能力，通过调用 `Task.init` 或 `Task.detach` 来创建一个 Task 的 handle，可以通过这个 handle 来等待新创建的 task 执行完毕、获取返回值、获取 cancel 状态、cancel 掉该 task 等。这两个函数都是同步函数，所以可以在同步函数里调用，cancel 操作也是同步方法。但是，如果要等待 task 执行或获取返回值，则必须使用 `await`，亦即只能在异步函数中执行该操作。

通过 `Task.init` 创建的 unstructured task，如果是在一个异步上下文中创建，则会继承创建它的 task 的一些属性：

- 优先级；
- 所有 task-local values，通过 copy 的方式继承；
- 如果是在一个 actor 函数中执行，则该 task 还会：
    - 继承该 actor 的 execution context，使用 actor 的 executor 执行，而不是使用 Global Concurrent Actor；
    - 传递给 `Task.init` 的 closure 参数变成该 actor 的 actor-isolated closure，因此可以访问该 actor 的其他 actor-isolated 属性和方法

而通过 `Task.detach` 方法创建的 unstructured task 不继承任何优先级、task-local values、actor context 等属性。

# Actor

Actor isolation 是指 actors 如何保护它们的 mutable state，主要机制是只允许直接通过 `self` 来访问其存储属性。一个 actor 中的所有声明，包括存储或计算属性、实例方法、实例 subscripts，都是默认 actor-isolated。Actor-isolated 声明可以自由地访问同一个 actor 实例的其他 actor-isolated 声明。任何不是 actor-isolated 声明称作 non-isolated，无法同步地访问任何 actor-isolated 声明。

在 actor 之外访问一个 actor 的 actor-isolated 声明叫做 cross-actor reference。允许以两种方式进行这种访问：

- 允许在定义该 actor 的模块之内跨 actor 引用一个 actor 的不可变状态
    - 因为一旦初始化以后，这些状态都无法再变更（无论是否在 actor 内外），因此不会发生 daata races
- 通过一个异步函数调用来进行跨 actor 引用
    - 这些异步函数会转换成“messages”请求 actor 执行对应的任务，而 actor 可以安全地执行相关任务
    - 这些 message 存储在 actor 的 mailbox 中，发起异步函数调用的一方可能会被阻塞，直至 actor 处理完 mailbox 中对应的 message
    - Actor 任意时刻只会处理一条消息，因此给定的 actor 不会有并发的 task 来执行 actor-isolated 代码。这确保了 actor-isolated mutable state 不会发生 data race，因为任何可以访问这些状态的代码不会并发执行
    - 在实现方面，这些消息是该异步调用对应的一个个 tasks，在每个 actor 拥有的 serial executor 上一次一个地执行。概念上类似于一个 serial DispatchQueue，但有着很重要的区别：等待 actor 的 tasks 不一定按照他们原始的顺序执行，因为 Swift runtime 会调整任务优先级避免优先级反转。

Actor 的同步方法可以通过该 actor 的 self 同步的被调用，但是跨 actor 时必须被异步调用。如果对 actor 的属性访问是只读的，那么可以通过异步调用来跨 actor 访问该属性。在模块之外，在 actor 之外访问其不可变的 let 属性也必须通过异步的形式访问。

Actor 类型隐式遵循了 Sendable 协议。对于一个跨 actor 的异步调用，参数和返回值都必须是 Sendable。对于跨 actor 访问不可变属性，属性类型也必须遵循 Sendable 协议。因为跨 actor 引用需要和并发执行的代码打交道，通过明确所有跨 actor 的引用都只使用 Sendable 类型，可以确保在 actor 的 isolation domain 里没有对 shared mutable state 的引用流入流出。

一个 @Sendable 的 closure 总是 non-isolated 的，因此在其 body 里面对所有其他 actor-isolated 的声明都要用异步的形式访问。而非 @Sendable 的 closure 无法 escape 它所在的 concurrency domain，因此如果它们是在 actor-isolated context 里创建的，则它们是 actor-isolated 的，如 forEach 的 closure。即，在一个 actor-isolated context 中创建的 closure，如果它是 non-@Sendable，则它是 actor-isolated，如果它是 @Sendable，则它是 non-isolated

## Actor reentrancy

Actor-isolated 的函数是 reentrant，当一个 actor-isolated 函数阻塞时，可重入允许在这个 actor 上执行的其他任务在该函数恢复之前先执行，又被称作 interleaving。这意味着 actor-isolated 的可变状态可能在 await 前后被修改，需要开发者小心不要在 await 前后打破 invariants，最简单的方法是把状态的变更逻辑封装在一个同步 actor 函数里面。

## Global Actors

类似于一个单例，是一个由 @globalActor 修饰的 type（struct、enum、actor、或者 final class），隐式遵循 GlobalActor 协议，该协议要求提供一个 `static let shared` 实例。其中最典型的是 MainActor（最开始其实只想单独支持 MainActor）。使用时把一些想要隔离的声明用 @MainActor 修饰，被修饰的声明便可以被 actor-isolation 机制保护了。对整个类型（如 class）使用 @MainActor 修饰时，其所有的方法、属性、subscripts 等都会被该 global actor 隔离。如果想 opt out，则用 `nonisolated` 修饰符修饰。注意一个声明不能同时被一个 global actor 和一个 instance actor 隔离。

# References
- [MIT 6.005 - Reading 19: Concurrency](https://web.mit.edu/6.005/www/fa16/classes/19-concurrency/)
- [The Swift Programming Language - Concurrency](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/concurrency/)
- [SE-0296 async/await.md](https://github.com/apple/swift-evolution/blob/main/proposals/0296-async-await.md)
- [SE-0304 Structured Concurrency](https://github.com/apple/swift-evolution/blob/main/proposals/0304-structured-concurrency.md#proposed-solution)
- [SE-0306 Actors](https://github.com/apple/swift-evolution/blob/main/proposals/0306-actors.md#proposed-solution)
- [SE-0317 Async Let](https://github.com/apple/swift-evolution/blob/main/proposals/0317-async-let.md)
- [swift/tree/main/stdlib/public/Concurrency](https://github.com/apple/swift/tree/main/stdlib/public/Concurrency)
- [LLVM Coroutines](https://llvm.org/devmtg/2016-11/Slides/Nishanov-LLVMCoroutines.pdf)
- [2021 LLVM Dev Mtg “Asynchronous Functions in Swift”](https://www.youtube.com/watch?v=H_K-us4-K7s)
