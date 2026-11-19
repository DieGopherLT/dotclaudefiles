---
name: ansible-conventions
description: Diego's strict conventions for writing and running Ansible - layout, variables, per-environment inventories, shared hosts, web server vhosts, tasks, and verification - plus his recipe book of solved problems. Use whenever writing, reviewing, refactoring, or running Ansible playbooks, roles, inventories, group_vars/host_vars, or templates, even for a one-task change. Trigger on "ansible", "playbook", "role", "inventario", "group_vars", "host_vars", "ansible-playbook", "ansible-vault", "agrega un host", "host compartido", "VM de prueba", "vhost", "nginx", "apache", "caddy", "despliega un servicio", "agrega esto como receta", "guarda la receta".
---

# Ansible conventions

Diego is strict about how Ansible code is written. Treat everything below as the rules for any playbook, role, or inventory you touch, and before solving a problem check `references/recipes.md`: if a recipe covers it, follow the recipe.

The principle behind the rules: **maximize declarativity.** A playbook describes the state each host must end up in, not the steps to get there. A task or role that reads like a script (chains of commands, `register` + `when` plumbing to emulate control flow) is a design smell; look for the module, data structure, or template that turns it back into a state declaration. When a situation is not covered below, choose the most declarative option.

## Layout

```
inventories/production/hosts.yml
inventories/production/group_vars/all.yml, group_vars/<group>.yml
inventories/production/host_vars/<host>-01.yml
inventories/vm/              # same shape, test VMs only
roles/common/            # baseline every host gets
roles/<concern>/         # one role per topic
setup.yml                # main entry point
requirements.yml         # community collections and Galaxy roles in use
```

- **Playbooks are named like functions:** a short verb phrase for what they do at a high level (`setup.yml`, `deploy.yml`, `rotate-keys.yml`). The main entry point is `setup.yml`.

### Roles or a standalone playbook

A role groups the tasks, variables, templates, and handlers of one topic, so the number of topics a playbook configures decides whether roles exist, not its number of tasks:

- **A playbook with two or more topics** (firewall, users, nginx): one role per topic, plus a `common` role for what every host needs.
- **One topic used by more than one playbook:** a role, so they all consume one definition.
- **One topic, one playbook:** a standalone playbook, with no roles of its own and no `common` role. Galaxy roles from `requirements.yml` do not change this. A long playbook splits into `tasks/<step>.yml` with `import_tasks`; length alone never justifies a role.

A standalone project keeps the inventories and swaps the roles for:

```
group_vars/all.yml       # optional, see "Variables without roles"
tasks/<step>.yml         # only once the playbook gets long
templates/<file>.j2
```

## Variables: general to specific

Define each variable at the most general level where it makes sense, then override only where a narrower scope differs:

1. `roles/<role>/defaults/main.yml`: the role's sensible default.
2. `group_vars/all.yml` in the environment's inventory: what every host of that environment shares.
3. `group_vars/<group>.yml`: what a group changes.
4. `host_vars/<host>.yml`: what a single host changes.

Play `vars` outrank `host_vars`, so they are not a layer here: a value set there cannot be overridden per host.

Never define a variable only at host level when other hosts need the same one; lift it up and override.

### Variables without roles

Without roles there is no `defaults` layer, and environments stay separate: production and VMs rarely have much in common. Layers 2-4 work the same, and what varies by environment stays in each inventory, never in a shared file.

Only if non-secret values are truly common to every environment, put them in a `group_vars/all.yml` next to the playbook and create it for nothing else. Ansible documents the location, but this use is not an established convention, so it needs these rules:

- **Override these values in the inventory's `group_vars/<group>.yml` or `host_vars/`, never in its `group_vars/all.yml`.** At the `all` level the playbook's file wins, so that override is ignored without warning.
- **No secrets or vaults.** This file loads for every inventory, so a secret here reaches VM runs.
- **Move its values to role defaults when the project gets its first role of its own.** With such roles the file is forbidden (see "Inventory and hosts").

`ansible-playbook` finds this file next to the playbook. `ansible` and `ansible-inventory` look in the current directory instead, so run them from the playbook's directory or pass `--playbook-dir`; otherwise these values come back undefined while you debug.

## Inventory and hosts

