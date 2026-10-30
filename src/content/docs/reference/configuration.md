---
title: Configuration
description: Every key of the vigie YAML file, for the server, the logs, the cache and each source of the services, with the defaults and the errors.
sidebar:
  order: 2
tags: [configuration, sources]
---

Vigie reads one YAML file, given by `-c`/`--config-path` (`./config.yml` by default). This page lists every key of the
file, with its default and the errors it can raise. The [sample
file](https://github.com/seagalia/vigie/blob/main/assets/config.yml) of the repository has an example of each source.

`vigie serve` ignores the keys it doesn't know, so a misspelled key silently keeps its default. Run `vigie check-config`
after each change, it refuses them. The errors found while reading the file come from both commands, prefixed by
`invalid config <path>:` for `check-config` and `read config:` for `serve`.

The HTTP endpoints of the server are in [HTTP API](/reference/http-api/), and what a reload replaces in [Reload the
services](/guides/reload-the-services/).

## File structure

```yaml
server:
  listen_addr: :8080
  tls:
    cert_file: /etc/vigie/vigie.crt
    key_file: /etc/vigie/vigie.key
  basic_auth:
    - username: flock
      password: change-me
log:
  level: info
  no_color: false
  in_json: false
disable_reload_by_request: false
cache:
  ttl: 5s
services:
  - name: default
    default_port: 8080
    file:
      path: /etc/vigie/endpoints.txt
```

::configuration-keys{prefix=""}

Without `server.tls`, the server speaks plain HTTP. With it, the server speaks HTTPS only.

With `server.basic_auth`, a request without the username and password of one of the users gets `401`, see [Require a password](/guides/require-a-password/). Basic authentication sends the password in clear on each request, so set `server.tls` too when the network isn't trusted.

| Error | Cause |
|---|---|
| `services is empty` | `services` is empty or missing. |
| `server tls: cert_file and key_file are required` | `server.tls` is set with an empty `cert_file` or `key_file`. |
| `server basic_auth: username and password are required` | A user of `server.basic_auth` has an empty `username` or `password`. |
| `server basic_auth: username <name> is given twice` | Two users of `server.basic_auth` have the same `username`. |
| `cache ttl is negative` | `cache.ttl` is below `0s`. |

## `services[]`

::configuration-keys{prefix="services[]."}

Give each service one source. When a service has several, the first of `kubernetes`, `url`, `file` and `dns` wins, and
vigie ignores the others.

vigie keeps the answer of each source for `cache_ttl` (`cache.ttl`, 5 seconds by default), then reads the source again
on the next request. A change to the DNS records, the file, the remote list or the Kubernetes endpoints shows within
that time, without a reload. Requests arriving while the answer has expired wait for a single read of the source, so
many clients polling together cost one read. A source that fails isn't cached, the next request reads it again. A reload
starts with an empty cache. Durations are written like `500ms`, `5s` or `1m`.

| Error | Cause |
|---|---|
| `service name is empty` | `name` is empty. |
| `service dns, file, url and kubernetes are empty, you must specify one of them` | The service has no source. |
| `service <name> cache_ttl is negative` | `cache_ttl` is below `0s`. |

A missing `default_port` only logs a warning and takes `80`.

### `dns`

```yaml
services:
  - name: api
    default_port: 8080
    dns:
      name: api.example.com
      type: SRV
      srv_service: http
      srv_proto: tcp
```

::configuration-keys{prefix="services[].dns."}

vigie builds the SRV name from the three keys, so `name: api.example.com` with `srv_service: http` and `srv_proto: tcp`
looks up `_http._tcp.api.example.com`.

With `resolver` set, every lookup of the service goes to that server over TCP, the lookups of the SRV targets included,
and each request gives up after 8 seconds. TCP keeps a long answer whole, where a UDP answer can be cut. Without
`resolver`, vigie uses the resolver of the system.

| `type` | Lookup | Endpoints |
|---|---|---|
| `IP` | A and AAAA records of `name` | Each address, on `default_port`. |
| `SRV` | SRV records of `name` | Each address of each target, on the port of the record or `default_port` when it's `0`, with the weight of the record. |
| `TXT` | TXT records of `name` | Each record starting with `eds=`, followed by an endpoint line as described in [endpoint lines](#endpoint-lines). Other records are skipped. |

| Error | Cause |
|---|---|
| `service dns name is empty` | `name` is empty. |
| `service dns lookup is invalid, valid are IP, TXT, SRV` | `type` is none of the three values. |
| `service dns resolver is invalid: <err>` | `resolver` isn't a `host:port` with both parts. |

#### Consul

Consul answers DNS for its services, so the `dns` source reads them without a Consul-specific source. Point `resolver`
at the DNS port of a Consul agent, or have the host forward the `.consul` domain to it and leave `resolver` empty.

```yaml
services:
  - name: api
    default_port: 8080
    dns:
      name: service.consul
      type: SRV
      srv_service: api
      srv_proto: tcp
      resolver: 127.0.0.1:8600
```

This looks up `_api._tcp.service.consul`, Consul's RFC 2782 form. Each instance gives one endpoint, with the port it
registered and its weight `Weights.Passing`, which is `1` when the instance registered none.

- To keep only the instances with a tag, put the tag in place of `tcp`: `srv_proto: primary` looks up
  `_api._primary.service.consul`.
- To query another datacenter, put it in the name: `name: service.dc1.consul`.

Two settings of the Consul agent (`dns_config`) matter here:

- `only_passing = true`. By default, Consul DNS leaves out the instances whose checks are critical but keeps those in
  `warning`, and vigie would hand them to its clients.
- `enable_truncate = true`, when vigie goes through the resolver of the system rather than `resolver`. Over UDP, Consul
  cuts a long answer to a few records without telling the client, so a service with many instances would lose some of
  them. With `resolver`, vigie asks over TCP and gets every record.

### `file`

```yaml
services:
  - name: web
    default_port: 8080
    file:
      path: /etc/vigie/web-endpoints.txt
```

::configuration-keys{prefix="services[].file."}

### `url`

```yaml
services:
  - name: db
    default_port: 5432
    url:
      url: https://inventory.example.com/db-endpoints.txt
      basic_auth:
        username: vigie
        password: change-me
      insecure_skip_verify: false
```

::configuration-keys{prefix="services[].url."}

The request times out after 8 seconds. An answer other than `200` fails the request with `bad status code: <code>,
<body>`.

| Error | Cause |
|---|---|
| `service url is empty` | `url` is empty. |
| `service url is invalid: <err>` | `url` isn't a valid URL. |

### `kubernetes`

```yaml
services:
  - name: web
    default_port: 8080
    kubernetes:
      namespace: shop
      service: web
      port_name: http
      kubeconfig: ~/.kube/config
      context: prod
```

::configuration-keys{prefix="services[].kubernetes."}

Without `kubeconfig`, vigie looks for `$KUBECONFIG`, then `~/.kube/config`, then the service account of the pod it runs
in.

vigie reads the Service, then its EndpointSlices, and gives each address of each ready endpoint. An endpoint without a
ready condition counts as ready, as in Kubernetes. Endpoints that aren't ready, terminating pods for instance, are left
out. A dual-stack Service gives each pod once per address family, and slices of host names (`FQDN`) are skipped.

- The port is the one named `port_name`. Without `port_name`, it's the port of the Service when it has only one, else
  `default_port`.
- The weight is `0`, Kubernetes has no weight per endpoint.

vigie loads the kubeconfig when the services load, at start and on each reload, and connects to the cluster each time
the cache of the service expires, with an 8 second timeout. Each read sends two requests to the Kubernetes API, with no
rate limit on the vigie side, so the limits of the API server apply. A kubeconfig that can't be loaded stops vigie at
start, and keeps the previous services on reload. `check-config` doesn't load the kubeconfig, so it can't catch that.

In a cluster, the service account of vigie needs to read the Service and list its EndpointSlices:

```yaml
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

| Error | Cause |
|---|---|
| `service kubernetes service is empty` | `service` is empty. |
| `load kubernetes client config: <err>` | At load, the kubeconfig or its context can't be loaded, or vigie runs outside a cluster without a kubeconfig. |
| `get service <namespace>/<service>: <err>` | On a request, the Service doesn't exist, or the cluster can't be reached or refuses vigie. |
| `port <port_name> not found in service <namespace>/<service>` | On a request, the Service has no port named `port_name`. |

A Service that exists without any ready endpoint answers `200` with `[]`.

## Endpoint lines

Files, remote lists and `eds=` TXT records hold one endpoint per line:

```text
# web servers
10.0.0.5
10.0.0.6:8081
10.0.0.7:8080#3
http://10.0.0.8:8080#1
```

- The form is `host[:port][#weight]`, with an optional `scheme://` in front, which vigie ignores.
- Without a port, the endpoint takes `default_port`. Without a weight, its weight is `0`.
- Empty lines and lines starting with `#` are skipped.
- vigie doesn't resolve host names, so write IP addresses. The flock agent refuses an endpoint whose `ip` isn't an IP
  address.

A line with a weight or a port that isn't a number fails the whole request with `invalid weight` or `invalid port`.
