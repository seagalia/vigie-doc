---
title: Install Vigie
description: Install the vigie binary from a release or from source, run it as a systemd service, in a container, or in a Kubernetes cluster.
sidebar:
  order: 2
tags: [operations, kubernetes]
---

Vigie is one static binary, `vigie`. It reads one YAML file and listens on one port, `8080` by
default. This page installs it in one of five ways:

- [With the install script](#install-with-the-script), the binary of the latest release in one command.
- [From a release](#install-from-a-release), the same binary downloaded and checked by hand.
- [As a systemd service](#run-as-a-systemd-service), with the unit of the repository.
- [In a container](#run-in-a-container), with the image the repository builds.
- [In a Kubernetes cluster](#run-in-a-kubernetes-cluster), with a Deployment and the permissions of the `kubernetes`
  source.

Whichever way you pick, check the configuration with `vigie check-config` before you start the server, because `vigie
serve` ignores the keys it doesn't know.

## Install with the script

The script at `https://seagalia.io/install.sh` installs the binary of a Seagalia project from its GitHub release, so it
takes the name of the project first. Without a version, it installs the latest stable release.

```bash
curl -fsSL https://seagalia.io/install.sh | sh -s -- vigie
```

To read the script before you run it:

```bash
curl -fsSL https://seagalia.io/install.sh | less
```

It needs a POSIX `sh`, `curl` or `wget`, `tar` (`unzip` on Windows) and `sha256sum` or `shasum`. It checks the archive
against the `checksums.txt` of the release before it installs anything, and skips that check with a warning when it
finds neither `sha256sum` nor `shasum`.

### Pick a version

A version after the name installs that release, written `v0.3.1` or `0.3.1`. The latest release is never a prerelease,
so a prerelease installs only this way.

```bash
curl -fsSL https://seagalia.io/install.sh | sh -s -- vigie v0.3.1
```

### Pick the directory

On Linux and macOS, the script puts the binary in `/usr/local/bin` when you can write to it and in `~/.local/bin`
otherwise. On Windows it uses `~/bin`. So it never asks for a password by default. `INSTALL_DIR` picks another
directory, and the script runs `sudo` when you can't write to it.

```bash
curl -fsSL https://seagalia.io/install.sh | INSTALL_DIR=~/bin sh -s -- vigie
```

When the directory isn't in your `PATH`, the script warns and prints the `export` line to add to your shell profile.

### Systems

The script runs on Linux and macOS, and on Windows in an MSYS or Cygwin shell such as Git Bash, on `amd64` and
`arm64`. On a Mac with Apple silicon, a shell running under Rosetta still gets the native `arm64` build.

`NO_COLOR=1` turns the colors of its output off.

```bash
curl -fsSL https://seagalia.io/install.sh | NO_COLOR=1 sh -s -- vigie
```

## Install from a release

Each tag `v*` of the repository publishes archives on the [releases page](https://github.com/seagalia/vigie/releases),
for Linux and macOS on `amd64` and `arm64`, with Windows zips next to them. `checksums.txt` holds the SHA-256 of every
archive. The [Download](/download/) page lists the archives of the latest release with their checksums. The steps
below do by hand what [the install script](#install-with-the-script) does.

1. Download the archive of your system and its checksums. Replace `<version>` with the version without its `v`, as
   [Download](/download/) shows it.

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

To build from source instead, run `CGO_ENABLED=0 go build .` in a clone of the repository, with Go at the version of
the `go` line of its `go.mod`.

## Run as a systemd service

The repository ships a unit in
[`assets/systemd/vigie.service`](https://github.com/seagalia/vigie/blob/main/assets/systemd/vigie.service). It runs `/usr/local/bin/vigie serve` with
`/etc/vigie/config.yml`, under a dynamic user, and maps `systemctl reload` to `SIGHUP`.

1. Install the binary in `/usr/local/bin/vigie` with [the install script](#install-with-the-script).

    ```bash
    curl -fsSL https://seagalia.io/install.sh | INSTALL_DIR=/usr/local/bin sh -s -- vigie
    ```

2. Write the configuration in `/etc/vigie/config.yml`, starting from
   [`assets/config.yml`](https://github.com/seagalia/vigie/blob/main/assets/config.yml) of the repository, then check
   it.

    ```bash
    sudo mkdir -p /etc/vigie
    sudo curl -fsSL -o /etc/vigie/config.yml https://raw.githubusercontent.com/seagalia/vigie/main/assets/config.yml
    vigie check-config -c /etc/vigie/config.yml
    ```

    The dynamic user of the unit can only read files that every user can read, so keep the configuration and the
    endpoint files readable by all, or give them to a group the unit joins with `SupplementaryGroups=`.

3. Install and start the unit.

    ```bash
    sudo curl -fsSL -o /etc/systemd/system/vigie.service \
      https://raw.githubusercontent.com/seagalia/vigie/main/assets/systemd/vigie.service
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
    # nothing sends SIGHUP to the pods, a restart applies a new ConfigMap
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
- [`server.tls`](/reference/configuration/#file-structure) serves HTTPS when clients reach Vigie over a network you don't
  trust.
- [Troubleshooting](/guides/troubleshooting/) lists the errors you can meet and what they mean.
