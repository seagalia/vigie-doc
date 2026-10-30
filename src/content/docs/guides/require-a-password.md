---
title: Require a password
description: Make the Vigie server ask for a username and a password with HTTP basic authentication, and give them from the clients.
sidebar:
  order: 8
tags: [security, configuration]
---

By default, anyone who reaches the port of Vigie can read its services and reload them. With `server.basic_auth`, every
endpoint but the health checks (`GET /healthz` and the gRPC health service) asks for the username and password of one
of the users you list. Probes keep working without credentials.

Basic authentication sends the password in clear on each request. Turn on HTTPS with
[`server.tls`](/reference/configuration/#file-structure) when the network between the clients and Vigie isn't trusted.

## Turn it on

1. Add the users to `server` in the configuration. Give each client its own user, so you can change one password
   without touching the other clients.

    ```yaml title="config.yml" ins={6-10}
    server:
      listen_addr: :8443
      tls:
        cert_file: /etc/vigie/vigie.crt
        key_file: /etc/vigie/vigie.key
      basic_auth:
        - username: flock
          password: change-me
        - username: meridian
          password: change-me-too
    services:
      - name: web
        default_port: 8080
        file:
          path: /etc/vigie/web-endpoints.txt
    ```

   The file now holds passwords, so only the user that runs Vigie should read it.

2. Check the file and restart Vigie. A reload doesn't apply a change to `server`.

    ```bash
    vigie check-config -c /etc/vigie/config.yml
    sudo systemctl restart vigie
    ```

## Check the result

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://vigie.example.com:8443/services?service_name=web'
curl -s -u flock:change-me 'https://vigie.example.com:8443/services?service_name=web'
```

The first request answers `401`, the second the endpoints of `web`. A browser asks for a username and password before
showing the [page](/reference/web-page/).

## Give the credentials to the clients

A [Flock backend](/guides/feed-flock-backends/) gives them in `url.user_info` of its `eds` block. Any other client sends
them in an `Authorization: Basic` header, as `curl -u` does.
