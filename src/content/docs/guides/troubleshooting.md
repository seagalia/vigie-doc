---
title: Troubleshooting
description: What the errors of Vigie mean, at start, on a reload and in the answer of /services, and how to fix them.
sidebar:
  order: 9
tags: [operations]
---

Start with the page at the root of the server. It shows each service with the endpoints it gives right now, or the error
of its source in red. Then look at the logs of the process, on its standard error.

## The server doesn't start

`vigie serve` prints `vigie: error:` followed by the cause, and exits.

| Message | Cause | Fix |
|---|---|---|
| `read config: open <path>: no such file or directory` | No file at the path of `-c`, `./config.yml` by default. | Give the path with `-c`. |
| `read config: services is empty` | The file has no `services`. | Add at least one service. |
| `read config: service dns, file, url and kubernetes are empty, you must specify one of them` | A service has no source. | Give each service one source. |
| `load services: service <name>: load kubernetes client config: <err>` | The kubeconfig or its context of a `kubernetes` source can't be loaded, or Vigie runs outside a cluster without a kubeconfig. | Fix `kubeconfig` and `context`, see [Read Kubernetes Services](/guides/read-kubernetes-services/#read-a-cluster-from-outside). |
| `listen tcp :8080: bind: address already in use` | Another process listens on `server.listen_addr`. | Stop it, or change `listen_addr`. |

[Configuration](/reference/configuration/) lists the error of each key.

## A key has no effect

`vigie serve` and a reload ignore the keys they don't know, so a misspelled key keeps its default. Run `vigie
check-config`, which refuses them:

```console
$ vigie check-config -c /etc/vigie/config.yml
vigie: error: invalid config /etc/vigie/config.yml: yaml: unmarshal errors:
                line 2: field listen_adr not found in type config.plain
```

When the key is right, check that it's one a reload applies. A change to `server` or `log` needs a restart, and so does
a change to `disable_reload_by_request`.

## The answer of `/services` is an error

| Status and body | Cause | Fix |
|---|---|---|
| `401 unauthorized` | `server.basic_auth` is set and the request has no username and password, or wrong ones. | Give the username and password of one of its users, such as `url.user_info` of a Flock backend. |
| `404 service <name> not found` | No service has this name. Without `service_name`, no service is named `default`. | Check the name, or reload the file that adds the service. |
| `500 resolve service <name> failed: cannot resolve on lookup ...` | The DNS lookup failed or found no record. | Compare with `dig`, see [Read endpoints from DNS](/guides/read-endpoints-from-dns/#check-the-result). |
| `500 resolve service <name> failed: open <path>: ...` | The file of a `file` source is missing or unreadable by the user of Vigie. | Fix the path or its permissions. |
| `500 resolve service <name> failed: invalid port: ...` or `invalid weight: ...` | A line of a file, a remote list or a TXT record has a port or a weight that isn't a number. | Fix the line, see [Endpoint lines](/reference/configuration/#endpoint-lines). |
| `500 resolve service <name> failed: bad status code: <code>, <body>` | The server of a `url` source answered with another status than `200`. | Check the URL and `basic_auth`. |
| `500 resolve service <name> failed: get service <namespace>/<service>: ...` | The Kubernetes Service doesn't exist, or Vigie can't reach the cluster or isn't allowed to read it. | Check the name and the [Role](/guides/read-kubernetes-services/#give-vigie-the-right-to-read-the-service). |
| `500 resolve service <name> failed: list endpointslices of service <namespace>/<service>: ...` | Vigie isn't allowed to list the EndpointSlices of the Service. | Add the `endpointslices` rule to the Role. |

A failed read isn't cached, so the next request tries the source again.

## The endpoints are old

Vigie keeps each answer for the `cache_ttl` of the service, 5 seconds by default, so a change shows up to that time
later. A client also polls at its own pace, such as the `refresh_rate` of a Flock backend, which adds to the delay.

A change to the configuration file itself needs a reload. Without one, Vigie keeps serving the services it loaded.

## A reload doesn't apply

`POST /reload` answers `422 services not reloaded:` with the cause, and a `SIGHUP` logs it with `read config` or `load
services`. In both cases Vigie keeps the previous services. Fix the file, check it with `vigie check-config`, and reload
again.

`POST /reload` answers `404` when the file sets `disable_reload_by_request: true`. Use `SIGHUP` instead, see [Reload the
services](/guides/reload-the-services/).

## A client refuses the endpoints

The Flock agent refuses an endpoint whose `ip` isn't an IP address. Vigie copies the host of the lines of a file, a
remote list or a TXT record without resolving it, so a line with a host name gives an `ip` that is a name. Write IP
addresses in those lines, and an IPv6 address in brackets with its port.
