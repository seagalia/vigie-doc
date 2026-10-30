---
title: Read Kubernetes Services
description: Serve the ready pods of a Kubernetes Service with the kubernetes source, from inside the cluster or from outside with a kubeconfig.
sidebar:
  order: 3
tags: [sources, kubernetes]
---

The `kubernetes` source serves the ready endpoints of a Kubernetes Service, read from its EndpointSlices. A client
outside the cluster, such as a load balancer in front of it, then reaches the pods directly, without a NodePort or a
LoadBalancer Service in between. The pod addresses must be routable from that client.

## Before you start

You need:

- A Service with a selector, so that Kubernetes keeps its EndpointSlices.
- Either Vigie running in the cluster with a service account, or a kubeconfig on the host that runs Vigie.

## Give Vigie the right to read the Service

Vigie reads the Service, then lists its EndpointSlices. In the namespace of the Service, give its identity these two
rights:

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

This binds the service account `vigie` of the namespace `vigie`, the one of [Run in a Kubernetes
cluster](/start/install/#run-in-a-kubernetes-cluster). From outside the cluster, bind the user of the kubeconfig
instead. Repeat the Role and the RoleBinding in each namespace Vigie reads.

## Read a Service

```yaml title="config.yml"
services:
  - name: web
    default_port: 8080
    kubernetes:
      namespace: shop
      service: web
      port_name: http
```

- The port of the endpoints is the one named `port_name` among the ports of the Service. Without `port_name`, it's the
  port of the Service when it has only one, else the `default_port` of the service.
- The weight is always `0`, Kubernetes has no weight per endpoint.
- An endpoint that isn't ready, a terminating pod for instance, is left out. An endpoint without a ready condition
  counts as ready, as in Kubernetes.
- A dual-stack Service gives each pod once per address family.

A Service without any ready pod answers `200` with `[]`.

## Read a cluster from outside

Set `kubeconfig`, and `context` to pick another context than the current one:

```yaml title="config.yml" ins={9-10}
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

Without `kubeconfig`, Vigie looks for `$KUBECONFIG`, then `~/.kube/config`, then the service account of the pod it runs
in.

Two services can read two clusters, each with its own kubeconfig or context.

## Know what it costs the API server

Vigie loads the kubeconfig when it loads the services, at start and on each reload. It reads the cluster each time the
cache of the service expires, every 5 seconds by default while clients poll, with two requests, one for the Service and
one for its EndpointSlices. Vigie doesn't rate-limit them, so raise `cache_ttl` for a busy API server.

A kubeconfig that can't be loaded stops Vigie at start, and makes a reload keep the previous services. `vigie
check-config` doesn't load it, so it can't catch that.

## Check the result

```bash
kubectl -n shop get endpointslices -l kubernetes.io/service-name=web
curl -s 'http://localhost:8080/services?service_name=web'
```

| Error in the answer                              | Cause                                                                                                                       |
|--------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------|
| `get service shop/web: <err>`                    | The Service doesn't exist, or the cluster can't be reached or refuses Vigie. A `forbidden` error means the Role is missing. |
| `list endpointslices of service shop/web: <err>` | Vigie can read the Service but not list its EndpointSlices, usually the second rule of the Role is missing.                 |
| `port http not found in service shop/web`        | The Service has no port named `port_name`.                                                                                  |

[Configuration](/reference/configuration/#kubernetes) lists every key of the source.
