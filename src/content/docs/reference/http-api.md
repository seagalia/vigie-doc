---
title: HTTP API
description: The endpoints the Vigie server answers, the JSON format of the endpoints of a service, the gRPC service that gives the same answer, and the errors of each.
sidebar:
  order: 3
tags: [http-api]
---

The Vigie server speaks HTTP/1.1 and HTTP/2 on `server.listen_addr` (`:8080` by default), over TLS only when
`server.tls` is set. Without TLS it also accepts HTTP/2 in clear text (h2c), which gRPC clients use. Without
`server.basic_auth` none of its endpoints asks for authentication. With it, every endpoint but the health checks asks
for the username and password of one of its users, see [Authentication](#authentication).

| Method and path | Answer |
|---|---|
| `GET /services?service_name=<name>` | The endpoints of the service, as JSON. |
| `GET /healthz` | `200` with `ok` while the server runs. |
| `POST /reload` | Reads the configuration file again and replaces the services. Absent with `disable_reload_by_request: true`. |
| `GET /` | The [web page](/reference/web-page/) listing the services. |
| `POST /vigie.eds.v1.EndpointDiscoveryService/GetEndpoints` | The endpoints of the service, over gRPC or the Connect protocol, see [The EDS service](#the-eds-service). |
| `POST /grpc.health.v1.Health/Check` | The gRPC health service, `SERVING` while the server runs, without asking for `server.basic_auth`. |
| `POST /grpc.reflection.v1.ServerReflection/ServerReflectionInfo` | gRPC reflection, so tools such as `grpcurl` need no proto file. `v1alpha` is served too. |

Any other path answers `404`, and a known path asked with another method answers `405`.

## `GET /services`

Returns the endpoints of one service.

| Query parameter | Required | Default | Description |
|---|---|---|---|
| `service_name` | no | `default` | Name of the service, as written in `services[].name`. |

The answer is `200` with `Content-Type: application/json` and a JSON array, one object per endpoint, in the order the
source gives them:

| Field | Type | Description |
|---|---|---|
| `ip` | string | IPv4 or IPv6 address of the endpoint, without brackets. A `file` or `url` source copies the host of its line as is, see [Endpoint lines](/reference/configuration/#endpoint-lines). |
| `port` | integer | Port of the endpoint, or the `default_port` of the service when the source gives none. |
| `load_balancing_weight` | integer | Weight of the endpoint, `0` when the source gives none. |

```console
$ curl -s 'http://localhost:8080/services?service_name=web'
[
  {
    "ip": "10.0.0.5",
    "port": 8080,
    "load_balancing_weight": 0
  },
  {
    "ip": "10.0.0.7",
    "port": 8080,
    "load_balancing_weight": 3
  }
]
```

A source that finds no endpoint answers `200` with `[]`, such as a Kubernetes Service without any ready pod.

The answer can be up to `cache_ttl` old, 5 seconds by default, see [The cache](/concepts/how-vigie-works/#the-cache).

| Status | Body | Cause |
|---|---|---|
| `401` | `unauthorized` | `server.basic_auth` is set and the request has none of its users. |
| `404` | `service <name> not found` | No service has this name, or the request has no `service_name` and no service is named `default`. |
| `500` | `resolve service <name> failed: <err>` | The source failed, such as a DNS lookup that found nothing or a remote list that answered with an error. `<err>` tells which. |

The fields and the `service_name` parameter are read by the agents of Flock and by meridian, and stay stable across
versions.

## The EDS service

`vigie.eds.v1.EndpointDiscoveryService` gives the same endpoints as `GET /services`, as protobuf messages, on the same
port and behind the same `server.basic_auth`. Its one method, `GetEndpoints`, takes the name of a service:

| Request field | Type | Description |
|---|---|---|
| `service_name` | string | Name of the service, as written in `services[].name`. Empty asks for the service named `default`. |

It answers a list of endpoints in `endpoints`, each with the fields of the JSON answer:

| Field | Type | Description |
|---|---|---|
| `ip` | string | IPv4 or IPv6 address of the endpoint. |
| `port` | uint32 | Port of the endpoint, or the `default_port` of the service. |
| `load_balancing_weight` | uint32 | Weight of the endpoint, `0` when the source gives none. |

```console
$ grpcurl -plaintext -d '{"service_name": "web"}' localhost:8080 vigie.eds.v1.EndpointDiscoveryService/GetEndpoints
{
  "endpoints": [
    {
      "ip": "10.0.0.5",
      "port": 8080
    },
    {
      "ip": "10.0.0.7",
      "port": 8080,
      "loadBalancingWeight": 3
    }
  ]
}
```

`grpcurl` leaves out the fields equal to `0` and writes the names in camel case, which is how protobuf prints JSON. With
TLS, drop `-plaintext` and give the CA with `-cacert`. With `server.basic_auth`, add `-H "authorization: Basic $(printf
flock:change-me | base64)"`.

| Code | Message | Cause |
|---|---|---|
| `Unauthenticated` | `HTTP status 401 Unauthorized` | `server.basic_auth` is set and the call has none of its users. |
| `NotFound` | `service <name> not found` | No service has this name, or the request has no `service_name` and no service is named `default`. |
| `Unavailable` | `resolve service <name> failed: <err>` | The source failed, like the `500` of `GET /services`. |
| `Unimplemented` | `HTTP status 404 Not Found` | The procedure isn't at that path, such as a client whose base URL ends with `/services`. |

The service is defined in
[`api/vigie/eds/v1/eds.proto`](https://github.com/seagalia/vigie/blob/main/api/vigie/eds/v1/eds.proto), and the Go
module `github.com/seagalia/vigie` gives a client in `sdk/clients`:

```go
client, err := clients.NewEndpointDiscovery("http://vigie.example.com:8080", clients.Options{})
if err != nil {
	return err
}
resp, err := client.GetEndpoints(ctx, &eds.GetEndpointsRequest{ServiceName: "web"})
```

An `http` base URL calls Vigie in clear text (h2c) and an `https` one over TLS, with `Options.TLSConfig` when the CA
isn't one of the system. `Options.Username` and `Options.Password` are sent as basic authentication. A path in the base
URL goes before the procedure, for a Vigie behind a reverse proxy under a prefix.

## `GET /healthz`

Answers `200` with the body `ok` while the server runs, without asking for `server.basic_auth`. It doesn't read any
source, so it only tells that the process is up. Use it for liveness and readiness probes.

## `POST /reload`

Reads the configuration file again and replaces all the services, with the same effect as `SIGHUP`. It takes no body.

| Status | Body | Cause |
|---|---|---|
| `200` | `services reloaded` | The services of the file are now served. |
| `422` | `services not reloaded: <err>` | The file is invalid, or one of its sources can't be built, such as a `kubernetes` source whose kubeconfig can't be loaded. Vigie keeps serving the previous services. |
| `404` | `404 page not found` | The file sets `disable_reload_by_request: true`. |

Without `server.basic_auth`, anyone who reaches the server can make it read the file again. Set `server.basic_auth`, or
set `disable_reload_by_request: true` and reload with `SIGHUP`, when other hosts can reach the server. [Reload the
services](/guides/reload-the-services/) gives both ways.

## Authentication

With `server.basic_auth`, the server asks for HTTP basic authentication on every endpoint but `GET /healthz` and the
gRPC health service, which probes call without credentials. A request
must carry the username and password of one of the users in an `Authorization: Basic` header. Otherwise the server
answers `401` with the body `unauthorized` and the header `WWW-Authenticate: Basic realm="vigie", charset="UTF-8"`, so a
browser asks for them before showing the page.

```bash
curl -s -u flock:change-me 'https://vigie.example.com:8443/services?service_name=web'
```

A gRPC call carries the same `Authorization` header, and one without it fails with the code `Unauthenticated`.

[Require a password](/guides/require-a-password/) sets it up.
