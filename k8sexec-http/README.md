# k8sexec-http

这个 demo 模仿 `download.ts` 的做法：

- HTTP 接口收请求
- 默认读取本机 `~/.kube/config` 并连接本地 `minikube`
- 如果传了 `authorization`，则优先从 `authorization` 头里读取 `encodeURIComponent(kubeconfig)`
- 服务端内部创建 `k8s.Exec`
- 调用 `k8sExec.exec(...)`
- 把容器 `stdout` 直接流式返回给请求方

## 安装

```bash
pnpm install
```

## 启动

```bash
pnpm run dev
```

默认监听：`http://127.0.0.1:8092`

默认 Kubernetes 上下文：`minikube`

如果你要切换上下文，可以在启动前设置：

```bash
KUBE_CONTEXT=minikube pnpm run dev
```

## 接口

### `GET /pods`

查询某个 namespace 下的 Pod 列表。

示例：

```bash
curl "http://127.0.0.1:8092/pods?namespace=kube-system"
```

返回示例：

```json
{
  "ok": true,
  "context": "minikube",
  "namespace": "kube-system",
  "pods": [
    {
      "name": "coredns-5d78c9869d-4jhj4",
      "namespace": "kube-system",
      "phase": "Running",
      "containers": ["coredns"]
    }
  ]
}
```

### `GET /containers`

查询某个 Pod 里的容器列表。

示例：

```bash
curl "http://127.0.0.1:8092/containers?namespace=kube-system&podName=coredns-5d78c9869d-4jhj4"
```

返回示例：

```json
{
  "ok": true,
  "context": "minikube",
  "namespace": "kube-system",
  "podName": "coredns-5d78c9869d-4jhj4",
  "containers": [
    {
      "name": "coredns",
      "image": "registry.k8s.io/coredns/coredns:v1.10.1"
    }
  ]
}
```

### `POST /exec`

请求头：

```text
content-type: application/json
```

说明：

- 连本地 minikube 时，`authorization` 可以不传
- 如果传了 `authorization`，则会覆盖本地默认 kubeconfig

请求体：

```json
{
  "namespace": "default",
  "podName": "mypod",
  "containerName": "main",
  "command": ["sh", "-c", "echo hello && uname -a"]
}
```

说明：

- `namespace` 可选，不传时会从 kubeconfig 当前上下文推导
- `containerName` 可选
- `command` 必须是非空数组

返回：

- `stdout` 作为 HTTP 响应体直接返回
- `stderr` 会被当成错误处理

## curl 示例

```bash
curl -X POST http://127.0.0.1:8092/exec \
  -H "content-type: application/json" \
  -d '{
    "namespace": "default",
    "podName": "mypod",
    "containerName": "main",
    "command": ["sh", "-c", "echo hello from pod"]
  }'
```

如果你想显式传 kubeconfig，也可以：

```bash
curl -X POST http://127.0.0.1:8092/exec \
  -H "authorization: $(python3 - <<'PY'
import urllib.parse, pathlib
print(urllib.parse.quote(pathlib.Path('~/.kube/config').expanduser().read_text()))
PY
)" \
  -H "content-type: application/json" \
  -d '{
    "namespace": "default",
    "podName": "mypod",
    "containerName": "main",
    "command": ["sh", "-c", "echo hello from pod"]
  }'
```

## 对应关系

这个 demo 对应你前面看的 `download.ts`：

- 可以直接走本机 minikube，也兼容 `authorization` 传 kubeconfig
- 服务端内层通过 `k8sExec.exec(...)` 连 apiserver
- 外层通过 Express `res` 把结果回给调用方

只是这里执行的是通用 `command`，不是固定的 `dd if=...`



curl -X POST http://127.0.0.1:8096/exec \
    -H 'content-type: application/json' \
    -d '{
      "namespace":"kube-system",
      "podName":"coredns-5d78c9869d-4jhj4",
      "containerName":"coredns",
      "command":["/coredns","-version"]
    }'