- **No personal SSH aliases.** Inventory must not rely on aliases from Diego's `~/.ssh/config`; set `ansible_host` to the real address and `ansible_user` explicitly so the inventory works on any machine.
- **No SSH keys in inventory.** Never set `ansible_ssh_private_key_file`: a key path is local to one machine and goes stale on rotation. The operator's SSH client picks the key: Diego lists each host's IP next to its alias in `~/.ssh/config` (`Host <alias> <ip>`), so a connection by IP gets the alias's `IdentityFile`. His keys have passphrases and Ansible cannot answer the prompt, so load the key into the agent first (connect once by alias, or `ssh-add -t 30m <key>`). On `Permission denied (publickey)`, check `ssh -G <ip>` and `ssh-add -l` before touching the inventory.
- **Numbered host names:** `<host>-01`, `<host>-02`, and so on, even when there is only one.
- **One inventory directory per environment.** Ansible loads `group_vars/` and `host_vars/` from the inventory file's directory, so `inventories/production/` and `inventories/vm/` each get only their own variables and vaults. Two inventory files in one directory share its `group_vars/all`, and a VM run then loads production secrets. Values both environments share go in role defaults, never in `group_vars/` next to the playbooks, which loads for every inventory. The one exception is a project without roles: see "Variables without roles".
- **Test VMs carry `vm` in their name** (`<host>-vm-01`), never the production host's name. Diego tests plays on local libvirt (`virsh`) VMs; a VM named like a production host gets confused with it in output, logs, and `--limit`.

### Groups per configuration domain

When a role applies to some hosts and not others, give it a group named after the role and point its play at that group. The inventory, not the playbook, then decides which domains each host gets:

```yaml
# setup.yml
- name: Join the tailnet
  hosts: tailscale
  roles:
    - role: tailscale
      tags: [tailscale]

- name: Run PostgreSQL
  hosts: postgresql
  roles:
    - role: postgresql
      tags: [postgresql]

# inventories/production/hosts.yml
all:
  children:
    tailscale:
      hosts:
        app-01:
    postgresql:
      hosts:
        db-01:
```

- **Membership, not flags.** Never select hosts with `when: inventory_hostname == ...` or booleans like `install_tailscale: true`; being in the group is the declaration.
- **Only when hosts differ.** A domain every host gets stays in `hosts: all` or the `common` role. Do not create a group for variation that does not exist yet.
- **Shared prerequisites target the union:** `hosts: postgresql:redis` installs Docker once for both groups.
- **The domain's variables and vaults go in its group's `group_vars`,** so they load only on hosts that run it.
- **An inventory that does not use a domain leaves the group undefined.** Ansible warns `Could not match supplied host pattern` and skips the play; that is expected, so do not declare empty groups to silence it.

## Shared hosts

Several of Diego's apps share a host, each provisioned from its own repo. Before adding a host to an inventory, search for its IP in the other projects' Ansible directories. `<project-roots>` are the directories that hold Diego's repos; ask him if you do not know them:

```sh
grep -rlF --include='*.yml' '<ip>' <project-roots> | grep '/ansible/'
```

Skip the check for VM inventories: libvirt reuses private addresses across unrelated VMs.

If the IP appears elsewhere, the host is shared, and both rules apply:

- **Each repo is self-sufficient.** It provisions everything it needs (packages, Docker, firewall rules, users) even if the other repo already does. Never rely on another project having run first.
- **Neither repo breaks the other's idempotency.** When both repos declare the same resource, they declare the same state. Only add to shared resources: one ufw rule per port and never `ufw reset` or default-policy changes, drop-in files (`/etc/ssh/sshd_config.d/`, `/etc/sudoers.d/`) instead of templating the main file, service-scoped names for users, paths, units, and ports, and no global pruning (`docker system prune`, `state: absent` on packages the other may use). To verify, apply the new playbook, then run the other repo's `setup.yml --check --diff` against the host: it must report `changed=0`.

## Services

### Installation order

Take the first option that provides the version you need:

1. **The distro's package.** It ships the systemd unit and the service user, so the play only configures them.
2. **The vendor's repository** (PGDG, `packages.redis.io`, `pkgs.tailscale.com`): declare it with `ansible.builtin.deb822_repository` and its signing key, then install the package.
3. **The vendor's official install method,** when the vendor publishes no repository: keep its script in `files/` and run it with `creates`, as the Tasks rules require.
4. **A container plus a systemd unit,** when no package provides the version, or when the host needs several instances (especially of different versions) and the packaging cannot run them side by side. PostgreSQL's `postgresql-common` can (`pg_createcluster`), so several PostgreSQL versions on one host stay as packages.

