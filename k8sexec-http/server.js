const express = require("express");
const k8s = require("@kubernetes/client-node");
const { PassThrough } = require("node:stream");

const PORT = Number(process.env.PORT || 8099);
const DEFAULT_CONTEXT = process.env.KUBE_CONTEXT || "minikube";
const app = express();

app.use(express.json({ limit: "1mb" }));

function readKubeconfigFromAuthorization(req) {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return null;
  }
  return decodeURIComponent(authorization);
}

function createK8sExec(kubeconfigRaw) {
  const kc = new k8s.KubeConfig();
  if (typeof kubeconfigRaw === "string" && kubeconfigRaw.length > 0) {
    kc.loadFromString(kubeconfigRaw);
  } else {
    kc.loadFromDefault();
    if (DEFAULT_CONTEXT) {
      kc.setCurrentContext(DEFAULT_CONTEXT);
    }
  }
  const currentUser = kc.getCurrentUser();
  if (!currentUser) {
    throw new Error("kubeconfig current user not found");
  }
  const currentContext = kc.getCurrentContext();
  if (!currentContext) {
    throw new Error("kubeconfig current context not found");
  }
  const namespace = kc.contexts[0] && kc.contexts[0].namespace
    ? kc.contexts[0].namespace
    : `ns-${currentUser.name}`;

  return {
    namespace,
    currentContext,
    k8sExec: new k8s.Exec(kc),
    k8sCore: kc.makeApiClient(k8s.CoreV1Api)
  };
}

function normalizeCommand(command) {
  if (Array.isArray(command) && command.length > 0) {
    return command.map((item) => String(item));
  }
  throw new Error("command must be a non-empty array");
}

function execCommand({ k8sExec, namespace, podName, containerName, command, stdout, onStatus }) {
  return new Promise((resolve, reject) => {
    const stderr = new PassThrough();
    let settled = false;
    let execWs;
    let stderrText = "";

    const finishError = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      if (execWs && typeof execWs.close === "function") {
        try {
          execWs.close();
        } catch {}
      }
      reject(error);
    };

    const finishSuccess = () => {
      if (settled) {
        return;
      }
      settled = true;
      resolve();
    };

    stderr.on("data", (chunk) => {
      stderrText += chunk.toString();
    });

    stderr.on("error", finishError);
    stdout.on("error", finishError);

    k8sExec.exec(
      namespace,
      podName,
      containerName,
      command,
      stdout,
      stderr,
      null,
      false,
      (status) => {
        if (typeof onStatus === "function") {
          onStatus(status, stderrText);
        }
        if (status && status.status === "Failure") {
          finishError(new Error(status.message || stderrText || "k8s exec failed"));
          return;
        }
        finishSuccess();
      }
    ).then((ws) => {
      execWs = ws;
      ws.on("close", finishSuccess);
      ws.on("error", finishError);
    }).catch(finishError);
  });
}

app.get("/", (_req, res) => {
  res.json({ ok: true, name: "k8sexec-http-demo" });
});

app.get("/pods", async (req, res) => {
  try {
    const kubeconfig = readKubeconfigFromAuthorization(req);
    const { namespace: defaultNamespace, currentContext, k8sCore } = createK8sExec(kubeconfig);
    const namespace = typeof req.query.namespace === "string" && req.query.namespace.length > 0
      ? req.query.namespace
      : defaultNamespace;

    const podList = await k8sCore.listNamespacedPod({
      namespace
    });
    const pods = (podList.items || []).map((pod) => ({
      name: pod.metadata && pod.metadata.name ? pod.metadata.name : "",
      namespace: pod.metadata && pod.metadata.namespace ? pod.metadata.namespace : namespace,
      phase: pod.status && pod.status.phase ? pod.status.phase : "Unknown",
      containers: ((pod.spec && pod.spec.containers) || []).map((container) => container.name)
    }));

    res.json({
      ok: true,
      context: currentContext,
      namespace,
      pods
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

app.get("/containers", async (req, res) => {
  try {
    const kubeconfig = readKubeconfigFromAuthorization(req);
    const { namespace: defaultNamespace, currentContext, k8sCore } = createK8sExec(kubeconfig);
    const namespace = typeof req.query.namespace === "string" && req.query.namespace.length > 0
      ? req.query.namespace
      : defaultNamespace;
    const podName = typeof req.query.podName === "string" ? req.query.podName : "";

    if (!podName) {
      res.status(400).json({ ok: false, error: "podName is required" });
      return;
    }

    const pod = await k8sCore.readNamespacedPod({
      name: podName,
      namespace
    });
    const containers = ((pod.spec && pod.spec.containers) || []).map((container) => ({
      name: container.name,
      image: container.image || ""
    }));

    res.json({
      ok: true,
      context: currentContext,
      namespace,
      podName,
      containers
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

app.post("/exec", async (req, res) => {
  try {
    const kubeconfig = readKubeconfigFromAuthorization(req);
    const { namespace: defaultNamespace, currentContext, k8sExec } = createK8sExec(kubeconfig);
    const {
      namespace,
      podName,
      containerName = "",
      command
    } = req.body || {};

    if (!podName || typeof podName !== "string") {
      res.status(400).json({ ok: false, error: "podName is required" });
      return;
    }

    if (containerName !== "" && typeof containerName !== "string") {
      res.status(400).json({ ok: false, error: "containerName must be a string" });
      return;
    }

    const argv = normalizeCommand(command);
    const targetNamespace = typeof namespace === "string" && namespace.length > 0
      ? namespace
      : defaultNamespace;

    res.status(200);
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.setHeader("x-demo-namespace", targetNamespace);
    res.setHeader("x-demo-pod", podName);
    res.setHeader("x-demo-container", containerName);
    res.setHeader("x-demo-context", currentContext);
    res.setHeader("x-demo-command", argv.join(" "));

    await execCommand({
      k8sExec,
      namespace: targetNamespace,
      podName,
      containerName,
      command: argv,
      stdout: res,
      onStatus(status, stderrText) {
        if (status && status.status === "Failure" && !res.writableEnded) {
          if (!res.headersSent) {
            res.statusCode = 500;
          }
          if (stderrText) {
            res.write(`\n[stderr]\n${stderrText}`);
          }
        }
      }
    });
    if (!res.writableEnded) {
      res.end();
    }
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      });
      return;
    }
    if (!res.writableEnded) {
      res.end(`\n[error] ${error instanceof Error ? error.message : String(error)}`);
    }
  }
});

app.listen(PORT, () => {
  console.log(`k8sexec http demo listening on http://127.0.0.1:${PORT}`);
});
