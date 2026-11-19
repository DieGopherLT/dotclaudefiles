# Cleanup tasks

How to remove things a previous version of the playbook put on hosts (files, packages, users, units, firewall rules) without leaving dead tasks behind forever.

A removal is still a state declaration (`state: absent`), so it belongs in the playbook. The problem is accumulation: nothing tells you when the task has finished its job. These rules give every cleanup task a verifiable end of life.

## Where they live

One `tasks/cleanup.yml` per role that needs it, imported from `main.yml` under its own tag, after the regular tasks:

```yaml
# roles/<role>/tasks/main.yml
# regular tasks first

- name: Remove what earlier versions of this role left behind
  ansible.builtin.import_tasks: cleanup.yml
  tags: [cleanup]
```

Running last means the new resource exists before the old one goes, which is the contract step of a Parallel Change. The exception is an old resource that blocks a regular task, such as a unit holding the port the new one binds: import that cleanup before the task it blocks.

Cleanup belongs to the concern that changed. When the role goes, its leftovers go with it; a global `cleanup.yml` outlives every role and nobody owns it.

A standalone playbook has one concern, so it owns one `tasks/cleanup.yml` next to it, imported at the end of its `tasks` under the same tag.

## What each task carries

A header comment with the date it was added, what changed, and the condition that lets someone delete it:

```yaml
# 2026-10-30: config is now rendered to /etc/app; the old copy holds no data.
# Delete once `--check --tags cleanup` reports changed=0 on every production host.
- name: Remove legacy config dir
  ansible.builtin.file:
    path: /opt/app/config
    state: absent
```

Tasks that need the old resource stopped first (a unit, a container) declare that order explicitly in the same file: stop and disable, then remove. `ansible.builtin.systemd_service` fails with `Could not find the requested service` when the unit does not exist, so guard the stop with the unit file's `stat`. Otherwise the task fails on fresh hosts and on every run after the cleanup succeeded:

```yaml
# 2026-10-30: app-worker.service replaced by app-jobs.service.
# Delete once `--check --tags cleanup` reports changed=0 on every production host.
- name: Look for the legacy worker unit
  ansible.builtin.stat:
    path: /etc/systemd/system/app-worker.service
  register: app_legacy_worker_unit

- name: Remove the legacy worker unit
  when: app_legacy_worker_unit.stat.exists
  block:
    - name: Stop and disable the legacy worker
      ansible.builtin.systemd_service:
        name: app-worker
        state: stopped
        enabled: false

    - name: Delete the legacy worker unit file
      ansible.builtin.file:
        path: /etc/systemd/system/app-worker.service
        state: absent
      notify: Reload systemd
```

## When to delete the task

The criterion is state, not time: the task is dead when

```sh
ansible-playbook -i inventories/production setup.yml --check --diff --tags cleanup
```

reports `changed=0` for it on every production host, its guarded block skipped where it has one. A time-based expiry fails both ways: it deletes before a lagging host converges, or it keeps junk out of caution.

When the last task goes, delete `cleanup.yml` and its import in the same commit. Deleting a task loses no documentation: the commit that removes it records that the cleanup existed and when it was considered finished.

## Fresh hosts and VMs

Hosts provisioned from scratch and reset VMs never held the old state. `state: absent` on something that does not exist is `ok`, and guarded blocks are skipped, so cleanup tasks are harmless there and need no `--skip-tags`.

## What is not a cleanup task

- Replacing a resource with a new version (template re-rendered, package upgraded) is the regular task for that resource, not cleanup.
- Removing a resource another repo on a shared host still declares is forbidden: see "Shared hosts" in the `ansible-conventions` skill. Check that the resource is this repo's before writing the task.
- Moving data to a new place is a migration, not a cleanup: see this skill's `SKILL.md`. The old path disappears as part of the move.
