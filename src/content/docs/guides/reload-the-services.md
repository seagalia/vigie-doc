---
title: Reload the services
description: Apply a change to the services of the configuration without a restart, with SIGHUP or POST /reload, and know what a reload keeps.
sidebar:
  order: 7
tags: [operations, configuration]
---

A change to the endpoints themselves, in DNS, in a file, in a remote list or in Kubernetes, needs no reload, because
Vigie reads the sources again once the cache of the service expires. A reload is for a change to the `services` of the
configuration file, such as a new service or another source.

A reload reads the file again and swaps all the services at once. When the new file is invalid, or one of its sources
can't be built, Vigie keeps every service it had. A reload also empties the cache.

A reload replaces `services`, with the `cache.ttl` they take. A change to `server` or `log` needs a restart, and so does
a change to `disable_reload_by_request`.

## Check the file first

```bash
vigie check-config -c /etc/vigie/config.yml
```

`check-config` refuses the keys it doesn't know, where a reload ignores them, so a misspelled key would otherwise pass
unnoticed.

## Reload with a signal

Send `SIGHUP` to the process. It works whatever `disable_reload_by_request` says.

```bash
kill -HUP "$(pgrep -x vigie)"
```

With the systemd unit of the repository, `ExecReload` sends the signal:

```bash
sudo systemctl reload vigie
```

The signal gives no answer. The logs of Vigie tell the result. A reload that succeeds logs `Services loaded`, and one
that fails logs an error line with `read config` or `load services`.

```bash
journalctl -u vigie -n 20
```

## Reload with a request

When `disable_reload_by_request` is `false`, the default, send a `POST` to `/reload`:

```bash
curl -s -X POST http://localhost:8080/reload
```

Vigie answers `200` with `services reloaded`, or `422` with `services not reloaded:` and the error, and then keeps the
previous services.

Without `server.basic_auth`, anyone who reaches the port can make Vigie read the file again. When other hosts can reach
the server, [require a password](/guides/require-a-password/), or turn the endpoint off and reload with the signal:

```yaml title="config.yml"
disable_reload_by_request: true
```

`/reload` then answers `404`. This change needs a restart.

## Reload in Kubernetes

A ConfigMap mounted as a volume is updated in the pod after a while, but nothing sends `SIGHUP` to Vigie. Restart the
pods after a change to the ConfigMap:

```bash
kubectl -n vigie rollout restart deployment/vigie
```
