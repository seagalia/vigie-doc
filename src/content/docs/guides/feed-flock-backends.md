---
title: Feed Flock backends
description: Point the eds block of a Flock backend at Vigie, so the Flock agents follow the endpoints of a service as they change.
sidebar:
  order: 5
tags: [flock, http-api]
---

A [Flock](https://github.com/seagalia/flock) backend takes its endpoints from one of three sources, and `eds` is the one
that polls an endpoint discovery service such as Vigie. Each Flock agent then asks Vigie for the endpoints of the service
every `refresh_rate` of the backend, and replaces the endpoints of the backend with the answer. It sends `GET
<url>?service_name=<service_name>` with an `http` or `https` URL, and calls the [EDS
service](/reference/http-api/#the-eds-service) of Vigie with a `grpc` or `grpcs` URL.

## Before you start

You need:

- A Vigie server that every Flock agent can reach, with the service to serve, here `web`.
- The `flock` command line, signed in to the controller with the right to create backends.

## Write the backend

```yaml title="backend.yml"
name: shop-web
lb_policy: ROUND_ROBIN
refresh_rate: 10s
eds:
  url:
    scheme: http
    host: vigie.example.com
    port: 8080
    path: /services
  service_name: web
health_check:
  interval: 10s
  timeout: 5s
  tcp_health_check: {}
```

- `url` gives the address of Vigie with the path `/services`. With an `http` or `https` scheme, the agent reads the JSON
  answer of Vigie. [Call Vigie over gRPC](#call-vigie-over-grpc) shows the other two schemes, and Flock refuses any
  other.
- `service_name` is the name of the service in the configuration of Vigie. Leave it empty to get the service named
  `default`.
- `refresh_rate` is how often each agent polls Vigie. Keep it at or above the `cache_ttl` of the service in Vigie, 5
  seconds by default, since a faster poll only gets the same cached answer.

Check the file, then create the backend:

```bash
flock validate backend -f backend.yml
flock create-backend -f backend.yml
```

## Serve Vigie over HTTPS

When the agents reach Vigie over a network you don't trust, [serve HTTPS](/guides/serve-https/) and change the URL of
the backend:

```yaml title="backend.yml" ins={3,5,7-10}
eds:
  url:
    scheme: https
    host: vigie.example.com
    port: 8443
    path: /services
  ca: |
    -----BEGIN CERTIFICATE-----
    ...
    -----END CERTIFICATE-----
  service_name: web
```

`ca` holds the PEM of the CA that signed the certificate of Vigie. Without it, the agents check the certificate against
the CAs of their system.

When Vigie [requires a password](/guides/require-a-password/), give the username and password of one of its users in
`url.user_info` of the backend:

```yaml title="backend.yml" ins={7-9}
eds:
  url:
    scheme: https
    host: vigie.example.com
    port: 8443
    path: /services
    user_info:
      user: flock
      password: change-me
  service_name: web
```

The agents send them as basic authentication on each poll. Serve Vigie over HTTPS in that case, because basic
authentication sends the password in clear.

## Call Vigie over gRPC

With the scheme `grpc`, the agents call the EDS service of Vigie in clear text (h2c), and with `grpcs` over TLS. Vigie
answers both on its usual port, so only the URL of the backend changes:

```yaml title="backend.yml" ins={3,6}
eds:
  url:
    scheme: grpc
    host: vigie.example.com
    port: 8080
  service_name: web
```

The URL has no path. In the gRPC modes the path goes before the name of the procedure, for a Vigie behind a reverse
proxy under a prefix, so a URL that keeps `/services` fails each poll with the code `Unimplemented`.

With `grpcs`, `ca` and `url.user_info` work as in [Serve Vigie over HTTPS](#serve-vigie-over-https):

```yaml title="backend.yml" ins={3,5}
eds:
  url:
    scheme: grpcs
    host: vigie.example.com
    port: 8443
    user_info:
      user: flock
      password: change-me
  ca: |
    -----BEGIN CERTIFICATE-----
    ...
    -----END CERTIFICATE-----
  service_name: web
```

## Check the result

```bash
curl -s 'http://vigie.example.com:8080/services?service_name=web'
flock status-endpoints
```

The agents see the endpoints Vigie serves, as their health check finds them. An endpoint whose `ip` isn't an IP address
is refused by the agent, so write addresses in the files, lists and TXT records Vigie reads.

The `eds` block is described in the [Flock documentation](https://flock.seagalia.io/concepts/resources/backend/), and
`flock explain backend eds` prints its fields.
