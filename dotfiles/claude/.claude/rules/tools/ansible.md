---
paths:
  - "**/ansible/*.yml"
  - "**/ansible/inventories/*.yml"
  - "**/ansible/inventory.ini"
---

- Do not use personal aliases to declare hosts, use the IP addresses instead.
  - You can look at the aliases to find out the IP addresses of the hosts, but never reference the alias exactly.
- Never state a playbook works without verifying it using `--diff` and `--check` flags.
  - If a task fails because of using `--check`, add a skip to it.