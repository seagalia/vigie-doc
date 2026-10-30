---
title: Feed Flock backends
description: Point the eds block of a Flock backend at Vigie, so the Flock agents follow the endpoints of a service as they change.
sidebar:
  order: 5
tags: [flock, http-api]
---

A [Flock](https://github.com/seagalia/flock) backend takes its endpoints from one of three sources, and `eds` is the one
that polls an endpoint discovery service such as Vigie. Each Flock agent then sends `GET
<url>?service_name=<service_name>` to Vigie every `refresh_rate` of the backend, and replaces the endpoints of the
backend with the answer.

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
  answer of Vigie. Another scheme makes it call a gRPC discovery service instead.
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

Vigie has no authentication of its own. To require one, put Vigie behind a proxy that checks it, then give the
credentials in `url.user_info` for basic authentication, or in `headers`.

## Check the result

```bash
curl -s 'http://vigie.example.com:8080/services?service_name=web'
flock status-endpoints
```

The agents see the endpoints Vigie serves, as their health check finds them. An endpoint whose `ip` isn't an IP address
is refused by the agent, so write addresses in the files, lists and TXT records Vigie reads.

The `eds` block is described in the [Flock documentation](https://flock.seagalia.io/concepts/resources/backend/), and
`flock explain backend eds` prints its fields.
