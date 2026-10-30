---
title: Glossary
description: The terms used across the Vigie documentation, with a short definition and the page that explains each one.
sidebar:
  order: 90
---

This glossary defines the words the Vigie documentation uses with a precise meaning. Each definition links to the page
that explains the term in full.

| Term | Abbreviation | Definition |
| --- | --- | --- |
| Cache TTL | | How long Vigie reuses the answer of a source before it reads the source again, 5 seconds by default. See [The cache](/concepts/how-vigie-works/#the-cache). |
| Default port | | The port an endpoint takes when its source gives none, set by `default_port` of the service. See [Configuration](/reference/configuration/#services). |
| Endpoint | | One IP address and port that a service gives, with its load balancing weight. See [HTTP API](/reference/http-api/#get-services). |
| Endpoint discovery service | EDS | An HTTP service that gives the endpoints of a service to the clients that poll it, such as Vigie. See [How Vigie works](/concepts/how-vigie-works/). |
| Endpoint line | | One line of a file, a remote list or a TXT record, written `host[:port][#weight]`. See [Endpoint lines](/reference/configuration/#endpoint-lines). |
| EndpointSlice | | The Kubernetes object that lists the pods behind a Kubernetes Service, read by the `kubernetes` source. See [Read Kubernetes Services](/guides/read-kubernetes-services/). |
| Load balancing weight | | The share of the traffic a client should send to an endpoint, `0` when the source gives none. See [HTTP API](/reference/http-api/#get-services). |
| Reload | | Reading the configuration file again to replace the services, on `SIGHUP` or `POST /reload`. See [Reload the services](/guides/reload-the-services/). |
| Resolver | | The DNS server a `dns` source queries over TCP instead of the resolver of the system. See [Read endpoints from DNS](/guides/read-endpoints-from-dns/#query-a-given-dns-server). |
| Service record | SRV | A DNS record giving the host, port and weight of one instance of a service. See [Read endpoints from DNS](/guides/read-endpoints-from-dns/#serve-the-targets-of-srv-records). |
| Source | | Where a service reads its endpoints, one of `dns`, `file`, `url` or `kubernetes`. See [Services and sources](/concepts/how-vigie-works/#services-and-sources). |
