---
title: Serve HTTPS
description: Make the Vigie server speak HTTPS with a certificate and its key, and check it from a client.
sidebar:
  order: 6
tags: [tls, configuration]
---

By default, Vigie speaks plain HTTP. With `server.tls`, it speaks HTTPS only, on the same `listen_addr`. Use it when
clients reach Vigie over a network you don't trust, so they can check that the endpoints come from your server.

Vigie doesn't check the certificates of its clients. To restrict who can read it, [require a
password](/guides/require-a-password/) or filter the port with a firewall.

## Before you start

You need a certificate for the name the clients use to reach Vigie, and its private key, both in PEM. The certificate
file can hold the chain after the certificate of the server.

## Turn HTTPS on

1. Put the files where the user that runs Vigie can read them, and only that user for the key.

    ```bash
    sudo install -m 0644 vigie.crt /etc/vigie/vigie.crt
    sudo install -m 0600 -o vigie vigie.key /etc/vigie/vigie.key
    ```

    With the dynamic user of the systemd unit of the repository, add `LoadCredential=` to the unit, or a fixed `User=`,
    so the key can stay private.

2. Set `server.tls` in the configuration.

    ```yaml title="config.yml" ins={3-5}
    server:
      listen_addr: :8443
      tls:
        cert_file: /etc/vigie/vigie.crt
        key_file: /etc/vigie/vigie.key
    services:
      - name: web
        default_port: 8080
        file:
          path: /etc/vigie/web-endpoints.txt
    ```

3. Check the file and restart Vigie. A reload doesn't apply a change to `server`.

    ```bash
    vigie check-config -c /etc/vigie/config.yml
    sudo systemctl restart vigie
    ```

Vigie reads the certificate once at start, so a renewed certificate also needs a restart.

## Check the result

```bash
curl -s --cacert ca.crt 'https://vigie.example.com:8443/services?service_name=web'
```

`--cacert` gives the CA that signed the certificate, when the system doesn't trust it already. The clients need the same
CA, such as the `ca` field of a [Flock backend](/guides/feed-flock-backends/#serve-vigie-over-https).

| Error | Cause |
|---|---|
| `server tls: cert_file and key_file are required` | `server.tls` is set with an empty `cert_file` or `key_file`. |
| `open /etc/vigie/vigie.key: permission denied` at start | The user that runs Vigie can't read the key. |
| `tls: private key does not match public key` at start | The key isn't the key of the certificate. |
