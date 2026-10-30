---
title: Read Consul services
description: Serve the healthy instances of a Consul service with the dns source, through the DNS interface of a Consul agent.
sidebar:
  order: 2
tags: [sources, dns, consul]
---

Consul answers DNS for the services it knows, so the [`dns` source](/guides/read-endpoints-from-dns/) reads them without
a Consul-specific source. Each instance gives one endpoint, with the port it registered and its weight.

## Before you start

You need a Consul agent that Vigie can reach, with its DNS interface on, by default on port `8600`.

## Set up the Consul agent

Two settings of the `dns_config` block of the agent change what Vigie sees:

```hcl title="consul.hcl"
dns_config {
  only_passing    = true
  enable_truncate = true
}
```

- `only_passing = true` keeps only the instances whose checks pass. By default, Consul DNS leaves out the instances
  whose checks are critical but keeps those in `warning`, and Vigie would hand them to its clients.
- `enable_truncate = true` matters when Vigie goes through the resolver of the system rather than `resolver`. Over UDP,
  Consul cuts a long answer to a few records without telling the client, so a service with many instances would lose
  some of them. With `resolver`, Vigie asks over TCP and gets every record.

## Read a service

Point a `dns` service with `type: SRV` at the DNS port of the agent:

```yaml title="config.yml"
services:
  - name: payments
    default_port: 8080
    dns:
      name: service.consul
      type: SRV
      srv_service: payments
      srv_proto: tcp
      resolver: 127.0.0.1:8600
```

This looks up `_payments._tcp.service.consul`, the RFC 2782 form of Consul. Each instance gives one endpoint, with the
port it registered and its weight `Weights.Passing`, which is `1` when the instance registered none.

Instead of `resolver`, the host can forward the `.consul` domain to the agent, with dnsmasq or systemd-resolved for
instance. Leave `resolver` empty then, and set `enable_truncate` on the agent.

## Keep only the instances with a tag

Put the tag in place of `tcp`. With `srv_proto: primary`, Vigie looks up `_payments._primary.service.consul` and gets
only the instances tagged `primary`.

```yaml title="config.yml" ins={8}
services:
  - name: payments-primary
    default_port: 8080
    dns:
      name: service.consul
      type: SRV
      srv_service: payments
      srv_proto: primary
      resolver: 127.0.0.1:8600
```

## Read another datacenter

Put the datacenter in the name. `name: service.dc2.consul` reads the instances of the datacenter `dc2`.

## Check the result

Compare what Consul answers with what Vigie serves:

```bash
dig +tcp @127.0.0.1 -p 8600 _payments._tcp.service.consul SRV
curl -s 'http://localhost:8080/services?service_name=payments'
```

A service unknown to Consul makes the lookup fail, and Vigie answers `500` with `resolve service payments failed:` and
the error.
