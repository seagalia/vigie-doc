---
title: Read a file or a remote list
description: Serve endpoints written by hand or by a tool in a local file, or served as text by an inventory over HTTP.
sidebar:
  order: 4
tags: [sources, tls]
---

The `file` and `url` sources read a plain text list of endpoints, one per line. Use `file` for a list kept on the host,
written by hand or by a configuration management tool, and `url` for a list that another system serves, such as an
inventory or a CMDB export.

The `file` source is also the way in for any system that Vigie has no source for. A cron job or a sidecar asks that
system for its endpoints and writes them to the file, and Vigie serves whatever the file holds.

## Write the list

Both sources read the same [endpoint lines](/reference/configuration/#endpoint-lines):

```text title="endpoints.txt"
# web servers
10.0.0.5
10.0.0.6:8081
10.0.0.7:8080#3
[fd00::7]:8080#3
```

- The form is `host[:port][#weight]`, with an optional `scheme://` in front, which Vigie ignores.
- A line without a port takes the `default_port` of the service, and one without a weight gets `0`.
- Empty lines and lines starting with `#` are skipped.
- Write IP addresses. Vigie doesn't resolve host names, and clients such as the Flock agent refuse an `ip` that isn't an
  address. Write an IPv6 address in brackets and always with its port, such as `[fd00::7]:8080`, because without a port
  Vigie keeps the brackets in the `ip` it serves.

One line with a port or a weight that isn't a number fails the whole service, with `invalid port` or `invalid weight` in
the error.

## Read a local file

```yaml title="config.yml"
services:
  - name: web
    default_port: 8080
    file:
      path: /etc/vigie/web-endpoints.txt
```

Vigie reads the file again each time the cache of the service expires, every 5 seconds by default, so an edit shows
without a reload. Write the new file next to the old one and rename it over, so Vigie never reads a file half written. A
relative `path` starts from the working directory of the process, so prefer an absolute one.

## Read a list over HTTP

```yaml title="config.yml"
services:
  - name: db
    default_port: 5432
    url:
      url: https://inventory.example.com/db-endpoints.txt
      basic_auth:
        username: vigie
        password: change-me
```

Vigie sends a `GET` to `url` and reads the body as lines when the answer is `200`. Any other status fails the service
with `bad status code: <code>, <body>`. The request gives up after 8 seconds.

- `basic_auth` is sent only when both `username` and `password` are set. The [web page](/reference/web-page/) never
  shows them.
- The `HTTPS_PROXY`, `HTTP_PROXY` and `NO_PROXY` environment variables of the process apply to the request.
- Vigie checks the certificate of an HTTPS server against the CAs of the system. `insecure_skip_verify: true` turns the
  check off, for a test server only, because anyone on the path could then serve their own endpoints.

The password sits in clear in the configuration file, so keep the file readable only by the user that runs Vigie.

## Check the result

```bash
curl -s 'http://localhost:8080/services?service_name=db'
```

When the list can't be read, the answer is `500` with `resolve service db failed:` and the cause, such as `open
/etc/vigie/web-endpoints.txt: no such file or directory` or `bad status code: 401`.