### One instance per host

A service that apps use as tenants (database, web server, cache, message broker, object storage, search, mail relay, bitcoind) runs once per host, and each app declares only its own part of it: a database and a role, a vhost, an ACL user, a bucket. Extra instances on the same host add no availability, because the host is still the failure domain, and each one adds its own baseline memory, backups, and upgrades.

Every repo using the instance installs it with the same generic main configuration, which includes a directory of per-app files, so the "Shared hosts" rules hold. "Web servers" below is the worked example of this pattern.

A separate instance needs one of these reasons: the app requires another major version, its load or tuning conflicts with the other apps, or it cannot follow the shared instance's upgrade schedule (a major upgrade hits every tenant at once). Otherwise, cap each tenant (connection limits, timeouts, memory quotas) so that a runaway app cannot exhaust the instance for the rest.

Services without tenants (chrony, fail2ban, node_exporter, tailscale, backup timers) follow only the installation order; they go in `common` or in their own domain group.

### Mail

Apps that only send mail get a relay (Postfix as a null client, or msmtp to an external SMTP server), never a full mail server. A server that receives mail (MX, SPF, DKIM, DMARC) is a project of its own: ask Diego before building one.

## Web servers

Any host may later serve other apps, so every web server (Apache, nginx, Caddy) is always configured for virtual hosts, even when the host serves only one app today:

- **The main config is generic**: global options plus an include of the vhost directory, nothing app-specific, so every repo that templates it renders the same content and shared hosts stay idempotent.
  - nginx: `include /etc/nginx/sites-enabled/*;`
  - Apache: `IncludeOptional sites-enabled/*.conf`
  - Caddy: `import /etc/caddy/sites/*.caddy`
- **Each app owns one vhost file** named after the app (`<app>.conf`, `<app>.caddy`), rendered from its own template. A repo never edits another app's vhost or the default site.
- **Reload through a handler that validates first** (`nginx -t`, `apachectl configtest`, `caddy validate`). A broken vhost then fails the run instead of taking down every app on the host.

## Tasks

- **Modules, not workarounds.** Use a built-in module first. If none exists, look for a well-maintained community collection (`community.general`, `ansible.posix`, `community.docker`...) and add it to `requirements.yml`. Do not fake a module with `lineinfile` stacks or `raw`.
- **`shell` and `command` are the last resort.** Only when no maintained module covers the step, and then as a script written to its own file (`files/` or `templates/*.j2`) and referenced from the task, never inline logic or heredocs. Make it idempotent (`creates`/`removes` or `changed_when`) so it still behaves as a state declaration and survives `--check`.
- **Templates for files.** Every file placed on a host is rendered with `template` from `templates/*.j2`.
- **Loops over copies.** When two tasks differ only in their data, make one task with `loop` over that data.
- **Composite data over duplication.** Model repeated resources as lists or lists of dicts (users, vhosts, mounts, firewall rules) defined once and consumed by loops and templates. If the same value or block appears twice, it belongs in a variable.
- **Tags on everything.** Every role inclusion and every task group gets tags, so any part of the playbook can run alone with `--tags`.
- **Transitions between playbook versions are not regular tasks.** Moving data that an earlier version left elsewhere, or removing what it put on hosts, follows the `ansible-migrations` skill: invoke it before writing that task.

## Host conventions

Whenever a play deploys a service, creates users, places files on disk, or touches vault, read `references/unix-checklist.md` and make the play satisfy it: FHS paths and permissions, dedicated service users, deploy users with their CI key, systemd units, vault password files.

## Verification

Before the `--check` run, dispatch the `ansible-toolkit:ansible-auditor` sub-agent with the changed paths. It reviews them adversarially against this plugin's skills and their references, and never touches hosts. Fix its Critical findings before applying; answer its Ambiguities or bring them to Diego.

Run every change with `ansible-playbook -i inventories/<env> --check --diff` before applying it. Some tasks fail in check mode only because of the dry run (e.g. a service task whose package was not actually installed yet). When the failure is a dry-run artifact, re-run the check with `--skip-tags` for those tags instead of changing the task to make check mode pass. A failure that is not a dry-run artifact is a real bug: fix it.

## Recipes

`references/recipes.md` is Diego's recipe book: problems he solved and how he wants them solved from now on. When he asks to save something as a recipe, or confirms a non-obvious solution you worked out together, append it there in the format the file describes. Recipes override the general rules above when they conflict, since they record a decision made on the real case.
