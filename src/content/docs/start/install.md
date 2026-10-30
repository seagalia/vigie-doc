---
title: Install Vigie
description: Install the vigie binary from a release or from source, run it as a systemd service, in a container, or in a Kubernetes cluster.
sidebar:
  order: 2
tags: [operations, kubernetes]
---

Vigie is one static binary, `vigie`, built without cgo. It reads one YAML file and listens on one port, `8080` by
default. This page installs it in one of four ways:

- [From a release](#install-from-a-release), the binary alone.
- [As a systemd service](#run-as-a-systemd-service), with the unit of the repository.
- [In a container](#run-in-a-container), with the image the repository builds.
- [In a Kubernetes cluster](#run-in-a-kubernetes-cluster), with a Deployment and the permissions of the `kubernetes`
  source.

Whichever way you pick, check the configuration with `vigie check-config` before you start the server, because `vigie
serve` ignores the keys it doesn't know.

## Install from a release

Each tag `v*` of the repository publishes archives on the [releases page](https://github.com/seagalia/vigie/releases),
for Linux and macOS on `amd64` and `arm64`, with Windows zips next to them. `checksums.txt` holds the SHA-256 of every
archive.

1. Download the archive of your system and its checksums. Replace `<version>` with the version without its `v`, such as
   `0.1.0`.

    ```bash
    VERSION=<version>
    curl -LO "https://github.com/seagalia/vigie/releases/download/v${VERSION}/vigie_${VERSION}_linux_amd64.tar.gz"
    curl -LO "https://github.com/seagalia/vigie/releases/download/v${VERSION}/checksums.txt"
    ```

2. Check the archive.

    ```bash
    sha256sum --check --ignore-missing checksums.txt
    ```

3. Unpack it and put the binary on your `PATH`. The archive holds a directory named like the archive.

    ```bash
    tar -xzf "vigie_${VERSION}_linux_amd64.tar.gz"
    sudo install "vigie_${VERSION}_linux_amd64/vigie" /usr/local/bin/vigie
    vigie version
    ```

To build from source instead, run `CGO_ENABLED=0 go build .` in a clone of the repository, as in the
[quickstart](/start/quickstart/#build-the-vigie-binary).

## Run as a systemd service

The repository ships a unit in `assets/systemd/vigie.service`. It runs `/usr/local/bin/vigie serve` with
`/etc/vigie/config.yml`, under a dynamic user, and maps `systemctl reload` to `SIGHUP`.

1. Install the binary in `/usr/local/bin/vigie`, as in [Install from a release](#install-from-a-release).

2. Write the configuration in `/etc/vigie/config.yml`, starting from `assets/config.yml` of the repository, then check
   it.

    ```bash
    sudo mkdir -p /etc/vigie
    sudo cp assets/config.yml /etc/vigie/config.yml
    vigie check-config -c /etc/vigie/config.yml
    ```

    The dynamic user of the unit can only read files that every user can read, so keep the configuration and the
    endpoint files readable by all, or give them to a group the unit joins with `SupplementaryGroups=`.

3. Install and start the unit.

    ```bash
    sudo cp assets/systemd/vigie.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable --now vigie
    ```

4. Check that it answers.

    ```bash
    curl -s http://localhost:8080/healthz
    ```

After a change to the services of the file, run `sudo systemctl reload vigie`. A change to `server` or `log` needs `sudo
systemctl restart vigie`. [Reload the services](/guides/reload-the-services/) gives the details.

## Run in a container

The `Dockerfile` of the repository builds an image with the binary alone, on
`gcr.io/distroless/static-debian13:nonroot`. The image runs `vigie serve -c /etc/vigie/config.yml` and exposes port
`8080`. No image is published yet, so you build it and push it to your own registry.

1. Build the image. `make docker` tags it `vigie:dev` and stamps the binary with the version of the checkout.

    ```bash
    make docker
    ```

2. Run it with your configuration mounted on `/etc/vigie/config.yml`.

    ```bash
    docker run --rm -p 8080:8080 -v "$PWD/config.yml:/etc/vigie/config.yml:ro" vigie:dev
    ```

    Mount the endpoint files of the `file` services too, at the paths the configuration gives. The configuration must
    listen on all addresses, such as `:8080` (the default), for the published port to reach it.

The image keeps the CA certificates of distroless, which the `url` sources need to check an HTTPS server.

## Run in a Kubernetes cluster

In a cluster, Vigie reads the configuration from a ConfigMap and, for its `kubernetes` sources, uses the service account
of its pod. The manifests below run it in the namespace `vigie` and let it read the Service `web` of the namespace
`shop`. Replace `registry.example.com/vigie:0.1.0` with the image you pushed.

```yaml title="vigie.yml"
apiVersion: v1
kind: Namespace
metadata:
  name: vigie
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: vigie
  namespace: vigie
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: vigie
  namespace: vigie
data:
  config.yml: |
    server:
      listen_addr: :8080
    log:
      in_json: true
    # POST /reload has no authentication, and a restart of the pods applies a new ConfigMap
    disable_reload_by_request: true
    services:
      - name: web
        default_port: 8080
        kubernetes:
          namespace: shop
          service: web
          port_name: http
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vigie
  namespace: vigie
spec:
  replicas: 2
  selector:
    matchLabels:
      app: vigie
  template:
    metadata:
      labels:
        app: vigie
    spec:
      serviceAccountName: vigie
      containers:
        - name: vigie
          image: registry.example.com/vigie:0.1.0
          ports:
            - name: http
              containerPort: 8080
          readinessProbe:
            httpGet:
              path: /healthz
              port: http
          livenessProbe:
            httpGet:
              path: /healthz
              port: http
          volumeMounts:
            - name: config
              mountPath: /etc/vigie
              readOnly: true
      volumes:
        - name: config
          configMap:
            name: vigie
---
apiVersion: v1
kind: Service
metadata:
  name: vigie
  namespace: vigie
spec:
  selector:
    app: vigie
  ports:
    - name: http
      port: 8080
      targetPort: http
```

Then give the service account the right to read the Services it serves, with a Role and a RoleBinding in each namespace
it reads:

```yaml title="vigie-rbac.yml"
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: vigie
  namespace: shop
rules:
  - apiGroups: [""]
    resources: [services]
    verbs: [get]
  - apiGroups: [discovery.k8s.io]
    resources: [endpointslices]
    verbs: [list]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: vigie
  namespace: shop
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: vigie
subjects:
  - kind: ServiceAccount
    name: vigie
    namespace: vigie
```

```bash
kubectl apply -f vigie.yml -f vigie-rbac.yml
kubectl -n vigie rollout status deployment/vigie
```

After a change to the ConfigMap, run `kubectl -n vigie rollout restart deployment/vigie`. [Read Kubernetes
Services](/guides/read-kubernetes-services/) covers the `kubernetes` source in depth.

## Next steps

- [Configuration](/reference/configuration/) lists every key of the file.
- [Serve HTTPS](/guides/serve-https/) when clients reach Vigie over a network you don't trust.
- [Troubleshooting](/guides/troubleshooting/) lists the errors you can meet and what they mean.
