# Ansible recipes

Solved problems and how they must be solved from now on. Append new recipes at the end, one `##` section each:

- **Problem**: the situation, in terms someone would search for.
- **Solution**: the modules, variables, or template involved; a short snippet when it saves explaining.
- **Why**: what made the obvious approach wrong, so the recipe is not "simplified" back into it.

## Install apt packages

**Problem**: installing packages on Debian/Ubuntu hosts.

**Solution**: two tasks. First refresh the cache, then install the whole list in one call:

```yaml
- name: Update apt cache
  ansible.builtin.apt:
    update_cache: true

- name: Install packages
  ansible.builtin.apt:
    name: "{{ common_packages }}"
    state: present
```

**Why**: the cache refresh stays its own step instead of folding `update_cache` into the install task. Passing the list to `name` installs everything in one apt transaction, faster than a `loop`.

## Enable ufw without locking out SSH

**Problem**: turning on ufw on a remote host.

**Solution**: allow SSH first, either as its own task or as an entry in the list of allowed rules, and enable ufw in a separate, later task:

```yaml
- name: Allow firewall rules
  community.general.ufw:
    rule: allow
    port: "{{ item.port }}"
    proto: "{{ item.proto }}"
  loop: "{{ ufw_allowed }}"   # always includes { port: "22", proto: tcp }

- name: Enable ufw
  community.general.ufw:
    state: enabled
```

**Why**: enabling ufw before the SSH rule exists cuts the connection Ansible is running over, and recovering needs console access. Keeping enable as its own task makes the ordering explicit.

## Install Docker

**Problem**: a host needs Docker Engine, and some users (the connecting user, service users) must run it without sudo.

**Solution**: the Galaxy role `geerlingguy.docker`, declared under `roles:` in `requirements.yml`, included with a tag and its variables:

```yaml
roles:
  - role: geerlingguy.docker
    tags: [docker]
    vars:
      docker_packages_state: latest
      docker_users:
        - "{{ ansible_user }}"
        # plus every user that needs Docker
```

`docker_users` is the only place users join the `docker` group; do not add them with separate `user` tasks.

**Why**: the role already handles repositories, packages, the daemon, and group membership across distros; rewriting that as tasks duplicates a well-maintained solution.

## Install Docker rootless

**Problem**: a host must run Docker without a root daemon, replacing rootful Docker. Use this as a template and adjust it when an assumption does not hold.

**Source**: the playbook translates the official instructions into Ansible: <https://docs.docker.com/engine/security/rootless/>. Consult them for prerequisites, limitations, and anything outside these assumptions.

**Assumptions**:

- Ubuntu 24.04.
- The daemon belongs to `ansible_user`, which is not root.
- `geerlingguy.docker` is pinned to 8.0.0 in `requirements.yml`.
- The host has a single user. Never disable the rootful daemon while other users or apps depend on it. A host with several apps, or apps still on rootful Docker, follows "Run each app on its own rootless tenant" below.

**Solution**:

```yaml
- name: Install docker rootless
  hosts: all
  become: true

  roles:
    - role: geerlingguy.docker
      tags: [docker]
      vars:
        docker_packages_state: latest
        docker_service_state: stopped
        docker_service_enabled: false

  tasks:
    - name: Setup docker rootless
      tags: [docker-rootless]
      block:
        - name: Update apt cache
          ansible.builtin.apt:
            update_cache: true
            cache_valid_time: 3600

        - name: Install required packages for rootless docker
          ansible.builtin.apt:
            name:
              - uidmap
            state: present

        - name: Run docker rootless setup script
          ansible.builtin.command:
            cmd: /usr/bin/dockerd-rootless-setuptool.sh install
            creates: ~/.config/systemd/user/docker.service
          become: false

        - name: Enable and start docker rootless service
          ansible.builtin.systemd:
            name: docker
            enabled: true
            state: started
            scope: user
          become: false

        - name: Ensure docker rootless service runs on startup
          ansible.builtin.command:
            cmd: loginctl enable-linger {{ ansible_user }}
            creates: /var/lib/systemd/linger/{{ ansible_user }}

        - name: Disable rootful docker socket and service
          ansible.builtin.systemd:
            name: "{{ item }}"
            enabled: false
            state: stopped
          loop:
            - docker.socket
            - docker.service

        - name: Delete rootful docker socket
          ansible.builtin.file:
            path: /var/run/docker.sock
            state: absent
```

**Why**:

- `creates` uses `~`, not `ansible_env.HOME` or `ansible_facts["env"]["HOME"]`: the play's `become: true` gathers facts as root, so those resolve to `/root`, the file is never found, and the script reinstalls on every run. The module expands `~` on the host as `ansible_user`.
- The role's defaults start and enable rootful Docker, so leaving them makes the role and the disable tasks undo each other on every run, both reporting `changed`.
- `docker.socket` must stop too: left enabled, it recreates `/var/run/docker.sock` on boot and the next client connection starts the rootful daemon.
- No `docker_users`: that group grants access to the rootful daemon, which this host does not run.
- `command` is justified here: no module covers the setup script or linger, and the files in `creates` are the state each one leaves behind.
- The role's `docker_packages` already installs `docker-ce-rootless-extras`, which owns the setup script, so a `stat` + `when` guard is unnecessary and would skip the whole setup without an error if the script were missing.

