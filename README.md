# NameSys/CCIP2.eth Backend Service

Backend support for CCIP2.eth

## Persistent node.js service with `systemctl`

### Service file

- Put `ccip2.service` in `/etc/systemd/system/`

### Service Handling

- Start: `systemctl start ccip2.service`
- Stop: `systemctl stop ccip2.service`

### Verify

- `journalctl -u ccip2.service`

FAQ: [Source](https://github.com/natancabral/run-nodejs-on-service-with-systemd-on-linux/)
