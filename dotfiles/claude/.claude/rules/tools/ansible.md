---
paths:
  - "**/ansible/**/*.yml"
  - "**/ansible/**/*.yaml"
  - "**/playbooks/**/*.yml"
  - "**/playbooks/**/*.yaml"
  - "**/inventory*.ini"
---

# Ansible

- Do not use personal aliases to declare hosts; use IP addresses instead. You may
  look at the aliases to find out the IPs, but never reference the alias itself.
- Never state a playbook works without verifying it with `--diff` and `--check`.
  If a task fails specifically because of `--check`, add a skip for check mode to
  that task.
- For a stronger verification than check mode, run the playbook for real against
  a disposable local VM (cloud-init setup for Ubuntu qcow2 VMs in `~/vms`) before
  any run targeting real hosts.

## Tags

- Tag every task by its functional type (e.g. `packages`, `config`, `services`,
  `firewall`, `certs`) so any subset can be executed or skipped with `--tags` /
  `--skip-tags`. Tasks of the same type share the same tag across the whole
  playbook — consistent vocabulary, kebab-case names.
- When several consecutive tasks share a type, group them in a `block` and tag the
  block once instead of repeating the tag per task.
- Reserve the special tag `always` for prerequisites that must run under any tag
  selection (fact gathering, loading variables); reserve `never` for
  dangerous or manual-only tasks that should run only when explicitly requested
  via `--tags`.
- When verifying a specific change, prefer running only its tag
  (`--tags config --check --diff`) over executing the full playbook.