## Run each app on its own rootless tenant with a force-command deploy key

**Problem**: several apps share a host on rootful Docker, and a leaked CI secret gives root on the whole host. Each app must run as its own unprivileged user, and its CI key must only redeploy that app to a commit that already has an image.

**Source**: a shared role `docker_rootless`, pinned by tag in each app repo's `requirements.yml`, which gives its git URL. Its README documents the descriptor, the deploy script's exit codes and the operator commands.

**Assumptions**:

- Ubuntu 22.04 or 24.04 with systemd.
- The role owns everything common to the apps: engine (it includes `geerlingguy.docker`), tenant, daemon, units, deploy script, CI key and ufw for public ports. Each app repo owns its env files, vhosts, vault and descriptor.
- Images live in a registry that a read-only credential can pull from.

**Solution**: each repo declares a descriptor and applies the role.

```yaml
# requirements.yml
roles:
  - name: docker_rootless
    src: <role git URL>
    scm: git
    version: v1.0.0

# inventories/production/group_vars/<group>.yml
docker_rootless_user: myapp
docker_rootless_deployables:
  - name: myapp              # -> /usr/local/bin/myapp-deploy
    image_repo: registry.digitalocean.com/<registry>/myapp
    tag: "{sha}"
    registry_auth: "{{ vault_docr_read_auth }}"
    ci_public_key: "{{ myapp_ci_public_key }}"
    data_dirs:
      - { path: /var/lib/myapp/data, uid: 0, gid: 0, mode: "0700" }
    containers:
      - name: myapp
        ports: [{ host: 8090, container: 8080, bind: 0.0.0.0, public: true, comment: My app }]
        mounts: [{ src: /var/lib/myapp/data, dst: /app/data }]
        env_files: [/etc/myapp/app.env]
        start_guards: ['[ -r /var/lib/myapp/data/sessions.json ]']
        health: running
```

CI sends only the commit SHA: `ssh <tenant>@<host> "<sha40>"`. The key's `command=` runs the deploy script, which pulls, swaps, checks health and reverts on the host. In GitHub, the key is a secret (`DROPLET_SSH_KEY`); host, user and known_hosts are variables.

Migrating a host from rootful Docker is a Parallel Change, one app at a time:

1. Expand: every repo of the host applies the role with `[tags] skip = docker-rootful-off` in its `ansible.cfg`. Tenants, daemons and units appear; the units stay inactive because there is no `image.env` yet.
2. Migrate each app: disable its old workflow. As the tenant, pull the live SHA and compare `RepoDigests` with rootful. Stop the old runtime, copy the data, then make the first deploy with `sudo -H -u <tenant> SSH_ORIGINAL_COMMAND=<sha40> /usr/local/bin/<d>-deploy`, and roll back to the old runtime if it exits non-zero. Load the GitHub secret and variables, then dispatch the live SHA: it must end in `noop`.
3. Contract, once every app of the host has moved: run the repos' cleanup tags, `docker rm` the rootful containers, drop the skip, apply the role (it stops `docker.socket`, `docker.service` and `containerd.service`), remove the old CI key from root, and reboot. `rm -rf /var/lib/docker` comes after an observation period.

**Why**:

- Copy data as root with `rsync -aHAX --delete --numeric-ids --chown=<owner>:<owner>`. The owner is the tenant uid for container uid 0 and `subuid_start - 1 + N` for container uid N. A `chown` inside the user namespace fails on files owned by an unmapped uid.
- `dockerd-rootless-setuptool.sh install` switches the docker CLI context of the user it runs as. A pre-existing user that still runs rootful containers needs `Environment=DOCKER_HOST=unix:///var/run/docker.sock` in its old unit before the role runs.
- The tenant's shell is `/bin/sh`, not `nologin`: sshd runs `command=` through the login shell, and `restrict` plus the forced command still deny an interactive shell.
- The same tag has a different image id on rootful (overlay2) and rootless (containerd store); only `RepoDigests` compare.
- Ports published by rootlesskit pass through INPUT, so ufw filters them; `ufw-docker` is unnecessary.
- An app that treats a missing data file as an empty store needs a start guard, or a first start on an empty directory silently loses its state.
- Check mode cannot tell a content change from an owner change on a file rendered with `diff: false`. Compare the live env file with a local render by per-key fingerprint before the expand.
- A `workflow_dispatch` with an empty `sha` builds and deploys `main` HEAD; to prove the chain without a deploy, pass the live SHA.
- After the reboot, linger brings every tenant back and the `DOCKER` iptables chains are gone; check that `iptables-persistent` would not restore them.
