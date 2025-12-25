# Acceptance Criteria

## Feature: Timeout Fetch Module

### Requirement: 可复用且可测试的超时封装
- Rationale: 当前实现嵌在客户端创建逻辑中，难以单测与复用。

#### Scenario: 作为独立模块使用
- WHEN 调用方传入 `baseFetch`
- THEN 返回的包装器可直接用于 `fetch`
- AND 逻辑不依赖浏览器专有全局对象

### Requirement: 超时计算保持现有行为
- Rationale: 行为改动会影响线上请求体验与错误文案。

#### Scenario: 默认超时与 clamp 规则
- WHEN 环境变量未设置
- THEN 超时默认为 `15000`
- AND 数值被 clamp 到 `1000..30000`

#### Scenario: 禁用超时
- WHEN 环境变量为 `0`
- THEN 调用直接透传到 `baseFetch`
- AND 不注入额外 `AbortController`

### Requirement: 中断优先级正确
- Rationale: 不能覆盖调用方主动取消请求的语义。

#### Scenario: 调用方 signal 中断
- WHEN 调用方传入已中断或后续中断的 `signal`
- THEN wrapper 终止请求
- AND 不产生“超时”错误文案

#### Scenario: 超时中断
- WHEN 请求超过配置超时
- THEN wrapper 抛出 `Client timeout after ${ms}ms`
- AND 原始错误挂在 `cause`
