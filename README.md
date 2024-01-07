# NameSys/CCIP2.eth Backend Service

Backend support for CCIP2.eth

## Persistent node.js service with `systemctl`

### Service file

- Put `namesys.service.conf` in `/etc/systemd/system/`

### Service Handling

- Start: `systemctl start namesys.service`
- Stop: `systemctl stop namesys.service`

### Verify

- `journalctl -u namesys.service`

FAQ: [Source](https://github.com/natancabral/run-nodejs-on-service-with-systemd-on-linux/)
