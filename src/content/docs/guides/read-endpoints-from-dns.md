---
title: Read endpoints from DNS
description: Serve the addresses of a DNS name, the targets of its SRV records, or endpoints written in TXT records, with the dns source.
sidebar:
  order: 1
tags: [sources, dns]
---

The `dns` source turns DNS records into endpoints. It suits services already published in DNS, by your own zones or by a
registry such as Consul. This guide covers its three lookups and the `resolver` key. Consul has its own guide, [Read
Consul services](/guides/read-consul-services/).

| `type` | Use it when |
|---|---|
| `IP` (default) | Every address of a name listens on the same port. |
| `SRV` | Each endpoint has its own port or weight, published as SRV records. |
| `TXT` | You want to write the endpoints in your zone without SRV, one `eds=` record each. |

## Serve the addresses of a name

With `type: IP`, Vigie looks up the A and AAAA records of `name` and gives each address on the `default_port` of the
service, with a weight of `0`.

```yaml title="config.yml"
services:
  - name: web
    default_port: 8080
    dns:
      name: web.example.com
```

If `web.example.com` has the A records `10.0.0.5` and `10.0.0.6`, the service gives `10.0.0.5:8080` and `10.0.0.6:8080`.

## Serve the targets of SRV records

With `type: SRV`, Vigie looks up `_<srv_service>._<srv_proto>.<name>`, then the addresses of each target. Each address
takes the port and the weight of its record. A record with port `0` takes the `default_port`.

1. Publish the SRV records in your zone.

    ```text
    _http._tcp.api.example.com. 300 IN SRV 10 5 8080 api-1.example.com.
    _http._tcp.api.example.com. 300 IN SRV 10 1 8080 api-2.example.com.
    ```

2. Point the service at them. `srv_service` and `srv_proto` default to `http` and `tcp`.

    ```yaml title="config.yml"
    services:
      - name: api
        default_port: 8080
        dns:
          name: api.example.com
          type: SRV
          srv_service: http
          srv_proto: tcp
    ```

The service gives each address of `api-1.example.com` with weight `5` and each address of `api-2.example.com` with
weight `1`, both on port `8080`. Vigie ignores the priority of the records.

## Write endpoints in TXT records

With `type: TXT`, Vigie reads the TXT records of `name` and keeps those that start with `eds=`. The rest of each record
is an [endpoint line](/reference/configuration/#endpoint-lines), `host[:port][#weight]`, so a TXT record can carry a
port and a weight without SRV.

1. Publish one record per endpoint.

    ```text
    db.example.com. 300 IN TXT "eds=10.0.1.10:5432#2"
    db.example.com. 300 IN TXT "eds=10.0.1.11:5432#1"
    db.example.com. 300 IN TXT "v=spf1 -all"
    ```

2. Point the service at the name.

    ```yaml title="config.yml"
    services:
      - name: db
        default_port: 5432
        dns:
          name: db.example.com
          type: TXT
    ```

The service gives the two endpoints and skips the SPF record. Write IP addresses in the records, because Vigie doesn't
resolve the host of a line.

## Query a given DNS server

Without `resolver`, Vigie uses the resolver of the system. Set `resolver` to send every lookup of the service to one DNS
server instead, the lookups of the SRV targets included:

```yaml title="config.yml" ins={7}
services:
  - name: api
    default_port: 8080
    dns:
      name: api.example.com
      type: SRV
      resolver: 10.0.0.53:53
```

Vigie then asks that server over TCP, which keeps a long answer whole where UDP could cut it, and gives up after 8
seconds. An IPv6 server goes in brackets, such as `[fd00::53]:53`.

## Check the result

1. Check the file and reload the services, see [Reload the services](/guides/reload-the-services/).
2. Ask for the service.

    ```bash
    curl -s 'http://localhost:8080/services?service_name=api'
    ```

A name that doesn't resolve answers `500` with `resolve service api failed:` and the error of the lookup. Compare with
`dig`, against the same server when you set `resolver`:

```bash
dig +tcp @10.0.0.53 -p 53 _http._tcp.api.example.com SRV
```

Vigie keeps each answer for `cache_ttl`, 5 seconds by default, whatever the TTL of the records.
[Configuration](/reference/configuration/#dns) lists every key of the source.
